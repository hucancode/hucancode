// Assembly engine: resolve a part graph into world transforms.
//
// A model = { parts: {id: spec}, root, baseY?, connections: [...] }.
// Each connection mounts part B onto a FACE of an already-placed part A:
//   { a, b, on:"top|bottom|front|back|left|right",
//     off:[du,dv],         // in-plane offset on A's face, in whole studs (0,0)
//     rot:[rx,ry,rz],      // B's rotation, each a multiple of 90° (legacy
//                          // `angle` == rot Y; default 0,0,0)
//     local:false }        // mount frame (see below)
//
// MOUNT FRAME. By default faces and rotations are WORLD axes: mounting does NOT
// inherit A's rotation, so a flipped/rotated anchor carries nothing into its
// children (B is rotated only by its own `rot`, then seated on A). This is right
// for normal stacking — an upright plate placed on top of an inverted slope stays
// upright. Set `local:true` to seat B in A's LOCAL frame instead: B inherits A's
// orientation and the face/offset are taken relative to A. Chaining `local`
// connections builds a sub-assembly that rotates as a unit when its root rotates.
//
// Seat order per connection:
//   1. rotate B (by `rot`, composed onto A's frame when local),
//   2. seat B against A's `on` face: contact point = A's center pushed out along
//      the face normal by A's half-extent along it; B is then pushed out by its
//      OWN half-extent along that normal, so the rotated box rests flush,
//   3. slide along the face by `off` (in studs).
// Heights/positions fall out of the stack. Order = connection order = build order.
//
// resolveAssembly() returns render pieces. validateAssembly() / canConnect() run
// the real-lego rules (stud mating + collision) from lattice.js over the same
// placements — they never block a build, only report.

import { PLATE_H } from "./solid.js";
import { mate, collides, cellBoxes } from "./lattice.js";

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

