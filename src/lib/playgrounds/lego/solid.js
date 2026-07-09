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
//   ball   { op:"ball", face, kind?, at? }    3-DOF spherical joint
//   hinge  { op:"hinge", face, kind?, at? }   1-DOF revolute joint
//       Same face/kind/at selector as studs. Ball: male = sphere on a neck,
//       female = a spherical socket CARVED into the cell. Hinge: male = barrel,
//       female = clevis. (Hinge hardware is additive; only the ball socket cuts.)
//       The articulation itself lives on the CONNECTION (assembly.js `jointRot`):
//       a `joint:"ball"` link rotates B freely about the seat; `joint:"hinge"`
//       limits it to one axis. Joint ops are ignored by the connector/mate map.
//
// Body centered at origin. X/Z pitch = 1 world unit/stud. Y unit = PLATE_H.
// Cells are unit cubes (in cell space); a cell may be removed (push) or sliced
// by one or more half-space planes (slope). Internal faces are left in place —
// they are occluded by the opaque solid, so no face culling is needed.

import {
  Geometry, boxGeometry, cylinderGeometry, mergeGeometries,
} from "$lib/engine/index.js";
import {
  vAdd as vadd, vSub as sub, vScale as vscale, vCross as cross, vNorm as norm,
  vDot as dot, m3Rot, m3AxisAngle,
} from "../../math/mat3.js";

export const PLATE_H = 0.4;
const STUD_R = 0.3, STUD_H = 0.2;
const STUD_NECK_R = 0.2, STUD_NECK_H = 0.14;   // stick tip -> stud transition
// ball joint: a sphere on a thin neck (male) / a raised socket ring (female).
const BALL_R = 0.32, NECK_R = 0.14, NECK_H = 0.16;
// hinge joint: a knuckle (ring) standing off the face, pierced by a PIN (the stick
// that runs through the hole). Four flavours via kind + shape:
//   male   + O : one closed ring        male   + C : one C-arc ring (snap-in gap)
//   female + O : two closed rings (U)    female + C : two C-arc rings (U)
// A female is a U clevis of two knuckles in series; the gap between its arms fits
// one male knuckle, and the stick pierces every ring. 1-DOF: swings about the pin.
const KN_RO = 0.34, KN_RI = 0.22, KN_TH = 0.22;   // knuckle outer/inner radius, width along pin
const KN_GAP = 0.06;                               // clearance between interleaved knuckles
const HINGE_NECK_R = 0.12, HINGE_NECK_H = 0.12;   // stick/face -> hinge transition (< ROD_R 0.2)
// distance from the mount surface to the ring center (the hinge swing pivot): male
// = the single ring, female = the midpoint of the two rings. Same offset for both.
const HINGE_PIVOT = HINGE_NECK_H + KN_RO;
// ball-joint pivot: distance from surface to the sphere center.
const BALL_PIVOT = NECK_H + BALL_R;
const EPS = 1e-6;

const AXES = { x: 0, y: 1, z: 2 };
// face string -> [axis index, outer side sign], e.g. "z-" -> [2, -1]
const parseFace = (f = "y+") => [AXES[f[0]], f[1] === "+" ? 1 : -1];
// in-plane axes [u, v] per face axis: x -> (z,y), y -> (x,z), z -> (x,y)
const PAX = [[2, 1], [0, 2], [0, 1]];
// per-axis world unit: Y measured in plates, X/Z in studs
const unit = (ax) => (ax === 1 ? PLATE_H : 1);
// row-major 3x3 from three column vectors
export const matCols = (a, b, c) => [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];

// Footprint of a spec's integer box, size = [W(studs X), H(plates Y), D(studs Z)],
// clamped/floored exactly like the mesher so seating and rendering always agree.
export function dims(spec) {
  const sx = Math.max(1, (spec.size?.[0] ?? 2) | 0);
  const sy = Math.max(1, (spec.size?.[1] ?? 3) | 0);
  const sz = Math.max(1, (spec.size?.[2] ?? 2) | 0);
  const h = sy * PLATE_H;
  return { sx, sy, sz, h, hw: sx / 2, hd: sz / 2, hh: h / 2 };
}

