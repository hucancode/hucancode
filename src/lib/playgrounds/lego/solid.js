// Op-based parametric brick definition + mesher.
//
// A part = an integer bounding box plus a list of ops applied in order:
//
//   { size: [W, H, D],   // integer studs (X), plates (Y), studs (Z)
//     ops: [ ... ] }
//
// OPS
//   slope cut   { op:"slope", face, dir, length, depth, round? }
//       face   surface that ramps down  ("x+","x-","y+","y-","z+","z-")
//       dir    +1 forward | -1 backward; the run axis is deduced from `face`
//              (y-face -> z, z-face -> x, x-face -> z) and dir picks which end
//       length run in cells; the ramp ENDS at the `dir` boundary (full depth)
//              and STARTS `length` cells inward at full height (>=1)
//       depth  drop into the body along the face normal, in cells (>=1)
//       round  true -> convex quarter-curve instead of a straight ramp
//
//   push cut    { op:"push", face, depth, width, height, at? }
//       face   face to carve into
//       depth  cells inward from that face (>=1)
//       width  extent in the face's first in-plane axis (>=1)
//       height extent in the face's second in-plane axis (>=1)
//       at     [u,v] lower-corner index offset in those axes (default [0,0])
//       in-plane axes: x-face -> (z,y) ; y-face -> (x,z) ; z-face -> (x,y)
//
//   studs       { op:"studs", face, kind?, at? }
//       face   "y+"|"y-"|"x+"|"x-"|"z+"|"z-"
//       kind   "male" (protrude) | "female" (clutch tube)   default male
//       at     region selector on the face grid:
//                undefined -> whole face
//                { row:k }  -> one row  (constant grid-2 index)
//                { col:i }  -> one col  (constant grid-1 index)
//                { cell:[i,k] } -> single stud
//       Studs are GROWN AFTER all cuts. A stud is only placed where the cell at
//       that face survived every cut with its outer face still flat & full; cells
//       made uneven by a slope or removed by a push are skipped automatically.
//
// Body centered at origin. X/Z pitch = 1 world unit/stud. Y unit = PLATE_H.
// Cells are unit cubes (in cell space); a cell may be removed (push) or sliced
// by one or more half-space planes (slope). Internal faces are left in place —
// they are occluded by the opaque solid, so no face culling is needed.

import {
  Geometry, cylinderGeometry, mergeGeometries,
} from "$lib/engine/index.js";

export const PLATE_H = 0.4;
export const BRICK_H = 1.2;            // 3 plates
const STUD_R = 0.3, STUD_H = 0.2;
const EPS = 1e-6;

const AXES = { x: 0, y: 1, z: 2 };
// per-axis world unit: Y measured in plates, X/Z in studs
const unit = (ax) => (ax === 1 ? PLATE_H : 1);

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

// ---- convex polyhedron, stored as a list of CCW-outward polygon faces ------
// world cube for one cell of size [W,H,D] at grid index (i,j,k)
function cellFaces(i, j, k, W, H, D) {
  const x0 = i - W / 2, x1 = x0 + 1;
  const y0 = (j - H / 2) * PLATE_H, y1 = y0 + PLATE_H;
  const z0 = k - D / 2, z1 = z0 + 1;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],   // 0-3 z- face
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],   // 4-7 z+ face
  ];
  // each face CCW when viewed from outside
  return [
    [v[1], v[0], v[3], v[2]],   // z- (normal -z)
    [v[4], v[5], v[6], v[7]],   // z+ (normal +z)
    [v[0], v[4], v[7], v[3]],   // x- (normal -x)
    [v[5], v[1], v[2], v[6]],   // x+ (normal +x)
    [v[0], v[1], v[5], v[4]],   // y- (normal -y)
    [v[3], v[7], v[6], v[2]],   // y+ (normal +y)
  ];
}

// Sutherland-Hodgman clip of one polygon by half-space  n·p <= d (keep side).
function clipPoly(poly, n, d) {
  const out = [];
  const N = poly.length;
  for (let i = 0; i < N; i++) {
    const A = poly[i], B = poly[(i + 1) % N];
    const da = dot(n, A) - d, db = dot(n, B) - d;
    if (da <= EPS) out.push(A);
    if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) {
      const t = da / (da - db);
      out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
    }
  }
  return out;
}