// op-model footprint: size = [W(studs X), H(plates Y), D(studs Z)]
function dims(spec) {
  const sx = spec.size?.[0] ?? 2;
  const sz = spec.size?.[2] ?? spec.size?.[0] ?? 2;
  const h = (spec.size?.[1] ?? 3) * PLATE_H;
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
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

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

// Detect connections that would introduce a cycle. An edge a->b makes b a child
// of a; it is invalid if b can already reach a through earlier-accepted edges (or
// it is a self-loop a==a). Returns a Set of offending connection indices. Parts
// may have multiple parents (a DAG) — only back-edges that close a loop are bad.
export function cycleEdges(model) {
  const conns = model.connections ?? [];
  const adj = new Map();                 // accepted edges: a -> [b, ...]
  const bad = new Set();
  const reaches = (from, target) => {    // DFS: can `from` reach `target`?
    const stack = [from], seen = new Set();
    while (stack.length) {
      const x = stack.pop();
      if (x === target) return true;
      if (seen.has(x)) continue;
      seen.add(x);
      for (const y of adj.get(x) ?? []) stack.push(y);
    }
    return false;
  };
  conns.forEach((c, i) => {
    if (c.a === c.b || reaches(c.b, c.a)) { bad.add(i); return; }
    if (!adj.has(c.a)) adj.set(c.a, []);
    adj.get(c.a).push(c.b);
  });
  return bad;
}

// Resolve every part to { id, spec, d, R, C } in build order. Shared by the
// renderer and the validators so all three agree on placement.
function placeAll(model) {
  const placed = new Map();
  const order = [];

  // Cycle-forming connections are ignored entirely (their `b` keeps no parent
  // from them, so it may itself become a root).
  const bad = cycleEdges(model);
  const conns = (model.connections ?? []).filter((_, i) => !bad.has(i));

  // Roots auto-deduced: every part that never appears as a (valid) connection's
  // `b` (i.e. has no parent). Multiple roots are allowed — each is seated at the
  // origin. Fallback to explicit model.root / first part if nothing is
  // parentless.
  const children = new Set(conns.map((c) => c.b));
  let roots = Object.keys(model.parts).filter((id) => !children.has(id));
  if (roots.length === 0) roots = [model.root ?? Object.keys(model.parts)[0]];

  const R0 = model.rootAngle ? rotY(model.rootAngle * D2R) : I3;
  for (const rootId of roots) {
    const rootSpec = model.parts[rootId];
    if (!rootSpec) continue;
    const rd = dims(rootSpec);
    placed.set(rootId, { id: rootId, spec: rootSpec, def: rootSpec, d: rd, R: R0, C: [0, (model.baseY ?? 0) + rd.hh, 0], depth: 0, mountN: [0, 1, 0] });
    order.push(rootId);
  }

  for (const conn of conns) {
    const A = placed.get(conn.a);
    if (!A) { console.warn(`[assembly] unknown anchor ${conn.a}`); continue; }
    const Bspec = model.parts[conn.b];
    if (!Bspec) { console.warn(`[assembly] unknown part ${conn.b}`); continue; }
    const bd = dims(Bspec);
    const F = FACES[conn.on ?? "top"] ?? FACES.top;

    // mount frame: world axes by default, A's local frame when `local`
    const faceR = conn.local ? A.R : I3;
    const N = apply3(faceR, F.n), U = apply3(faceR, F.u), V = apply3(faceR, F.v);

    // rotate B (legacy `angle` == rot Y); compose onto A's frame when local
    const r = conn.rot ?? [0, conn.angle ?? 0, 0];
    let Rb = mul3(rotX(r[0] * D2R), mul3(rotY(r[1] * D2R), rotZ(r[2] * D2R)));
    if (conn.local) Rb = mul3(A.R, Rb);

    // contact point: A's center -> out to its `on` face -> slide by `off`. Base
    // seat snaps to A's stud grid (parity-aware) so B clutches a stud instead of
    // landing between two; `off` slides in whole studs on top.
    const [du, dv] = conn.off ?? [0, 0];
    const su = studSnap(U, A, Rb, bd), sv = studSnap(V, A, Rb, bd);
    const Pa = add(add(A.C, scale3(N, halfAlong(A.d, A.R, N))),
                   add(scale3(U, du + su), scale3(V, dv + sv)));
    // seat B flush: push out along the face normal by B's own half-extent
    const Cb = add(Pa, scale3(N, halfAlong(bd, Rb, N)));

    placed.set(conn.b, { id: conn.b, spec: Bspec, def: Bspec, d: bd, R: Rb, C: Cb, depth: (A.depth ?? 0) + 1, mountN: N });
    order.push(conn.b);
  }

  return { placed, list: order.map((id) => placed.get(id)) };
}

export function resolveAssembly(model) {
  const { list } = placeAll(model);
  let cx = 0, cy = 0, cz = 0;
  const pieces = list.map((p) => {
    cx += p.C[0]; cy += p.C[1]; cz += p.C[2];
    return { id: p.id, spec: p.spec, color: p.spec.color, model: mat4(p.R, p.C), center: p.C.slice(), mountN: p.mountN.slice(), depth: p.depth };
  });
  const n = pieces.length || 1;
  return { pieces, centroid: [cx / n, cy / n, cz / n] };
}

// Run the real-lego rules over a model: every connection should clutch (a stud
// into a socket) with no stud-vs-stud conflict, and no part should interpenetrate
// one placed before it. Pure report — never mutates or blocks the build.
export function validateAssembly(model) {
  const { placed, list } = placeAll(model);
  const conns = (model.connections ?? []).map((conn) => {
    const A = placed.get(conn.a), B = placed.get(conn.b);
    if (!A || !B) return { a: conn.a, b: conn.b, connected: false, missing: true };
    const m = mate(A, B);
    return { a: conn.a, b: conn.b, ...m };
  });

  const seen = [];
  const overlaps = [];
  for (const p of list) {
    const hit = collides(seen, p);
    if (hit.hit) overlaps.push({ id: p.id, with: hit.with });
    seen.push({ ...p, boxes: cellBoxes(p) });
  }

  return {
    ok: conns.every((c) => c.connected) && overlaps.length === 0,
    loose: conns.filter((c) => !c.connected),
    conflicts: conns.filter((c) => c.conflict > 0),
    collisions: overlaps,
    connections: conns,
  };
}

// Standalone query (TODO): can defB clutch onto defA via this single connection?
// { connected, clutch, conflict, collision }.
export function canConnect(defA, defB, conn = {}) {
  const model = { parts: { a: defA, b: defB }, root: "a", connections: [{ a: "a", b: "b", ...conn }] };
  const { placed } = placeAll(model);
  const A = placed.get("a"), B = placed.get("b");
  const m = mate(A, B);
  return { ...m, collision: collides([A], B).hit };
}
