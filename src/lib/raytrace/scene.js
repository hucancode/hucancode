import { m3Inv, m3MulV, m3T } from "../math/mat3.js";
import { SHAPE, localAabb } from "./shapes.js";

export const MAT = { LAMBERTIAN: 0, METAL: 1, DIELECTRIC: 2 };

export function materialOf(spec) {
  const type = spec?.type === "metal" ? MAT.METAL
    : spec?.type === "dielectric" ? MAT.DIELECTRIC : MAT.LAMBERTIAN;
  let param = 0;
  if (type === MAT.METAL) param = spec?.fuzz ?? 0.12;
  else if (type === MAT.DIELECTRIC) param = spec?.ior ?? 1.5;
  else param = spec?.roughness ?? 0.3;
  return { type, param };
}

export function buildScene(model, opts = {}) {
  const { materials = {}, partKey = null } = opts;
  const items = model?.items;
  const meshes = model?.meshes;
  const valid = [];
  if (items && meshes) {
    for (let i = 0; i < items.length; i++) {
      const s = meshes[items[i].key]?.shape;
      if (s && SHAPE[s.kind] !== undefined) valid.push(i);
    }
  }

  const n = valid.length;
  const IKind = new Int32Array(n);
  const IP0 = new Float32Array(n), IP1 = new Float32Array(n);
  const IP2 = new Float32Array(n), IP3 = new Float32Array(n);
  const IM = new Float32Array(9 * n);      // inverse matrix (row-major)
  const IMT = new Float32Array(9 * n);     // inverse-transpose (normal transform)
  const IinvT = new Float32Array(3 * n);   // -invM * t
  const IC = new Float32Array(3 * n);      // base color
  const IMat = new Int32Array(n);          // material type (MAT.*)
  const IMatP = new Float32Array(n);       // material param (fuzz / ior)
  const aabb = new Float32Array(6 * n);    // world AABB
  const centroid = new Float32Array(3 * n);

  for (let ci = 0; ci < n; ci++) {
    const i = valid[ci];
    const it = items[i];
    const s = meshes[it.key].shape;
    const kind = SHAPE[s.kind];
    const p = s.p || [];
    IKind[ci] = kind;
    IP0[ci] = p[0] ?? 0; IP1[ci] = p[1] ?? 0; IP2[ci] = p[2] ?? 0; IP3[ci] = p[3] ?? 0;

    const inv = m3Inv(it.m);
    for (let j = 0; j < 9; j++) IM[9 * ci + j] = inv[j];
    const invT = m3T(inv);
    for (let j = 0; j < 9; j++) IMT[9 * ci + j] = invT[j];
    const itv = m3MulV(inv, [-it.t[0], -it.t[1], -it.t[2]]);
    IinvT[3 * ci] = itv[0]; IinvT[3 * ci + 1] = itv[1]; IinvT[3 * ci + 2] = itv[2];

    const c = it.color || [0.8, 0.8, 0.8];
    IC[3 * ci] = c[0]; IC[3 * ci + 1] = c[1]; IC[3 * ci + 2] = c[2];

    const pk = partKey
      ? partKey(it.group, it)
      : (it.group ? it.group.slice(0, it.group.indexOf(":")) : "");
    const mat = materialOf(materials[pk]);
    IMat[ci] = mat.type;
    IMatP[ci] = mat.param;

    // world AABB via Arvo's affine-transform formula: for an affine map the
    // transformed box's half-extent along each world axis is the |M| row
    // dotted with the local half-extent — exactly the same tight AABB as
    // transforming all 8 corners and taking min/max, for one matrix-vector
    // multiply instead of eight.
    const la = localAabb(kind, [IP0[ci], IP1[ci], IP2[ci], IP3[ci]]);
    const m = it.m, t = it.t;
    const lcx = (la[0] + la[3]) * 0.5, lcy = (la[1] + la[4]) * 0.5, lcz = (la[2] + la[5]) * 0.5;
    const lex = (la[3] - la[0]) * 0.5, ley = (la[4] - la[1]) * 0.5, lez = (la[5] - la[2]) * 0.5;
    const wcx = m[0] * lcx + m[1] * lcy + m[2] * lcz + t[0];
    const wcy = m[3] * lcx + m[4] * lcy + m[5] * lcz + t[1];
    const wcz = m[6] * lcx + m[7] * lcy + m[8] * lcz + t[2];
    const wex = Math.abs(m[0]) * lex + Math.abs(m[1]) * ley + Math.abs(m[2]) * lez;
    const wey = Math.abs(m[3]) * lex + Math.abs(m[4]) * ley + Math.abs(m[5]) * lez;
    const wez = Math.abs(m[6]) * lex + Math.abs(m[7]) * ley + Math.abs(m[8]) * lez;
    aabb[6 * ci] = wcx - wex; aabb[6 * ci + 1] = wcy - wey; aabb[6 * ci + 2] = wcz - wez;
    aabb[6 * ci + 3] = wcx + wex; aabb[6 * ci + 4] = wcy + wey; aabb[6 * ci + 5] = wcz + wez;
    centroid[3 * ci] = wcx;
    centroid[3 * ci + 1] = wcy;
    centroid[3 * ci + 2] = wcz;
  }

  const bvh = buildBVH(n, aabb, centroid);
  return { n, IKind, IP0, IP1, IP2, IP3, IM, IMT, IinvT, IC, IMat, IMatP, aabb, centroid, bvh };
}