// convex polyhedron, stored as a list of CCW-outward polygon faces
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
// converges to the true quarter-cosine.
function slopePlanes(op, W, H, D) {
  const size = [W, H, D];
  const [fa, fs] = parseFace(op.face);         // face axis index + outer side sign
  const la = RUN_AXIS[fa];                     // run axis, deduced from face
  const ls = op.dir >= 0 ? 1 : -1;             // boundary the ramp descends to
  const Dp = Math.max(1, op.depth | 0);
  const fU = unit(fa), lU = unit(la);
  const faceLevel = fs * (size[fa] / 2) * fU;  // world coord of the face

  const dim = size[la];
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
  const sub = op.round ? 8 : 1;
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
  const size = [W, H, D];
  const [fa, fs] = parseFace(op.face);
  const [ua, va] = PAX[fa];                    // in-plane axes [width, height]
  const depth = Math.max(1, op.depth | 0);
  const wN = Math.max(1, op.width | 0);
  const hN = Math.max(1, op.height | 0);
  const [au, av] = op.at ?? [0, 0];
  // face-normal cell range
  const f0 = fs > 0 ? size[fa] - depth : 0;
  const f1 = fs > 0 ? size[fa] - 1 : depth - 1;
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
// (studs) tunes the radius.
function cornerPlanes(def, W, D) {
  if (!def.round) return [];
  const hw = W / 2, hd = D / 2;
  const r = Math.min(hw, hd, def.cornerR ?? 0.5);
  if (r <= EPS) return [];
  const seg = 8;
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

// engine primitives carry a uv attribute the lego shader never binds; strip it so
// every lego geometry shares the same {position, normal} attribute set (which is
// what mergeGeometries expects: it merges the attributes of the FIRST geo).
const stripUV = (g) => { delete g.attributes.uv; return g; };
const cyl = (...a) => stripUV(cylinderGeometry(...a));
const box = (...a) => stripUV(boxGeometry(...a));

const studGeo = (r = STUD_R, h = STUD_H, radial = 20) => cyl(r, r, h, radial);

// apply a row-major 3x3 to a geo's position+normal in place, translating position by t
function applyMat3(g, m, t = [0, 0, 0]) {
  for (const key of ["position", "normal"]) {
    const a = g.attributes[key].array;
    const [tx, ty, tz] = key === "position" ? t : [0, 0, 0];
    for (let i = 0; i < a.length; i += 3) {
      const x = a[i], y = a[i + 1], z = a[i + 2];
      a[i] = m[0] * x + m[1] * y + m[2] * z + tx;
      a[i + 1] = m[3] * x + m[4] * y + m[5] * z + ty;
      a[i + 2] = m[6] * x + m[7] * y + m[8] * z + tz;
    }
  }
  return g;
}

const rotateGeo = (g, axis, ang) => applyMat3(g, m3Rot(axis, ang));

// in-plane cell grid [U,V] of a face: y -> X*Z, x -> Z*Y, z -> X*Y. (u,v) match
// faceIntact's pax order, so the same indices drive geometry and the mesher.
const faceGrid = (fa, ...size) => PAX[fa].map((a) => size[a]);

// Which face cells (u,v) a studs-op covers. Top/bottom honour the full `at`
// selector over the X*Z grid; side faces only ever populate the mid-height row
// (vertical SNOT columns are out of scope), so `at.cell[0]` selects a column.
function studHits(op, W, H, D) {
  const [fa] = parseFace(op.face);
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
  const [fa, fs] = parseFace(op.face);   // default studs to the top face
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

// All builders below emit ADDITIVE geometry (no boolean carving): the part is
// rendered with one flat color, so the hardware just sits proud of / on the
// face. Mating/validation ignores joint ops (only studs feed the connector map);
// the actual articulation is applied at assembly time (assembly.js `jointRot`).

// UV sphere centered at origin (position + outward normal).
function sphereGeometry(r = 0.5, seg = 16, rings = 10) {
  const vert = (i, j) => {
    const th = (i / rings) * Math.PI, ph = (j / seg) * 2 * Math.PI;
    return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
  };
  return soup((tri) => {
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i + 1, j + 1), d = vert(i, j + 1);
      for (const p of [a, b, d, b, c, d]) tri(vscale(p, r), p);
    }
  });
}

// assemble a triangle-soup geometry from a push() callback
function soup(emit) {
  const pos = [], nor = [];
  emit((p, n) => { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); });
  return new Geometry()
    .setAttribute("position", new Float32Array(pos), 3)
    .setAttribute("normal", new Float32Array(nor), 3);
}

// Hollow hemisphere shell (dome): bulges +Y, open toward -Y. Outer + inner walls
// + an equator rim. A female ball joint = this dome capping over a male ball.
function domeShell(R, t, seg = 16, rings = 6) {
  const pt = (rad, th, ph) => [rad * Math.sin(th) * Math.cos(ph), rad * Math.cos(th), rad * Math.sin(th) * Math.sin(ph)];
  return soup((tri) => {
    const quad = (a, b, c, d, nf) => { for (const p of [a, b, d, b, c, d]) tri(p, nf(p)); };
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
      const t0 = (i / rings) * (Math.PI / 2), t1 = ((i + 1) / rings) * (Math.PI / 2);
      const p0 = (j / seg) * 2 * Math.PI, p1 = ((j + 1) / seg) * 2 * Math.PI;
      quad(pt(R, t0, p0), pt(R, t1, p0), pt(R, t1, p1), pt(R, t0, p1), (p) => norm(p));           // outer
      quad(pt(R - t, t0, p1), pt(R - t, t1, p1), pt(R - t, t1, p0), pt(R - t, t0, p0), (p) => norm(vscale(p, -1))); // inner
    }
    for (let j = 0; j < seg; j++) {                          // equator rim (y=0), facing -Y
      const p0 = (j / seg) * 2 * Math.PI, p1 = ((j + 1) / seg) * 2 * Math.PI;
      quad(pt(R, Math.PI / 2, p0), pt(R, Math.PI / 2, p1), pt(R - t, Math.PI / 2, p1), pt(R - t, Math.PI / 2, p0), () => [0, -1, 0]);
    }
  });
}

