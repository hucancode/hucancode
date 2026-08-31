// SCENE BUILDER — turns a mech model ({ items, shapes }) into flat typed arrays
// the tracer walks: one entry per primitive INSTANCE (not per triangle), with
// its inverse / inverse-transpose matrices, analytic shape id + params, color
// and a world-space AABB. Then a median-split BVH is built over those AABBs.
//
// Rebuilt EVERY FRAME: animated rigs move the primitives, so the AABBs and the
// BVH are invalidated and rebuilt from scratch each frame (cheap at these
// counts — a few hundred to a few thousand instances).

import { m3Inv, m3InvT, m3MulV } from "../math/mat3.js";
import { SHAPE, localAabb } from "./shapes.js";

// ---- MATERIALS -------------------------------------------------------------
// The tracer supports three shading models per primitive instance. A material
// spec is `{ type: "lambertian" | "metal" | "dielectric", ... }`; the scene
// builder normalizes it into a packed (type, param) pair for the GPU.
//   lambertian  param = roughness (0..1, Oren-Nayar sigma; 0 = pure Lambert)
//   metal       param = fuzz (0..1 roughness of the mirror reflection)
//   dielectric  param = index of refraction (e.g. 1.5 glass)
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
  const shapes = model?.shapes;
  const valid = [];
  if (items && shapes) {
    for (let i = 0; i < items.length; i++) {
      const s = shapes[items[i].key];
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
    const s = shapes[it.key];
    const kind = SHAPE[s.kind];
    const p = s.p || [];
    IKind[ci] = kind;
    IP0[ci] = p[0] ?? 0; IP1[ci] = p[1] ?? 0; IP2[ci] = p[2] ?? 0; IP3[ci] = p[3] ?? 0;

    const inv = m3Inv(it.m);
    for (let j = 0; j < 9; j++) IM[9 * ci + j] = inv[j];
    const invT = m3InvT(it.m);
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

    // world AABB = the 8 corners of the unit AABB through m,t
    const la = localAabb(kind, [IP0[ci], IP1[ci], IP2[ci], IP3[ci]]);
    const m = it.m, t = it.t;
    let mnx = Infinity, mny = Infinity, mnz = Infinity;
    let mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (let ci8 = 0; ci8 < 8; ci8++) {
      const cx = ci8 & 1 ? la[3] : la[0];
      const cy = ci8 & 2 ? la[4] : la[1];
      const cz = ci8 & 4 ? la[5] : la[2];
      const wx = m[0] * cx + m[1] * cy + m[2] * cz + t[0];
      const wy = m[3] * cx + m[4] * cy + m[5] * cz + t[1];
      const wz = m[6] * cx + m[7] * cy + m[8] * cz + t[2];
      if (wx < mnx) mnx = wx; if (wx > mxx) mxx = wx;
      if (wy < mny) mny = wy; if (wy > mxy) mxy = wy;
      if (wz < mnz) mnz = wz; if (wz > mxz) mxz = wz;
    }
    aabb[6 * ci] = mnx; aabb[6 * ci + 1] = mny; aabb[6 * ci + 2] = mnz;
    aabb[6 * ci + 3] = mxx; aabb[6 * ci + 4] = mxy; aabb[6 * ci + 5] = mxz;
    centroid[3 * ci] = (mnx + mxx) / 2;
    centroid[3 * ci + 1] = (mny + mxy) / 2;
    centroid[3 * ci + 2] = (mnz + mxz) / 2;
  }

  const bvh = buildBVH(n, aabb, centroid);
  return { n, IKind, IP0, IP1, IP2, IP3, IM, IMT, IinvT, IC, IMat, IMatP, aabb, centroid, bvh };
}