// float32 -> half-float (IEEE 754 binary16) bit pattern, round-toward-zero.
// Only used for BVH box texels — callers MUST pad values outward first
// (padMin/padMax below): truncation alone is not conservative for negative
// mins or fractional maxes, but a margin bigger than any half quantization
// step makes the direction of rounding irrelevant.
const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);
function toHalfBits(v) {
  _f32[0] = Math.max(-60000, Math.min(60000, v));
  const x = _u32[0];
  const sign = (x >>> 16) & 0x8000;
  const exp = (x >>> 23) & 0xff;
  const mant = x & 0x7fffff;
  if (exp === 0) return sign; // zero/subnormal f32 -> 0
  const e = exp - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00; // overflow -> inf
  if (e <= 0) {
    if (e < -10) return sign; // underflow -> 0
    return sign | ((mant | 0x800000) >>> (14 - e));
  }
  return sign | (e << 10) | (mant >>> 13);
}
// margin comfortably exceeds a half's worst-case relative quantization error
// (~0.1% under truncation), so the packed box never shrinks past the real one
const PAD_REL = 2e-3, PAD_ABS = 1e-3;
const padMin = (v) => v - (Math.abs(v) * PAD_REL + PAD_ABS);
const padMax = (v) => v + (Math.abs(v) * PAD_REL + PAD_ABS);