// Extruded ring (straight-walled hollow tube) along +Y: outer + inner walls and
// flat top/bottom rims. A female stud receiver collar — a male stud passes the
// hole. (Same shape as a full-sweep Y-axis knuckle, but NOT delegated to it:
// knuckle smears wall normals across a segment where this keeps them exact.)
function tubeRing(rOut, rIn, h, seg = 20) {
  const hh = h / 2;
  const P = (r, y, a) => [r * Math.cos(a), y, r * Math.sin(a)];
  return soup((tri) => {
    const quad = (a, b, c, d, na, nb) => { tri(a, na); tri(b, nb); tri(d, na); tri(b, nb); tri(c, nb); tri(d, na); };
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * 2 * Math.PI, a1 = ((i + 1) / seg) * 2 * Math.PI;
      const o0 = [Math.cos(a0), 0, Math.sin(a0)], o1 = [Math.cos(a1), 0, Math.sin(a1)];
      quad(P(rOut, -hh, a0), P(rOut, -hh, a1), P(rOut, hh, a1), P(rOut, hh, a0), o0, o1);           // outer wall
      quad(P(rIn, -hh, a1), P(rIn, -hh, a0), P(rIn, hh, a0), P(rIn, hh, a1), vscale(o1, -1), vscale(o0, -1)); // inner wall
      for (const [y, ny] of [[hh, [0, 1, 0]], [-hh, [0, -1, 0]]]) {                                  // rims
        const w = ny[1] > 0 ? [P(rIn, y, a0), P(rOut, y, a0), P(rOut, y, a1), P(rIn, y, a1)]
          : [P(rIn, y, a1), P(rOut, y, a1), P(rOut, y, a0), P(rIn, y, a0)];
        tri(w[0], ny); tri(w[1], ny); tri(w[2], ny); tri(w[0], ny); tri(w[2], ny); tri(w[3], ny);
      }
    }
  });
}

// Local-space frame of a face cell (u,v): surface center P, outward normal n,
// and the two in-plane unit tangents e1 (u axis) / e2 (v axis). Mirrors the
// layout buildStuds / localConnectors use.
function faceCellFrame(fa, fs, u, v, W, H, D) {
  const hw = W / 2, hd = D / 2, hh = (H / 2) * PLATE_H;
  if (fa === 1) return { P: [u + 0.5 - hw, fs * hh, v + 0.5 - hd], n: [0, fs, 0], e1: [1, 0, 0], e2: [0, 0, 1] };
  if (fa === 0) return { P: [fs * hw, (v + 0.5 - H / 2) * PLATE_H, u + 0.5 - hd], n: [fs, 0, 0], e1: [0, 0, 1], e2: [0, 1, 0] };
  return { P: [u + 0.5 - hw, (v + 0.5 - H / 2) * PLATE_H, fs * hd], n: [0, 0, fs], e1: [1, 0, 0], e2: [0, 1, 0] };
}

// iterate the hit + intact face cells of a joint op (shared by ball/hinge).
// `hit(u,v)` defaults to the studs-op selector; buildHinge passes its own
// full-grid selector instead (see the comment there).
function eachJointCell(op, W, H, D, intact, cb, hit = studHits(op, W, H, D)) {
  const [fa, fs] = parseFace(op.face);
  const [U, V] = faceGrid(fa, W, H, D);
  for (let u = 0; u < U; u++) for (let v = 0; v < V; v++) {
    if (!hit(u, v) || !intact(fa, fs, u, v)) continue;
    cb(faceCellFrame(fa, fs, u, v, W, H, D), fa, fs);
  }
}

// male ball hardware: a transition neck + sphere standing off P along n
function ballMale(P, n) {
  const at = (g, d) => g.translate(P[0] + n[0] * d, P[1] + n[1] * d, P[2] + n[2] * d);
  return [
    at(alignToDir(cyl(NECK_R, NECK_R, NECK_H, 12), n), NECK_H / 2),
    at(sphereGeometry(BALL_R, 16, 10), NECK_H + BALL_R),
  ];
}

// male ball joint: a neck + sphere standing off the face. (Female balls are a
// carved spherical socket, handled in the mesher's cell loop — see socketFaces.)
function buildBalls(op, W, H, D, intact) {
  const out = [];
  if (op.kind === "female") return out;          // carved, not additive
  eachJointCell(op, W, H, D, intact, ({ P, n }) => out.push(...ballMale(P, n)));
  return out;
}

