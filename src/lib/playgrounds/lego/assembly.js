// Assembly engine: resolve a part graph into world transforms.
//
// A model = { parts: {id: spec}, root, baseY?, connections: [...] }.
// Each connection mounts part B onto a FACE of an already-placed part A:
//   { a, b, on:"top|bottom|front|back|left|right",
//     off:[du,dv],         // in-plane offset on A's face, in whole studs (0,0)
//     rot:[rx,ry,rz] }     // B's rotation, each a multiple of 90°
//                          // (legacy `angle` == rot Y; default 0,0,0)
//
// Faces and rotations are in WORLD axes — mounting does NOT inherit A's
// rotation. So a flipped/rotated anchor carries nothing into its children: B is
// rotated only by its own `rot`, then seated on A. Mount order per connection:
//   1. rotate B locally by `rot`,
//   2. seat B against A's `on` face: contact point = A's center pushed out along
//      the face normal by A's half-extent along it; B is then pushed out by its
//      OWN half-extent along that normal, so the rotated box rests flush (no
//      sink, any rotation),
//   3. slide along the face by `off` (in studs).
// Heights/positions fall out of the stack. Order = connection order = build order.

import { TYPE_HEIGHT, BRICK_H, PLATE_H } from "./brick.js";

const D2R = Math.PI / 180;

const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const rotX = (t) => { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotY = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
function mul3(A, B) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
    o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return o;
}
const apply3 = (R, v) => [
  R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
  R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
  R[6] * v[0] + R[7] * v[1] + R[8] * v[2],
];

function mat4(R, C) {
  const m = new Float32Array(16);          // column-major
  m[0] = R[0]; m[1] = R[3]; m[2] = R[6];
  m[4] = R[1]; m[5] = R[4]; m[6] = R[7];
  m[8] = R[2]; m[9] = R[5]; m[10] = R[8];
  m[12] = C[0]; m[13] = C[1]; m[14] = C[2]; m[15] = 1;
  return m;
}

function dims(spec) {
  // op-model part: size = [W(studs X), H(plates Y), D(studs Z)]
  if (Array.isArray(spec.size)) {
    const sx = spec.size[0] ?? 2;
    const sz = spec.size[2] ?? spec.size[0] ?? 2;
    const h = (spec.size[1] ?? 3) * PLATE_H;
    return { sx, sz, h, hw: sx / 2, hd: sz / 2, hh: h / 2 };
  }
  // legacy preset: sx/sz footprint + type/height
  const sx = spec.sx ?? spec.studsX ?? 2;
  const sz = spec.sz ?? spec.studsZ ?? 2;
  const h = spec.h ?? spec.height ?? TYPE_HEIGHT[spec.type] ?? BRICK_H;
  return { sx, sz, h, hw: sx / 2, hd: sz / 2, hh: h / 2 };
}

// world face: outward normal n + the two in-plane axes (u,v) that `off` slides on
const FACES = {
  top:    { n: [0, 1, 0],  u: [1, 0, 0], v: [0, 0, 1] },
  bottom: { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  front:  { n: [0, 0, 1],  u: [1, 0, 0], v: [0, 1, 0] },
  back:   { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] },
  right:  { n: [1, 0, 0],  u: [0, 0, 1], v: [0, 1, 0] },
  left:   { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
};

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale3 = (v, s) => [v[0] * s, v[1] * s, v[2] * s];

// half-extent of a box (half-sizes hw,hh,hd, rotation R) along a unit world dir w
function halfAlong(d, R, w) {
  const ex = [R[0], R[3], R[6]], ey = [R[1], R[4], R[7]], ez = [R[2], R[5], R[8]];
  return d.hw * Math.abs(dot3(w, ex)) + d.hh * Math.abs(dot3(w, ey)) + d.hd * Math.abs(dot3(w, ez));
}

// Stud-grid snap along an in-plane mount axis. Studs sit on a unit grid whose
// phase depends on parity: an N-stud span has its studs at half-integer offsets
// from the part center when N is even, integer when N is odd. Seating B centered
// on A only lands on a stud when A and B have the SAME parity along that axis;
// when they differ the contact falls in the gap between two studs (e.g. a 1x1 on
// a 1x2). Correct by a half-stud so B's stud grid aligns with A's.
// Only horizontal stud axes (X/Z) are snapped; the vertical Y axis is plates, not
// studs, so it is left alone.
function studSnap(axis, A, Rb, bd) {
  if (Math.abs(axis[1]) > 0.5) return 0;                 // vertical (plate) axis
  const aN = Math.round(2 * halfAlong(A.d, A.R, axis));  // A's stud count along axis
  const bN = Math.round(2 * halfAlong(bd, Rb, axis));    // B's stud count along axis
  return ((aN - bN) & 1) ? 0.5 : 0;                      // differ in parity -> half-stud
}

export function resolveAssembly(model) {
  const placed = new Map();
  const order = [];

  const rootId = model.root;
  const rootSpec = model.parts[rootId];
  const rd = dims(rootSpec);
  const R0 = model.rootAngle ? rotY(model.rootAngle * D2R) : I3;
  placed.set(rootId, { R: R0, C: [0, (model.baseY ?? 0) + rd.hh, 0], d: rd, spec: rootSpec });
  order.push(rootId);

  for (const conn of model.connections) {
    const A = placed.get(conn.a);
    if (!A) { console.warn(`[assembly] unknown anchor ${conn.a}`); continue; }
    const Bspec = model.parts[conn.b];
    const bd = dims(Bspec);
    const on = conn.on ?? "top";

    const F = FACES[on] ?? FACES.top;
    const N = F.n;

    // 1) rotate B locally (world axes, each a multiple of 90°); legacy `angle` == rot Y
    const r = conn.rot ?? [0, conn.angle ?? 0, 0];
    const Rb = mul3(rotX(r[0] * D2R), mul3(rotY(r[1] * D2R), rotZ(r[2] * D2R)));

    // 2) contact point: A's center -> out to its `on` face -> slide by `off`.
    // Base seat snaps to A's stud grid (parity-aware) so B clutches a stud
    // instead of landing between two; `off` slides in whole studs on top.
    const [du, dv] = conn.off ?? [0, 0];
    const su = studSnap(F.u, A, Rb, bd), sv = studSnap(F.v, A, Rb, bd);
    const Pa = add(add(A.C, scale3(N, halfAlong(A.d, A.R, N))),
                   add(scale3(F.u, du + su), scale3(F.v, dv + sv)));

    // 3) seat B flush: push out along the face normal by B's own half-extent
    const Cb = add(Pa, scale3(N, halfAlong(bd, Rb, N)));

    placed.set(conn.b, { R: Rb, C: Cb, d: bd, spec: Bspec });
    order.push(conn.b);
  }

  // emit in build order with model matrices + centroid
  let cx = 0, cy = 0, cz = 0;
  const out = order.map((id) => {
    const p = placed.get(id);
    cx += p.C[0]; cy += p.C[1]; cz += p.C[2];
    return { id, spec: p.spec, color: p.spec.color, model: mat4(p.R, p.C), center: p.C.slice() };
  });
  const n = out.length || 1;
  return { pieces: out, centroid: [cx / n, cy / n, cz / n] };
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