// order a set of coplanar points into a CCW ring whose face normal == n
function orderRing(pts, n) {
  const uniq = [];
  for (const p of pts) {
    if (!uniq.some((q) => Math.abs(q[0] - p[0]) < 1e-5 && Math.abs(q[1] - p[1]) < 1e-5 && Math.abs(q[2] - p[2]) < 1e-5))
      uniq.push(p);
  }
  if (uniq.length < 3) return null;
  const c = [0, 0, 0];
  for (const p of uniq) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  c[0] /= uniq.length; c[1] /= uniq.length; c[2] /= uniq.length;
  // plane basis
  let u = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  u = norm(cross(n, u));
  const w = cross(n, u);
  uniq.sort((a, b) => {
    const da = sub(a, c), db = sub(b, c);
    return Math.atan2(dot(da, w), dot(da, u)) - Math.atan2(dot(db, w), dot(db, u));
  });
  return uniq;
}

// clip a polyhedron (face list) by half-space n·p <= d; returns new face list.
// The cut surface (cap) is rebuilt from every kept vertex lying ON the plane —
// this is robust even when the plane passes exactly through cube corners (the
// common integer-slope case), where edge-crossing detection alone finds none.
function clipSolid(faces, n, d) {
  const next = [], capPts = [];
  for (const f of faces) {
    const poly = clipPoly(f, n, d);
    if (poly.length < 3) continue;
    next.push(poly);
    for (const p of poly) if (Math.abs(dot(n, p) - d) < 1e-5) capPts.push(p);
  }
  if (capPts.length >= 3) {
    const ring = orderRing(capPts, n);   // cap faces toward +n (outward)
    if (ring) next.push(ring);
  }
  return next;
}

// the run axis is DEDUCED from the face: first of [z,x,y] that isn't the face
// axis (y-face -> z, z-face -> x, x-face -> z).
const RUN_AXIS = { 0: 2, 1: 2, 2: 0 };

// A slope/curve cut ALWAYS ends at a BOUNDARY (low, full `depth` drop) and runs
// `length` cells inward, where it starts at full height. The run axis is deduced
// from `face`; `dir` (+1 fwd / -1 back) picks which boundary along it the ramp
// descends to; `length` decides where it starts (length = whole axis ->
// edge-to-edge slope).
//
// The cut surface is sampled along the run axis and turned into a list of chord
// half-spaces (material kept BELOW each chord); the whole part is then clipped by
// every plane. A straight ramp is one plane. A `round` curve is sampled at
// SUB sub-steps PER CELL: the material under a curved slope is convex, so the
// intersection of the inscribed chords is a smooth faceted surface that
// converges to the true quarter-cosine. `op.seg` overrides the per-cell steps.
function slopePlanes(op, W, H, D) {
  const dims = [W, H, D];
  const fa = AXES[op.face[0]];                 // face axis index
  const fs = op.face[1] === "+" ? 1 : -1;      // outer side sign
  const la = RUN_AXIS[fa];                     // run axis, deduced from face
  const ls = op.dir >= 0 ? 1 : -1;             // boundary the ramp descends to
  const Dp = Math.max(1, op.depth | 0);
  const fU = unit(fa), lU = unit(la);
  const faceLevel = fs * (dims[fa] / 2) * fU;  // world coord of the face

  const dim = dims[la];
  const L = Math.max(1, Math.min(op.length | 0 || dim, dim));
  // high (start) grid boundary, `length` cells in from the `dir` boundary
  const start = ls > 0 ? dim - L : L;
  const lHalf = dim / 2;
  const lCoord = (b) => (b - lHalf) * lU;        // world coord of boundary b
  const tAt = (b) => (ls > 0 ? b - start : start - b);  // cells from start toward dir

  // drop(t): descent from the face over t in [0,L] cells from the start.
  // round -> circular quarter-arc (1 - sqrt(1-x^2)): flat shoulder up top, a full
  // round bulge, steepening to the toe. Convex, so chord clipping stays exact.
  const drop = (t) => {
    const x = Math.max(0, Math.min(1, t / L));
    const r = op.round ? (1 - Math.sqrt(1 - x * x)) : x;
    return r * Dp * fU;
  };
  const surf = (b) => faceLevel - fs * drop(tAt(b));   // surface coord at boundary b

  // sub-steps per cell: a straight ramp needs 1 (it is exactly planar); a curve
  // gets many so the facets disappear. Sample boundaries from `start` toward dir.
  const sub = Math.max(1, (op.seg | 0) || (op.round ? 8 : 1));
  const n = L * sub;
  const planes = [];
  let cA = lCoord(start), sA = surf(start);
  for (let i = 1; i <= n; i++) {
    const b = start + ls * (i / sub);
    const cB = lCoord(b), sB = surf(b);
    const pl = planeThrough(cA, sA, cB, sB, la, fa, fs);
    if (pl) planes.push(pl);
    cA = cB; sA = sB;
  }
  return planes;
}