// GPU packing — flat arrays uploaded as DATA TEXTURES (see trace.wgsl):
//   bvhRefData: rgba32f, 1 texel/node  [leftRef, rightRef, pad, pad]
//     a ref >= 0 is a child node index; a ref <= -2 is a LEAF, encoding
//     instance index i as -(i+2). Refs must stay exact past 2048, which is
//     why they live in the 32-bit texture instead of packed with the boxes.
//   bvhBoxData: rgba16f, 3 texels/node [leftMin(3) leftMax(3) rightMin(3) rightMax(3)]
//     both children's bounds live in the PARENT so a traversal step never
//     needs a second, data-dependent fetch to learn a child's box (or that
//     it's a leaf) — half precision is fine here since boxes are padded
//     outward on build (see padMin/padMax).
//   instData: rgba32f, 8 texels/prim [kind, p0..p3, IM(9), IMT(9), IinvT(3), color(3), mat, matParam, pad]
export function buildGpuScene(model, opts = {}) {
  const scene = buildScene(model, opts);
  const { n, bvh, IKind, IP0, IP1, IP2, IP3, IM, IMT, IinvT, IC, IMat, IMatP } = scene;
  const { nodeCount, leftRef, rightRef, leftMin, leftMax, rightMin, rightMax, root } = bvh;

  const bvhRefData = new Float32Array(Math.max(1, nodeCount) * 4);
  const bvhBoxData = new Uint16Array(Math.max(1, nodeCount) * 12);
  for (let i = 0; i < nodeCount; i++) {
    bvhRefData[4 * i] = leftRef[i];
    bvhRefData[4 * i + 1] = rightRef[i];
    const bo = 12 * i, o3 = 3 * i;
    bvhBoxData[bo] = toHalfBits(padMin(leftMin[o3]));
    bvhBoxData[bo + 1] = toHalfBits(padMin(leftMin[o3 + 1]));
    bvhBoxData[bo + 2] = toHalfBits(padMin(leftMin[o3 + 2]));
    bvhBoxData[bo + 3] = toHalfBits(padMax(leftMax[o3]));
    bvhBoxData[bo + 4] = toHalfBits(padMax(leftMax[o3 + 1]));
    bvhBoxData[bo + 5] = toHalfBits(padMax(leftMax[o3 + 2]));
    bvhBoxData[bo + 6] = toHalfBits(padMin(rightMin[o3]));
    bvhBoxData[bo + 7] = toHalfBits(padMin(rightMin[o3 + 1]));
    bvhBoxData[bo + 8] = toHalfBits(padMin(rightMin[o3 + 2]));
    bvhBoxData[bo + 9] = toHalfBits(padMax(rightMax[o3]));
    bvhBoxData[bo + 10] = toHalfBits(padMax(rightMax[o3 + 1]));
    bvhBoxData[bo + 11] = toHalfBits(padMax(rightMax[o3 + 2]));
  }

  const instData = new Float32Array(Math.max(1, n) * 32);
  for (let i = 0; i < n; i++) {
    const o = i * 32;
    instData[o] = IKind[i];
    instData[o + 1] = IP0[i];
    instData[o + 2] = IP1[i];
    instData[o + 3] = IP2[i];
    instData[o + 4] = IP3[i];
    for (let j = 0; j < 9; j++) instData[o + 5 + j] = IM[9 * i + j];
    for (let j = 0; j < 9; j++) instData[o + 14 + j] = IMT[9 * i + j];
    instData[o + 23] = IinvT[3 * i];
    instData[o + 24] = IinvT[3 * i + 1];
    instData[o + 25] = IinvT[3 * i + 2];
    instData[o + 26] = IC[3 * i];
    instData[o + 27] = IC[3 * i + 1];
    instData[o + 28] = IC[3 * i + 2];
    instData[o + 29] = IMat[i];
    instData[o + 30] = IMatP[i];
  }

  return { scene, bvhRefData, bvhBoxData, instData, root, nodeCount, n };
}

// ---- BVH (median split on the longest centroid axis) -----------------------
// Only INTERNAL nodes get an entry in the output arrays; a leaf is encoded
// inline in its parent's ref as -(instanceIndex+2) (see buildGpuScene), and
// every internal node carries BOTH children's bounding boxes directly so a
// GPU traversal step never needs a second, data-dependent texture fetch just
// to learn a child's box or discover that it's a leaf.

function swap(a, i, j) { const t = a[i]; a[i] = a[j]; a[j] = t; }

// Hoare partition of order[lo,hi) by centroid[3*idx+axis], pivot = median of
// the first/mid/last elements (guards against the common sorted / reverse-
// sorted inputs that make a fixed-index pivot go quadratic). Returns j such
// that centroid(order[i]) <= pivot for i in [lo,j] and >= pivot for i in [j+1,hi).
function partitionByCentroid(order, lo, hi, centroid, axis) {
  const key = (idx) => centroid[3 * idx + axis];
  const mid = (lo + hi - 1) >> 1;
  if (key(order[mid]) < key(order[lo])) swap(order, lo, mid);
  if (key(order[hi - 1]) < key(order[lo])) swap(order, lo, hi - 1);
  if (key(order[hi - 1]) < key(order[mid])) swap(order, mid, hi - 1);
  const pivot = key(order[mid]);
  let i = lo - 1, j = hi;
  for (;;) {
    do { i++; } while (key(order[i]) < pivot);
    do { j--; } while (key(order[j]) > pivot);
    if (i >= j) return j;
    swap(order, i, j);
  }
}