// remap a geo's local x/y/z onto orthonormal world axes ex/ey/ez and translate to c
const transformGeo = (g, ex, ey, ez, c) => applyMat3(g, matCols(ex, ey, ez), c);
// axis-aligned box in the (ax,ay,az) frame, centered at `center`, half-extents h*
const slab = (center, ax, ay, az, hx, hy, hz) =>
  transformGeo(box(2 * hx, 2 * hy, 2 * hz), ax, ay, az, center);

// transition neck (80% radius) standing off the surface/tip P along n, under the
// hinge. Shared by male + female so both lift off the stick on the same stub.
const hingeNeck = (P, n) => alignToDir(cyl(HINGE_NECK_R, HINGE_NECK_R, HINGE_NECK_H, 14), n)
  .translate(P[0] + n[0] * HINGE_NECK_H / 2, P[1] + n[1] * HINGE_NECK_H / 2, P[2] + n[2] * HINGE_NECK_H / 2);

// One knuckle: an annular ring (or C-arc) around `pin`, lying in the plane spanned
// by unit axes A,B (both perp to pin and to each other). Outer/inner radius ro/ri,
// width `th` along pin, centered at c. Material swept from angle a0..a1 measured
// from +A toward +B; a full sweep closes the seam, a partial arc caps the two cut
// faces (that gap is the "C" mouth). Additive triangle soup.
function knuckle(c, pin, A, B, ro, ri, th, a0, a1, seg = 24) {
  const full = a1 - a0 >= Math.PI * 2 - 1e-4;
  const hp = th / 2;
  const dir = (a) => [Math.cos(a) * A[0] + Math.sin(a) * B[0], Math.cos(a) * A[1] + Math.sin(a) * B[1], Math.cos(a) * A[2] + Math.sin(a) * B[2]];
  const pt = (r, a, s) => { const d = dir(a); return [c[0] + r * d[0] + s * hp * pin[0], c[1] + r * d[1] + s * hp * pin[1], c[2] + r * d[2] + s * hp * pin[2]]; };
  const npin = vscale(pin, -1);
  return soup((tri) => {
    const quad = (p1, p2, p3, p4, n1, n2) => { tri(p1, n1); tri(p2, n2); tri(p4, n1); tri(p2, n2); tri(p3, n2); tri(p4, n1); };
    for (let i = 0; i < seg; i++) {
      const t0 = a0 + (a1 - a0) * (i / seg), t1 = a0 + (a1 - a0) * ((i + 1) / seg);
      const d0 = dir(t0), d1 = dir(t1), nd0 = vscale(d0, -1), nd1 = vscale(d1, -1);
      quad(pt(ro, t0, -1), pt(ro, t0, 1), pt(ro, t1, 1), pt(ro, t1, -1), d0, d1);     // outer wall
      quad(pt(ri, t0, 1), pt(ri, t0, -1), pt(ri, t1, -1), pt(ri, t1, 1), nd0, nd1);   // inner wall
      quad(pt(ri, t0, 1), pt(ro, t0, 1), pt(ro, t1, 1), pt(ri, t1, 1), pin, pin);     // +pin rim
      quad(pt(ro, t0, -1), pt(ri, t0, -1), pt(ri, t1, -1), pt(ro, t1, -1), npin, npin); // -pin rim
    }
    if (!full) for (const [a, sgn] of [[a0, -1], [a1, 1]]) {        // cap the two C-mouth faces
      const nf = vscale(norm([-Math.sin(a) * A[0] + Math.cos(a) * B[0], -Math.sin(a) * A[1] + Math.cos(a) * B[1], -Math.sin(a) * A[2] + Math.cos(a) * B[2]]), sgn);
      const p1 = pt(ri, a, -1), p2 = pt(ro, a, -1), p3 = pt(ro, a, 1), p4 = pt(ri, a, 1);
      if (sgn > 0) { tri(p1, nf); tri(p2, nf); tri(p3, nf); tri(p1, nf); tri(p3, nf); tri(p4, nf); }
      else { tri(p1, nf); tri(p3, nf); tri(p2, nf); tri(p1, nf); tri(p4, nf); tri(p3, nf); }
    }
  });
}

// C-arc covers a 270deg sweep, leaving a 90deg mouth centered on +A (= outward, +n).
const knuckleArc = (shape) => (shape === "C" ? [Math.PI / 4, Math.PI * 7 / 4] : [0, Math.PI * 2]);

// male hinge: a single knuckle (C or O) on a neck, lifted off P along n, pierced
// by `pin`. A is +n (so a C mouth opens outward); B completes the ring plane.
function hingeMaleKnuckle(P, n, pin, shape) {
  const B = norm(cross(pin, n));
  const c = vadd(P, vscale(n, HINGE_NECK_H + KN_RO));
  const [a0, a1] = knuckleArc(shape);
  return [hingeNeck(P, n), knuckle(c, pin, n, B, KN_RO, KN_RI, KN_TH, a0, a1)];
}