// half-space through surface points (cA,sA),(cB,sB) in the (la,fa) plane, normal
// pointing outward along +fs; keep material on the -n side (n·p <= d).
function planeThrough(cA, sA, cB, sB, la, fa, fs) {
  const dl = cB - cA, df = sB - sA;
  let nl = -df * fs, nf = dl * fs;
  if (nf * fs < 0) { nl = -nl; nf = -nf; }       // outward along +fs
  const v = [0, 0, 0]; v[la] = nl; v[fa] = nf;
  const nn = norm(v);
  if (!isFinite(nn[0]) || (Math.abs(nl) < EPS && Math.abs(nf) < EPS)) return null;
  const pt = [0, 0, 0]; pt[la] = cA; pt[fa] = sA;
  return { n: nn, d: dot(nn, pt) };
}

function pushTest(op, W, H, D) {
  const dims = [W, H, D];
  const fa = AXES[op.face[0]];
  const fs = op.face[1] === "+" ? 1 : -1;
  // in-plane axes per face axis
  const planeAxes = fa === 0 ? [2, 1] : fa === 1 ? [0, 2] : [0, 1]; // [width, height]
  const [ua, va] = planeAxes;
  const depth = Math.max(1, op.depth | 0);
  const wN = Math.max(1, op.width | 0);
  const hN = Math.max(1, op.height | 0);
  const [au, av] = op.at ?? [0, 0];
  // face-normal cell range
  const f0 = fs > 0 ? dims[fa] - depth : 0;
  const f1 = fs > 0 ? dims[fa] - 1 : depth - 1;
  return (idx) => {
    const fi = idx[fa]; if (fi < f0 || fi > f1) return false;
    const ui = idx[ua]; if (ui < au || ui > au + wN - 1) return false;
    const vi = idx[va]; if (vi < av || vi > av + hN - 1) return false;
    return true;
  };
}

// Round the 4 vertical edges of the box. The footprint becomes a rounded
// rectangle (convex): the straight faces come from the cell cubes, these chords
// add the corner arcs. radius defaults to half a stud, clamped to min(hw,hd) —
// so a 1x1 (hw=hd=0.5) rounds to a full cylinder. Planes are Y-invariant, so the
// whole height of every cell is clipped. `def.round` enables; `def.cornerR`
// (studs) and `def.cornerSeg` tune radius and smoothness.
function cornerPlanes(def, W, D) {
  if (!def.round) return [];
  const hw = W / 2, hd = D / 2;
  const r = Math.min(hw, hd, def.cornerR ?? 0.5);
  if (r <= EPS) return [];
  const seg = Math.max(2, (def.cornerSeg | 0) || 8);
  const planes = [];
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const cx = sx * (hw - r), cz = sz * (hd - r);   // arc center, inset from corner
    let px = cx + sx * r, pz = cz;                   // phi=0: tangent to the x face
    for (let i = 1; i <= seg; i++) {
      const phi = (i / seg) * (Math.PI / 2);
      const qx = cx + sx * r * Math.cos(phi), qz = cz + sz * r * Math.sin(phi);
      let nx = qz - pz, nz = -(qx - px);             // perp to the chord
      if (nx * ((px + qx) / 2 - cx) + nz * ((pz + qz) / 2 - cz) < 0) { nx = -nx; nz = -nz; }
      const len = Math.hypot(nx, nz) || 1; nx /= len; nz /= len;
      planes.push({ n: [nx, 0, nz], d: nx * px + nz * pz });   // keep material inside
      px = qx; pz = qz;
    }
  }
  return planes;
}