// GPU packing — flat storage-buffer layouts consumed by the WebGPU compute
// tracer (trace.wgsl). Indices are stored as f32 (exact up to 2^24, far above
// any scene here) so a single buffer holds both ints and bounds.
//   bvhData:  8 floats / node   [left, right, min.x, min.y, min.z, max.x, max.y, max.z]
//   instData: 32 floats / prim  [kind, p0..p3, IM(9), IMT(9), IinvT(3), color(3), mat, matParam, pad]
export function buildGpuScene(model, opts = {}) {
  const scene = buildScene(model, opts);
  const { n, bvh, IKind, IP0, IP1, IP2, IP3, IM, IMT, IinvT, IC, IMat, IMatP } = scene;
  const { nodeCount, left, right, bmin, bmax } = bvh;

  const bvhData = new Float32Array(Math.max(1, nodeCount) * 8);
  for (let i = 0; i < nodeCount; i++) {
    const o = i * 8;
    bvhData[o] = left[i];
    bvhData[o + 1] = right[i];
    bvhData[o + 2] = bmin[3 * i];
    bvhData[o + 3] = bmin[3 * i + 1];
    bvhData[o + 4] = bmin[3 * i + 2];
    bvhData[o + 5] = bmax[3 * i];
    bvhData[o + 6] = bmax[3 * i + 1];
    bvhData[o + 7] = bmax[3 * i + 2];
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

  return { scene, bvhData, instData, root: bvh.root, nodeCount, n };
}

// ---- BVH (median split on the longest centroid axis) -----------------------

function buildBVH(n, aabb, centroid) {
  const maxNodes = Math.max(1, 2 * n - 1);
  const left = new Int32Array(maxNodes).fill(-1);
  const right = new Int32Array(maxNodes).fill(-1);
  const bmin = new Float32Array(3 * maxNodes);
  const bmax = new Float32Array(3 * maxNodes);
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  let nodeCount = 0;

  function build(lo, hi) {
    const node = nodeCount++;
    let mnx = Infinity, mny = Infinity, mnz = Infinity;
    let mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    let cnx = Infinity, cny = Infinity, cnz = Infinity;
    let cxx = -Infinity, cxy = -Infinity, cxz = -Infinity;
    for (let k = lo; k < hi; k++) {
      const i = order[k];
      const ax = aabb[6 * i], ay = aabb[6 * i + 1], az = aabb[6 * i + 2];
      const bx = aabb[6 * i + 3], by = aabb[6 * i + 4], bz = aabb[6 * i + 5];
      if (ax < mnx) mnx = ax; if (bx > mxx) mxx = bx;
      if (ay < mny) mny = ay; if (by > mxy) mxy = by;
      if (az < mnz) mnz = az; if (bz > mxz) mxz = bz;
      const cx = centroid[3 * i], cy = centroid[3 * i + 1], cz = centroid[3 * i + 2];
      if (cx < cnx) cnx = cx; if (cx > cxx) cxx = cx;
      if (cy < cny) cny = cy; if (cy > cxy) cxy = cy;
      if (cz < cnz) cnz = cz; if (cz > cxz) cxz = cz;
    }
    bmin[3 * node] = mnx; bmin[3 * node + 1] = mny; bmin[3 * node + 2] = mnz;
    bmax[3 * node] = mxx; bmax[3 * node + 1] = mxy; bmax[3 * node + 2] = mxz;

    if (hi - lo === 1) {
      left[node] = order[lo];
      right[node] = -1;
      return node;
    }

    const ex = cxx - cnx, ey = cxy - cny, ez = cxz - cnz;
    let axis = 0;
    if (ey > ex && ey > ez) axis = 1;
    else if (ez > ex) axis = 2;

    const mid = (lo + hi) >> 1;
    order.subarray(lo, hi).sort((a, b) => centroid[3 * a + axis] - centroid[3 * b + axis]);
    left[node] = build(lo, mid);
    right[node] = build(mid, hi);
    return node;
  }

  const root = n > 0 ? build(0, n) : -1;
  return { root, left, right, bmin, bmax, nodeCount };
}