// female hinge: a U clevis of two knuckles (C or O) spaced along `pin`, joined by a
// back base slab + neck. The gap between the arms fits one male knuckle; the stick
// pierces every ring.
function hingeFemaleDouble(P, n, pin, shape, span = 1) {
  const B = norm(cross(pin, n));
  const c = vadd(P, vscale(n, HINGE_NECK_H + KN_RO));
  // half-spacing so the gap fits `span` male knuckles in series (span 1 = one).
  const off = (span + 1) * (KN_TH + KN_GAP) / 2;
  const baseTh = 0.14;
  const [a0, a1] = knuckleArc(shape);
  const parts = [hingeNeck(P, n)];
  for (const s of [1, -1]) parts.push(knuckle(vadd(c, vscale(pin, s * off)), pin, n, B, KN_RO, KN_RI, KN_TH, a0, a1));
  parts.push(slab(vadd(c, vscale(n, -(KN_RO - baseTh / 2))), pin, n, B, off + KN_TH / 2, baseTh / 2, KN_RO * 0.6)); // back base
  return parts;
}

// default pin axis (an in-face tangent) for a mount face axis
const defaultPin = (fa) => (fa === 0 ? "z" : "x");
const AXIS_IDX = { x: 0, y: 1, z: 2 };

// hinge joint (1-DOF): a vertical disc (male) or an extruded U cradle (female) on
// a mount FACE, pierced by a PIN along a settable world axis. The pin must lie in
// the surface; a pin parallel to the face normal would point inward, so it is
// skipped (renders nothing). `at.cell:[u,v]` selects a cell over the full grid.
function buildHinge(op, W, H, D, intact) {
  const out = [];
  const male = op.kind !== "female";
  const [fa] = parseFace(op.face);
  const pinIdx = AXIS_IDX[op.pin ?? defaultPin(fa)];
  if (pinIdx === fa) return out;                 // pin out of surface -> invalid
  const pin = [0, 0, 0]; pin[pinIdx] = 1;
  // unlike studHits, `at.cell:[u,v]` selects over the FULL face grid (side faces
  // included), and no selector means every intact cell — hence the custom hit fn
  const sel = op.at?.cell;                        // [u,v] or undefined = whole face
  eachJointCell(op, W, H, D, intact, ({ P, n }) => {
    const shape = op.shape ?? "O";
    out.push(...(male ? hingeMaleKnuckle(P, n, pin, shape) : hingeFemaleDouble(P, n, pin, shape, op.span ?? 1)));
  }, (u, v) => !sel || (u === sel[0] && v === sel[1]));
  return out;
}

// Local-space frame of a joint op (ball/hinge), for assembly seating. Returns the
// surface seat P, outward normal n, pin axis (hinge; ball reuses an in-plane
// tangent), and `center` = the swing pivot (ring center / sphere center). Works
// for both brick face ops (face + at.cell) and stick end ops (end index).
export function jointFrame(def, op) {
  let P, n, pin;
  if (def.stick) {
    const f = stickEnds(def)[op.end ?? 0];
    P = f.P; n = f.n; pin = f.e1;
  } else {
    const { W, H, D } = evalShape(def);
    const [fa, fs] = parseFace(op.face);
    const cell = op.at?.cell ?? [0, 0];
    const fr = faceCellFrame(fa, fs, cell[0], cell[1], W, H, D);
    P = fr.P; n = fr.n;
    const pinIdx = AXIS_IDX[op.pin ?? defaultPin(fa)];
    if (pinIdx === fa) { pin = fr.e1; } else { pin = [0, 0, 0]; pin[pinIdx] = 1; }
  }
  const off = op.op === "ball" ? BALL_PIVOT : HINGE_PIVOT;
  const center = [P[0] + n[0] * off, P[1] + n[1] * off, P[2] + n[2] * off];
  return { P, n, pin, center };
}

// A "stick" is a straight rod with a connector at each END. It is NOT a box, so
// it bypasses the cell mesher (makeStick below). Connector ops on a stick target
// an `end` index instead of a face; each end is a tip frame {P,n,e1,e2} the male
// builders + the "covering" female shells reuse. `len` = half-length (center to
// each tip, in studs). `size` is a bounding box kept only so seating + collision
// treat the stick as a simple block.
const ROD_R = 0.2;
const STICK_DIRS = [[0, 0, 1], [0, 0, -1]];          // I stick: one arm each way along Z
export const STICK_ENDS = STICK_DIRS.length;
export const STICK_LEN = 1.4;                        // default half-length
// bounding box for a given half-length (Z spans 2*len)
export const stickSize = (len = STICK_LEN) => [1, 1, Math.max(1, Math.round(2 * len))];

// two perpendicular unit tangents to n
function basis(n) {
  const up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = norm(cross(up, n));
  return [e1, norm(cross(n, e1))];
}