const studGeo = (r = STUD_R, h = STUD_H, radial = 20) => cylinderGeometry(r, r, h, radial);

function rotateGeo(g, axis, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (const key of ["position", "normal"]) {
    const a = g.attributes[key].array;
    for (let i = 0; i < a.length; i += 3) {
      const x = a[i], y = a[i + 1], z = a[i + 2];
      if (axis === "y") { a[i] = c * x + s * z; a[i + 2] = -s * x + c * z; }
      else if (axis === "z") { a[i] = c * x - s * y; a[i + 1] = s * x + c * y; }
      else { a[i + 1] = c * y - s * z; a[i + 2] = s * y + c * z; }
    }
  }
  return g;
}

// in-plane cell grid [U,V] of a face: y -> X*Z, x -> Z*Y, z -> X*Y. (u,v) match
// faceIntact's pax order, so the same indices drive geometry, the connector map,
// and the lattice queries.
const faceGrid = (fa, W, H, D) => (fa === 1 ? [W, D] : fa === 0 ? [D, H] : [W, H]);

// Which face cells (u,v) a studs-op covers. Top/bottom honour the full `at`
// selector over the X*Z grid; side faces only ever populate the mid-height row
// (vertical SNOT columns are out of scope), so `at.cell[0]` selects a column.
function studHits(op, W, H, D) {
  const fa = AXES[(op.face ?? "y+")[0]];
  if (fa === 1) {
    return (u, v) => {
      if (!op.at) return true;
      if ("cell" in op.at) return u === op.at.cell[0] && v === op.at.cell[1];
      if ("row" in op.at) return v === op.at.row;
      if ("col" in op.at) return u === op.at.col;
      return true;
    };
  }
  const jMid = Math.min(H - 1, Math.floor(H / 2)); // layer holding y=0
  return (u, v) => {
    if (v !== jMid) return false;
    if (op.at && "cell" in op.at) return u === op.at.cell[0];
    return true;
  };
}

// build male studs for a studs-op. `intact(fa,fs,u,v)` reports whether the
// boundary cell at that face position survived every cut with a flat, full outer
// face; studs are only grown there, so cells sliced by a slope or removed by a
// push are skipped automatically. (Female ops carve holes in the mesher instead.)
function buildStuds(op, W, H, D, intact) {
  const out = [];
  const face = op.face ?? "y+";          // default studs to the top face
  const fa = AXES[face[0]];
  const fs = face[1] === "+" ? 1 : -1;
  const hw = W / 2, hd = D / 2, hh = (H / 2) * PLATE_H;
  const hit = studHits(op, W, H, D);

  if (fa === 1) {                                  // top / bottom: X*Z grid
    const dir = fs;
    for (let u = 0; u < W; u++) for (let v = 0; v < D; v++) {
      if (!hit(u, v) || !intact(fa, fs, u, v)) continue;
      const x = u + 0.5 - hw, z = v + 0.5 - hd;
      const y = dir * (hh + STUD_H / 2);
      const s = studGeo();
      if (dir < 0) rotateGeo(s, "x", Math.PI);
      out.push(s.translate(x, y, z));
    }
    return out;
  }

  // side faces: studs only (the mid row that hit() allows); sockets on walls
  // would need explicit geometry and are out of scope.
  const [U, V] = faceGrid(fa, W, H, D);
  for (let u = 0; u < U; u++) for (let v = 0; v < V; v++) {
    if (!hit(u, v) || !intact(fa, fs, u, v)) continue;
    const s = studGeo();
    let x = 0, z = 0;
    if (fa === 0) {                                // left/right (u = z)
      x = fs * (hw + STUD_H / 2); z = u + 0.5 - hd;
      rotateGeo(s, "z", -fs * Math.PI / 2);
    } else {                                       // front/back (u = x)
      z = fs * (hd + STUD_H / 2); x = u + 0.5 - hw;
      rotateGeo(s, "x", fs * Math.PI / 2);
    }
    out.push(s.translate(x, 0, z));
  }
  return out;
}