// partitions order[lo,hi) in place so order[k] holds the element a full sort
// by centroid[axis] would put there (median for our even split) — O(n)
// average instead of the O(n log n) a full sort costs, which is all a
// median-split BVH build ever needed order for in the first place.
function selectMedian(order, lo, hi, k, centroid, axis) {
  while (hi - lo > 1) {
    const j = partitionByCentroid(order, lo, hi, centroid, axis);
    if (k <= j) hi = j + 1;
    else lo = j + 1;
  }
}

function buildBVH(n, aabb, centroid) {
  if (n === 0) {
    const empty = new Float32Array(0);
    return {
      root: -1, nodeCount: 0,
      leftRef: new Int32Array(0), rightRef: new Int32Array(0),
      leftMin: empty, leftMax: empty, rightMin: empty, rightMax: empty,
    };
  }

  const maxNodes = Math.max(1, n - 1);
  const leftRef = new Int32Array(maxNodes);
  const rightRef = new Int32Array(maxNodes);
  const leftMin = new Float32Array(3 * maxNodes);
  const leftMax = new Float32Array(3 * maxNodes);
  const rightMin = new Float32Array(3 * maxNodes);
  const rightMax = new Float32Array(3 * maxNodes);
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  let nodeCount = 0;

  // returns { ref, mnx,mny,mnz, mxx,mxy,mxz } for the range [lo,hi)
  function build(lo, hi) {
    if (hi - lo === 1) {
      const i = order[lo];
      return {
        ref: -(i + 2),
        mnx: aabb[6 * i], mny: aabb[6 * i + 1], mnz: aabb[6 * i + 2],
        mxx: aabb[6 * i + 3], mxy: aabb[6 * i + 4], mxz: aabb[6 * i + 5],
      };
    }
    let cnx = Infinity, cny = Infinity, cnz = Infinity;
    let cxx = -Infinity, cxy = -Infinity, cxz = -Infinity;
    for (let k = lo; k < hi; k++) {
      const i = order[k];
      const cx = centroid[3 * i], cy = centroid[3 * i + 1], cz = centroid[3 * i + 2];
      if (cx < cnx) cnx = cx; if (cx > cxx) cxx = cx;
      if (cy < cny) cny = cy; if (cy > cxy) cxy = cy;
      if (cz < cnz) cnz = cz; if (cz > cxz) cxz = cz;
    }
    const ex = cxx - cnx, ey = cxy - cny, ez = cxz - cnz;
    let axis = 0;
    if (ey > ex && ey > ez) axis = 1;
    else if (ez > ex) axis = 2;

    const mid = (lo + hi) >> 1;
    selectMedian(order, lo, hi, mid, centroid, axis);
    const L = build(lo, mid);
    const R = build(mid, hi);

    const node = nodeCount++;
    leftRef[node] = L.ref; rightRef[node] = R.ref;
    leftMin[3 * node] = L.mnx; leftMin[3 * node + 1] = L.mny; leftMin[3 * node + 2] = L.mnz;
    leftMax[3 * node] = L.mxx; leftMax[3 * node + 1] = L.mxy; leftMax[3 * node + 2] = L.mxz;
    rightMin[3 * node] = R.mnx; rightMin[3 * node + 1] = R.mny; rightMin[3 * node + 2] = R.mnz;
    rightMax[3 * node] = R.mxx; rightMax[3 * node + 1] = R.mxy; rightMax[3 * node + 2] = R.mxz;

    return {
      ref: node,
      mnx: Math.min(L.mnx, R.mnx), mny: Math.min(L.mny, R.mny), mnz: Math.min(L.mnz, R.mnz),
      mxx: Math.max(L.mxx, R.mxx), mxy: Math.max(L.mxy, R.mxy), mxz: Math.max(L.mxz, R.mxz),
    };
  }

  const top = build(0, n);
  return { root: top.ref, nodeCount, leftRef, rightRef, leftMin, leftMax, rightMin, rightMax };
}