// tip frames of a stick: P = tip point, n = outward arm dir, e1/e2 = tangents
function stickEnds(def) {
  const len = def.len ?? STICK_LEN;
  return STICK_DIRS.map((d) => {
    const n = norm(d);
    const [e1, e2] = basis(n);
    return { P: vscale(n, len), n, e1, e2 };
  });
}

// Rodrigues rotation of a geometry's position+normal about an arbitrary axis.
const rotateGeoAxis = (g, axis, ang) => applyMat3(g, m3AxisAngle(...norm(axis), ang));

// orient a +Y-aligned geo to an arbitrary unit dir (handles the antiparallel case)
function alignToDir(g, dir) {
  const d = norm(dir);
  if (d[1] > 0.9999) return g;
  if (d[1] < -0.9999) return rotateGeo(g, "x", Math.PI);
  return rotateGeoAxis(g, cross([0, 1, 0], d), Math.acos(Math.max(-1, Math.min(1, d[1]))));
}

// connector hardware at a stick end frame, mirroring the face builders for an
// arbitrary tip direction. Female shells COVER the mating male: ball -> a hollow
// dome, hinge -> a U-yoke, stud -> a collar ring.
function endConnector(op, { P, n, e1, e2 }) {
  const male = op.kind !== "female";
  const at = (g, v) => g.translate(v[0], v[1], v[2]);
  if (op.op === "ball") {
    if (male) return ballMale(P, n);
    // female: neck + a hollow hemisphere socket opening OUTWARD (+n) to cup a male
    // ball. Dome aligned to -n so its open side faces away from the stick.
    const neck = at(alignToDir(cyl(NECK_R, NECK_R, NECK_H, 12), n), vadd(P, vscale(n, NECK_H / 2)));
    const cup = at(alignToDir(domeShell(BALL_R + 0.06, 0.08), vscale(n, -1)), vadd(P, vscale(n, NECK_H + BALL_R)));
    return [neck, cup];
  }
  if (op.op === "hinge") {
    const shape = op.shape ?? "O";                // pin = e1 (perpendicular to stick)
    return male ? hingeMaleKnuckle(P, n, e1, shape) : hingeFemaleDouble(P, n, e1, shape, op.span ?? 1);
  }
  // studs: a transition neck off the tip, then male = peg / female = extruded ring
  const neck = at(alignToDir(cyl(STUD_NECK_R, STUD_NECK_R, STUD_NECK_H, 14), n), vadd(P, vscale(n, STUD_NECK_H / 2)));
  const top = vadd(P, vscale(n, STUD_NECK_H + STUD_H / 2));
  if (male) return [neck, at(alignToDir(cyl(STUD_R, STUD_R, STUD_H, 16), n), top)];
  return [neck, at(alignToDir(tubeRing(STUD_R + 0.08, STUD_R - 0.12, STUD_H, 18), n), top)];
}

// mesh a stick: one continuous bar (a rod per colinear end) + end connectors.
// opts.only / opts.skip mirror makeSolid: isolate / omit one end connector op.
// `def.tips` = array of end indices to taper to a POINT (rod cones to radius 0 at
// that tip) — a spike/claw end instead of a flat rod.
function makeStick(def, opts = {}) {
  const ends = stickEnds(def);
  if (opts.only != null) {
    const o = (def.ops ?? [])[opts.only];
    return mergeGeometries(endConnector(o, ends[o.end ?? 0]));
  }
  const tips = new Set(def.tips ?? []);
  // each end's outer radius (0 = pointy), and the shared center radius. With ONE
  // pointy end the cone spans the WHOLE length (root ROD_R -> center ROD_R/2 ->
  // tip 0); with BOTH ends pointy keep a full-width middle so it tapers from the
  // center out to each tip (a double spike).
  const tipR = ends.map((_, i) => (tips.has(i) ? 0 : ROD_R));
  const allPointy = ends.length > 0 && tipR.every((r) => r === 0);
  const centerR = allPointy ? ROD_R : tipR.reduce((a, b) => a + b, 0) / (tipR.length || 1);
  const geos = [];
  ends.forEach((f, i) => {
    const L = Math.hypot(f.P[0], f.P[1], f.P[2]);
    const rod = alignToDir(cyl(tipR[i], centerR, L, 12), f.n);
    geos.push(rod.translate(f.P[0] / 2, f.P[1] / 2, f.P[2] / 2));
    (def.ops ?? []).forEach((op, oi) => {
      if (oi === opts.skip) return;
      if ((op.end ?? 0) === i && (op.op === "studs" || op.op === "ball" || op.op === "hinge"))
        geos.push(...endConnector(op, f));
    });
  });
  return mergeGeometries(geos);
}