// two polygons share the same vertex set (order-independent, within EPS)
function samePoly(a, b) {
  if (a.length !== b.length) return false;
  return a.every((p) => b.some((q) =>
    Math.abs(p[0] - q[0]) < 1e-5 && Math.abs(p[1] - q[1]) < 1e-5 && Math.abs(p[2] - q[2]) < 1e-5));
}

// index of the outer face in cellFaces() output, per face axis (+1 for + side)
const OUTER_FACE = { 0: 2, 1: 4, 2: 0 };

const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vscale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];

// Reverse a polygon's winding if needed so its face normal points along `want`.
// Keeps the CCW-outward convention cellFaces uses, so facesToGeometry derives the
// right normal regardless of how the points were generated.
function windTo(poly, want) {
  const n = norm(cross(sub(poly[1], poly[0]), sub(poly[2], poly[0])));
  return n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0 ? poly.slice().reverse() : poly;
}

const HOLE_DEPTH = STUD_H;   // an anti-stud hole as deep as a male stud is tall

// Anti-stud hole pushed into one face cell: replaces the flat cap with a ring
// (the cell square minus a disk), a cylindrical wall sunk into the body, and a
// floor. P = face-cell center on the surface, n = outward face normal, e1/e2 =
// unit in-plane axes with world half-extents a/b. A male stud from the mating
// brick seats into this recess.
function holeFaces(P, n, e1, e2, a, b, seg = 16) {
  const R = Math.min(STUD_R, 0.85 * Math.min(a, b));
  const into = vscale(n, -HOLE_DEPTH);
  const circ = (ang) => vadd(P, vadd(vscale(e1, R * Math.cos(ang)), vscale(e2, R * Math.sin(ang))));
  const square = (ang) => {                       // ray from center to the cell edge
    const c = Math.cos(ang), s = Math.sin(ang);
    const t = Math.min(a / (Math.abs(c) || 1e-9), b / (Math.abs(s) || 1e-9));
    return vadd(P, vadd(vscale(e1, t * c), vscale(e2, t * s)));
  };
  const radialIn = (ang) => norm(vscale(vadd(vscale(e1, Math.cos(ang)), vscale(e2, Math.sin(ang))), -1));
  const bottom = vadd(P, into);
  const polys = [];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * 2 * Math.PI, a1 = ((i + 1) / seg) * 2 * Math.PI;
    const co0 = circ(a0), co1 = circ(a1);
    const cb0 = vadd(co0, into), cb1 = vadd(co1, into);
    polys.push(windTo([square(a0), square(a1), co1, co0], n));        // ring on the surface
    polys.push(windTo([co0, co1, cb1, cb0], radialIn((a0 + a1) / 2))); // wall, facing in
    polys.push(windTo([cb0, cb1, bottom], n));                        // floor, facing out
  }
  return polys;
}

// Place an anti-stud hole at solid cell (i,j,k) on face (fa,fs). y in plate units.
function holeForCell(i, j, k, fa, fs, W, H, D) {
  const hw = W / 2, hd = D / 2, hh = (H / 2) * PLATE_H;
  const x = i + 0.5 - hw, z = k + 0.5 - hd, y = (j + 0.5 - H / 2) * PLATE_H;
  if (fa === 1) return holeFaces([x, fs * hh, z], [0, fs, 0], [1, 0, 0], [0, 0, 1], 0.5, 0.5);
  if (fa === 0) return holeFaces([fs * hw, y, z], [fs, 0, 0], [0, 0, 1], [0, 1, 0], 0.5, 0.5 * PLATE_H);
  return holeFaces([x, y, fs * hd], [0, 0, fs], [1, 0, 0], [0, 1, 0], 0.5, 0.5 * PLATE_H);
}

function facesToGeometry(faceList) {
  const pos = [], nor = [];
  for (const f of faceList) {
    if (f.length < 3) continue;
    const n = norm(cross(sub(f[1], f[0]), sub(f[2], f[0])));
    for (let i = 1; i < f.length - 1; i++) {
      for (const p of [f[0], f[i], f[i + 1]]) { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); }
    }
  }
  const uv = new Float32Array((pos.length / 3) * 2);
  return new Geometry()
    .setAttribute("position", new Float32Array(pos), 3)
    .setAttribute("normal", new Float32Array(nor), 3)
    .setAttribute("uv", uv, 2);
}