// two polygons share the same vertex set (order-independent, within EPS)
function samePoly(a, b) {
  if (a.length !== b.length) return false;
  return a.every((p) => b.some((q) =>
    Math.abs(p[0] - q[0]) < 1e-5 && Math.abs(p[1] - q[1]) < 1e-5 && Math.abs(p[2] - q[2]) < 1e-5));
}

// index of the outer face in cellFaces() output, per face axis (+1 for + side)
const OUTER_FACE = { 0: 2, 1: 4, 2: 0 };

// Reverse a polygon's winding if needed so its face normal points along `want`.
// Keeps the CCW-outward convention cellFaces uses, so facesToGeometry derives the
// right normal regardless of how the points were generated.
function windTo(poly, want) {
  const n = norm(cross(sub(poly[1], poly[0]), sub(poly[2], poly[0])));
  return n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0 ? poly.slice().reverse() : poly;
}

const HOLE_DEPTH = STUD_H;   // an anti-stud hole as deep as a male stud is tall

// ray from the cell center P to the cell edge, in the (e1,e2) plane with world
// half-extents a/b — the square rim both recess builders trim against.
const squareEdge = (P, e1, e2, a, b) => (ang) => {
  const c = Math.cos(ang), s = Math.sin(ang);
  const t = Math.min(a / (Math.abs(c) || 1e-9), b / (Math.abs(s) || 1e-9));
  return vadd(P, vadd(vscale(e1, t * c), vscale(e2, t * s)));
};