// Evaluate a def into the shared shape data both the mesher and the lattice
// queries read. CUTS FIRST: push + slope are gathered up front so studs (and the
// connector map) see the post-cut shape regardless of op list order.
function evalShape(def) {
  const W = Math.max(1, (def.size?.[0] ?? 2) | 0);
  const H = Math.max(1, (def.size?.[1] ?? 3) | 0);
  const D = Math.max(1, (def.size?.[2] ?? 2) | 0);
  const ops = def.ops ?? [];
  const dims = [W, H, D];
  const slopeOps = ops.filter((o) => o.op === "slope").map((o) => slopePlanes(o, W, H, D));
  const pushOps = ops.filter((o) => o.op === "push").map((o) => pushTest(o, W, H, D));
  const studOps = ops.filter((o) => o.op === "studs");
  // rounded vertical corners are a property of the base box, applied to every
  // cell. faceIntact ignores them (uses only slope/push), so a 1x1 cylinder
  // still keeps its stud.
  const corners = cornerPlanes(def, W, D);

  // does the boundary cell at face (fa,fs), in-plane index (u,v), still have a
  // flat, full outer face after every cut? used to skip studs on uneven cells
  // and to mark carved cells as 'none' in the connector map.
  function faceIntact(fa, fs, u, v) {
    const idx = [0, 0, 0];
    idx[fa] = fs > 0 ? dims[fa] - 1 : 0;
    const pax = fa === 0 ? [2, 1] : fa === 1 ? [0, 2] : [0, 1];
    idx[pax[0]] = u; idx[pax[1]] = v;
    if (idx[pax[0]] < 0 || idx[pax[0]] >= dims[pax[0]]) return false;
    if (idx[pax[1]] < 0 || idx[pax[1]] >= dims[pax[1]]) return false;
    if (pushOps.some((t) => t(idx))) return false;            // carved away
    const orig = cellFaces(idx[0], idx[1], idx[2], W, H, D)[OUTER_FACE[fa] + (fs > 0 ? 1 : 0)];
    let faces = cellFaces(idx[0], idx[1], idx[2], W, H, D);
    for (const planes of slopeOps) {
      for (const pl of planes) {
        faces = clipSolid(faces, pl.n, pl.d);
        if (!faces.length) return false;
      }
    }
    return faces.some((f) => samePoly(f, orig));              // outer face survived intact
  }

  return { W, H, D, dims, slopeOps, pushOps, studOps, corners, faceIntact };
}

const FACES6 = ["y+", "y-", "x+", "x-", "z+", "z-"];

// Connector classification per face cell — the queryable "stud map".
export const CONN = { none: 0, flat: 1, socket: 2, male: 3 };

// partConnectors(def): for each of the 6 faces, a U*V grid (row-major v*U+u) of
// CONN values. 'male' = a stud protrudes, 'socket' = a recess that receives a
// stud (female studs op), 'flat' = a smooth solid wall (no clutch), 'none' = no
// surface (cell carved away by push/slope). This is the single source of truth
// for mating: a stud (male) clutches into a socket on the opposing face.
export function partConnectors(def) {
  const { W, H, D, studOps, faceIntact } = evalShape(def);
  const faces = {};
  for (const face of FACES6) {
    const fa = AXES[face[0]], fs = face[1] === "+" ? 1 : -1;
    const [U, V] = faceGrid(fa, W, H, D);
    const hits = studOps
      .filter((o) => (o.face ?? "y+") === face)
      .map((o) => ({ male: o.kind !== "female", hit: studHits(o, W, H, D) }));
    const grid = new Uint8Array(U * V);
    for (let u = 0; u < U; u++) for (let v = 0; v < V; v++) {
      if (!faceIntact(fa, fs, u, v)) { grid[v * U + u] = CONN.none; continue; }
      let val = CONN.flat;
      for (const { male, hit } of hits) if (hit(u, v)) { val = male ? CONN.male : CONN.socket; break; }
      grid[v * U + u] = val;
    }
    faces[face] = { U, V, grid };
  }
  return { W, H, D, faces };
}