// Anti-stud hole pushed into one face cell: replaces the flat cap with a ring
// (the cell square minus a disk), a cylindrical wall sunk into the body, and a
// floor. P = face-cell center on the surface, n = outward face normal, e1/e2 =
// unit in-plane axes with world half-extents a/b. A male stud from the mating
// brick seats into this recess.
function holeFaces(P, n, e1, e2, a, b, seg = 16) {
  const R = Math.min(STUD_R, 0.85 * Math.min(a, b));
  const into = vscale(n, -HOLE_DEPTH);
  const circ = (ang) => vadd(P, vadd(vscale(e1, R * Math.cos(ang)), vscale(e2, R * Math.sin(ang))));
  const square = squareEdge(P, e1, e2, a, b);
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

// Place a recess (anti-stud hole / ball socket builder) at solid cell (i,j,k) on
// face (fa,fs): resolves the cell-center frame via faceCellFrame, adds the
// in-plane half-extents, then hands off to the `build(P, n, e1, e2, a, b)` face
// builder. The v half-extent is in plate units on side faces.
function recessForCell(build, i, j, k, fa, fs, W, H, D) {
  const [pu, pv] = PAX[fa], idx = [i, j, k];
  const { P, n, e1, e2 } = faceCellFrame(fa, fs, idx[pu], idx[pv], W, H, D);
  return build(P, n, e1, e2, 0.5, fa === 1 ? 0.5 : 0.5 * PLATE_H);
}

// Spherical socket carved into one face cell (the female ball joint): drop the
// flat cap, then build a ring (cell square minus the mouth disk) plus an inward
// hemispherical bowl whose inner wall faces the opening. P/n/e1/e2/a/b as in
// holeFaces; R is the bowl radius. A male ball seats into this recess.
function socketFaces(P, n, e1, e2, a, b, R = BALL_R, lon = 16, lat = 6) {
  R = Math.min(BALL_R, R, 0.85 * Math.min(a, b));
  const dir = (ang) => vadd(vscale(e1, Math.cos(ang)), vscale(e2, Math.sin(ang)));
  // bowl point at polar (theta from rim 0 -> bottom PI/2) and longitude
  const bowl = (th, ang) => vadd(P, vadd(vscale(dir(ang), R * Math.cos(th)), vscale(n, -R * Math.sin(th))));
  const inwardN = (th, ang) => norm(vadd(vscale(dir(ang), -Math.cos(th)), vscale(n, Math.sin(th)))); // toward center P
  const square = squareEdge(P, e1, e2, a, b);
  const polys = [];
  for (let i = 0; i < lon; i++) {
    const a0 = (i / lon) * 2 * Math.PI, a1 = ((i + 1) / lon) * 2 * Math.PI;
    const r0 = bowl(0, a0), r1 = bowl(0, a1);
    polys.push(windTo([square(a0), square(a1), r1, r0], n));   // flat ring on the surface
    for (let j = 0; j < lat; j++) {                            // bowl wall rings
      const t0 = (j / lat) * (Math.PI / 2), t1 = ((j + 1) / lat) * (Math.PI / 2);
      const nn = inwardN((t0 + t1) / 2, (a0 + a1) / 2);
      polys.push(windTo([bowl(t0, a0), bowl(t0, a1), bowl(t1, a1), bowl(t1, a0)], nn));
    }
  }
  return polys;
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
  return new Geometry()
    .setAttribute("position", new Float32Array(pos), 3)
    .setAttribute("normal", new Float32Array(nor), 3);
}

// Evaluate a def into the shape data the mesher reads. CUTS FIRST: push + slope
// are gathered up front so studs see the post-cut shape regardless of op order.
function evalShape(def) {
  const { sx: W, sy: H, sz: D } = dims(def);
  const ops = def.ops ?? [];
  const size = [W, H, D];
  const slopeOps = ops.filter((o) => o.op === "slope").map((o) => slopePlanes(o, W, H, D));
  const pushOps = ops.filter((o) => o.op === "push").map((o) => pushTest(o, W, H, D));
  // sticks place connectors on `end` frames, not box faces — keep them out of the
  // face connector map so mate/validation treats a stick as a plain block.
  const studOps = def.stick ? [] : ops.filter((o) => o.op === "studs");
  // rounded vertical corners are a property of the base box, applied to every
  // cell. faceIntact ignores them (uses only slope/push), so a 1x1 cylinder
  // still keeps its stud.
  const corners = cornerPlanes(def, W, D);

  // does the boundary cell at face (fa,fs), in-plane index (u,v), still have a
  // flat, full outer face after every cut? used to skip studs on uneven cells
  // and to mark carved cells as 'none' in the connector map.
  function faceIntact(fa, fs, u, v) {
    const idx = [0, 0, 0];
    idx[fa] = fs > 0 ? size[fa] - 1 : 0;
    const pax = PAX[fa];
    idx[pax[0]] = u; idx[pax[1]] = v;
    if (idx[pax[0]] < 0 || idx[pax[0]] >= size[pax[0]]) return false;
    if (idx[pax[1]] < 0 || idx[pax[1]] >= size[pax[1]]) return false;
    if (pushOps.some((t) => t(idx))) return false;            // carved away
    let faces = cellFaces(idx[0], idx[1], idx[2], W, H, D);   // clipSolid never mutates
    const orig = faces[OUTER_FACE[fa] + (fs > 0 ? 1 : 0)];
    for (const planes of slopeOps) {
      for (const pl of planes) {
        faces = clipSolid(faces, pl.n, pl.d);
        if (!faces.length) return false;
      }
    }
    return faces.some((f) => samePoly(f, orig));              // outer face survived intact
  }

  return { W, H, D, slopeOps, pushOps, studOps, corners, faceIntact };
}


// opts (for splitting a hinged part into "body" + "linked knuckle" render pieces):
//   only — op index: build ONLY that joint op's hardware (the knuckle), nothing else
//   skip — op index: build everything EXCEPT that op (the body, minus its knuckle)
export function makeSolid(def, opts = {}) {
  if (def.stick) return makeStick(def, opts);      // straight connector rod, not a box
  const { W, H, D, slopeOps, pushOps, studOps, corners, faceIntact } = evalShape(def);
  if (opts.only != null) {                          // just the linked knuckle / joint
    const o = (def.ops ?? [])[opts.only];
    const g = o?.op === "ball" ? buildBalls(o, W, H, D, faceIntact) : buildHinge(o, W, H, D, faceIntact);
    return g.length ? mergeGeometries(g) : soup(() => {});
  }
  // Carved female recesses: female studs -> a cylindrical anti-stud hole; female
  // balls -> a spherical socket. Each drops the flat outer cap on its boundary
  // cell, then adds its own recess geometry. `build(i,j,k,fa,fs,W,H,D)` returns
  // that geometry; marked per cell so the cap can be removed below.
  const femaleOps = (def.ops ?? [])
    .filter((o) => (o.op === "studs" || o.op === "ball") && o.kind === "female")
    .map((o) => {
      const [fa, fs] = parseFace(o.face);
      return { fa, fs, hit: studHits(o, W, H, D),
        build: o.op === "ball" ? socketFaces : holeFaces };
    });

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
          const pax = PAX[fop.fa];
          const u = idx[pax[0]], v = idx[pax[1]];
          if (!fop.hit(u, v) || !faceIntact(fop.fa, fop.fs, u, v)) continue;
          const orig = cellFaces(i, j, k, W, H, D)[OUTER_FACE[fop.fa] + (fop.fs > 0 ? 1 : 0)];
          const before = faces.length;
          faces = faces.filter((f) => !samePoly(f, orig));
          if (faces.length < before) allFaces.push(...recessForCell(fop.build, i, j, k, fop.fa, fop.fs, W, H, D));
        }
        if (faces.length) allFaces.push(...faces);
      }

  const geos = [facesToGeometry(allFaces)];
  for (const op of studOps) if (op.kind !== "female") geos.push(...buildStuds(op, W, H, D, faceIntact));
  // joint hardware: ball + hinge ops emit additive geometry on their face cells.
  (def.ops ?? []).forEach((op, i) => {
    if (i === opts.skip) return;                    // this knuckle is a separate piece
    if (op.op === "ball") geos.push(...buildBalls(op, W, H, D, faceIntact));
    else if (op.op === "hinge") geos.push(...buildHinge(op, W, H, D, faceIntact));
  });
  return mergeGeometries(geos);
}