// Solid cells of a part (cell-space indices not removed by a push), plus the
// box dims. Slope-sliced cells are kept (still occupy most of their volume) —
// conservative for collision tests. Used to build a world occupancy grid.
export function solidCells(def) {
  const { W, H, D, pushOps } = evalShape(def);
  const cells = [];
  for (let i = 0; i < W; i++)
    for (let j = 0; j < H; j++)
      for (let k = 0; k < D; k++)
        if (!pushOps.some((t) => t([i, j, k]))) cells.push([i, j, k]);
  return { W, H, D, cells };
}

export function makeSolid(def) {
  const { W, H, D, slopeOps, pushOps, studOps, corners, faceIntact } = evalShape(def);
  // female studs become anti-stud holes: each replaces a flat outer cap with a
  // recessed cylinder. Marked per boundary cell so the cap can be dropped below.
  const femaleOps = studOps
    .filter((o) => o.kind === "female")
    .map((o) => { const f = o.face ?? "y+"; return { fa: AXES[f[0]], fs: f[1] === "+" ? 1 : -1, hit: studHits(o, W, H, D) }; });

  const allFaces = [];
  for (let i = 0; i < W; i++)
    for (let j = 0; j < H; j++)
      for (let k = 0; k < D; k++) {
        const idx = [i, j, k];
        if (pushOps.some((t) => t(idx))) continue;       // carved away
        let faces = cellFaces(i, j, k, W, H, D);
        for (const planes of slopeOps) {
          for (const pl of planes) {
            faces = clipSolid(faces, pl.n, pl.d);
            if (!faces.length) break;
          }
          if (!faces.length) break;
        }
        for (const pl of corners) {
          if (!faces.length) break;
          faces = clipSolid(faces, pl.n, pl.d);
        }
        // punch anti-stud holes: drop the flat cap on a female boundary cell and
        // add the recess. Only where the cap survived intact (skips sloped/rounded
        // cells, whose cap won't match) so no orphan hole is left floating.
        for (const fop of femaleOps) {
          if (idx[fop.fa] !== (fop.fs > 0 ? [W, H, D][fop.fa] - 1 : 0)) continue;
          const pax = fop.fa === 0 ? [2, 1] : fop.fa === 1 ? [0, 2] : [0, 1];
          const u = idx[pax[0]], v = idx[pax[1]];
          if (!fop.hit(u, v) || !faceIntact(fop.fa, fop.fs, u, v)) continue;
          const orig = cellFaces(i, j, k, W, H, D)[OUTER_FACE[fop.fa] + (fop.fs > 0 ? 1 : 0)];
          const before = faces.length;
          faces = faces.filter((f) => !samePoly(f, orig));
          if (faces.length < before) allFaces.push(...holeForCell(i, j, k, fop.fa, fop.fs, W, H, D));
        }
        if (faces.length) allFaces.push(...faces);
      }

  const geos = [facesToGeometry(allFaces)];
  for (const op of studOps) if (op.kind !== "female") geos.push(...buildStuds(op, W, H, D, faceIntact));
  return mergeGeometries(geos);
}

// quick builders for common parts in the new op model
export const PRESETS = {
  brick: (W, D) => ({ size: [W, 3, D], ops: [{ op: "studs", face: "y+" }, { op: "studs", face: "y-", kind: "female" }] }),
  plate: (W, D) => ({ size: [W, 1, D], ops: [{ op: "studs", face: "y+" }, { op: "studs", face: "y-", kind: "female" }] }),
  tile: (W, D) => ({ size: [W, 1, D], ops: [] }),
  slope: (W, D) => ({ size: [W, 3, D], ops: [
    { op: "slope", face: "y+", dir: 1, length: D - 1, depth: 2 },
    { op: "studs", face: "y+", at: { row: 0 } },
  ] }),
  curve: (W, D) => ({ size: [W, 3, D], ops: [
    { op: "slope", face: "y+", dir: 1, length: D, depth: 2, round: true },
    { op: "studs", face: "y+", at: { row: 0 } },
  ] }),
};
