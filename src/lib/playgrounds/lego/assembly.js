// Assembly engine: resolve a part graph into world transforms.
//
// A model = { parts: {id: spec}, root, baseY?, connections: [...] }.
// Each connection mounts part B onto a FACE of an already-placed part A:
//   { a, b, on:"top|bottom|front|back|left|right",
//     off:[du,dv],         // in-plane offset on A's face, in whole studs (0,0)
//     rot:[rx,ry,rz],      // B's rotation, each a multiple of 90° (legacy
//                          // `angle` == rot Y; default 0,0,0)
//     joint, jrot, jangle, axis,  // articulated joint (see jointRot below)
//     local:false }        // mount frame (see below)
//
// JOINT. An optional articulation applied AFTER seating: B (and its subtree) is
// rotated about the seat point. joint:"ball" -> free spin, jrot:[x,y,z]° about
// the mount U/V/N axes. joint:"hinge" -> 1-DOF, jangle° about a single mount
// axis (`axis`: "u"|"v"|"n", default "u"). Absent/"none" -> rigid as before.
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
// resolveAssembly() returns render pieces. (Lattice mating/collision validation
// was removed for simplicity — placement is purely geometric, never blocked.)

import { PLATE_H, jointFrame } from "./solid.js";

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
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// row-major 3x3 from three column vectors / from three row vectors
const matCols = (a, b, c) => [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
const matRows = (a, b, c) => [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]];

// Rodrigues row-major 3x3 rotation by `t` rad about an arbitrary unit-ish axis.
function rotAxis(axis, t) {
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const x = axis[0] / l, y = axis[1] / l, z = axis[2] / l;
  const c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  return [
    c + x * x * C, x * y * C - z * s, x * z * C + y * s,
    y * x * C + z * s, c + y * y * C, y * z * C - x * s,
    z * x * C - y * s, z * y * C + x * s, c + z * z * C,
  ];
}

// Seating mode of a connection, derived from where B attaches:
//   attach "face"  -> "grid" (rigid stud clutch, 90° rot + parity snap)
//   attach "hinge" -> "free" (articulated pivot, continuous joint)
// Legacy fallbacks: explicit `mode`, else a joint field implies free.
export function connMode(conn) {
  if (conn.attach === "hinge") return "free";
  if (conn.attach === "face") return "grid";
  if (conn.mode === "grid" || conn.mode === "free") return conn.mode;
  return conn.joint && conn.joint !== "none" ? "free" : "grid";
}

// Index of the joint op (ball/hinge) a connection links on a part: the explicit
// index if it points at one of that type, else the first op of that type, else -1.
function jointIdxOf(spec, idx, type) {
  const ops = spec?.ops ?? [];
  if (idx != null && ops[idx]?.op === type) return idx;
  return ops.findIndex((o) => o.op === type);
}

// Joint articulation for a connection, expressed in the mount frame (U,V,N):
//   ball  — free spin: jrot[x,y,z]° about the U, V, N axes.
//   hinge — 1-DOF: swings about U (the PIN) only. The knuckle is a solid of
//           revolution about the pin, so swinging about the pin leaves the ring
//           seated while the body moves; any other axis would tilt the ring out
//           of the joint. Both jpitch and jyaw drive this single pin swing (their
//           sum); `jangle` is read as a legacy pitch.
function jointRot(conn, U, V, N) {
  if (!conn.joint || conn.joint === "none") return I3;
  if (conn.joint === "hinge") {
    const pitch = (conn.jpitch ?? conn.jangle ?? 0) * D2R;
    const yaw = (conn.jyaw ?? 0) * D2R;
    return rotAxis(U, pitch + yaw);                       // pin swing only — ring stays put
  }
  const [jx, jy, jz] = conn.jrot ?? [0, 0, 0];   // ball: compose U then V then N
  return mul3(rotAxis(N, jz * D2R), mul3(rotAxis(V, jy * D2R), rotAxis(U, jx * D2R)));
}

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
  const ghosts = [];           // render-only extra pieces (e.g. a hinge's seated knuckle)

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
    const [du, dv] = conn.off ?? [0, 0];

    // Two exclusive seating modes with completely different logic:
    //   grid — rigid LEGO clutch: 90° `rot`, parity stud-snap, whole-stud `off`.
    //   free — articulated joint: B's joint center is mated to A's joint center
    //          (a shared hinge pin / ball center) and swings about THAT point.
    const mode = connMode(conn);
    let Rb, Cb, mountN = N, mesh = null, ghost = null;
    const jt = conn.joint === "ball" ? "ball" : "hinge";
    const aIdx = mode === "free" ? jointIdxOf(A.spec, conn.ah, jt) : -1;
    const bIdx = mode === "free" ? jointIdxOf(Bspec, conn.bh, jt) : -1;
    const aOp = aIdx >= 0 ? A.spec.ops[aIdx] : null;
    const bOp = bIdx >= 0 ? Bspec.ops[bIdx] : null;
    if (mode === "free" && aOp && bOp) {
      const fa = jointFrame(A.spec, aOp), fb = jointFrame(Bspec, bOp);   // local frames
      const nA = norm3(apply3(A.R, fa.n)), pinA = norm3(apply3(A.R, fa.pin));
      const pivot = add(A.C, apply3(A.R, fa.center));      // shared hinge pin / ball center
      // base seat: B's joint faces A's (normal opposes, pin parallel), joint center
      // on the pivot. seat(R) returns the center so B's local joint center -> pivot.
      const nt = scale3(nA, -1), qt = cross3(nt, pinA);
      const R0 = mul3(matCols(nt, pinA, qt), matRows(fb.n, fb.pin, cross3(fb.n, fb.pin)));
      const seat = (R) => sub3(pivot, apply3(R, fb.center));
      if (jt === "hinge") {
        // Two pieces: the KNUCKLE stays interlocked (swings about the pin only); the
        // BODY additionally yaws about the joint normal — "rotate the block, not the
        // hinge". Both pivot about the shared ring center.
        const pitch = (conn.jpitch ?? conn.jangle ?? 0) * D2R, yaw = (conn.jyaw ?? 0) * D2R;
        const Rring = pitch ? mul3(rotAxis(pinA, pitch), R0) : R0;
        // yaw the block first (about the normal), THEN fold the hinge (about the pin)
        const Ryaw = yaw ? mul3(rotAxis(nA, yaw), R0) : R0;
        const Rbody = pitch ? mul3(rotAxis(pinA, pitch), Ryaw) : Ryaw;
        Rb = Rbody; Cb = seat(Rbody); mountN = nA;
        mesh = { skip: bIdx };                             // body omits the linked knuckle
        ghost = { id: `${conn.b}#knuckle`, spec: Bspec, def: Bspec, d: bd, R: Rring, C: seat(Rring),
          depth: (A.depth ?? 0) + 1, mountN: nA, mesh: { only: bIdx } };
      } else {
        const Rj = jointRot(conn, pinA, norm3(qt), nA);    // ball: whole B spins about center
        Rb = Rj !== I3 ? mul3(Rj, R0) : R0; Cb = seat(Rb); mountN = nA;
      }
    } else if (mode === "free") {
      // fallback (parts lack a matching joint op): flush seat, pivot at joint center
      Rb = conn.local ? A.R : I3;
      const Pa = add(add(A.C, scale3(N, halfAlong(A.d, A.R, N))), add(scale3(U, du), scale3(V, dv)));
      Cb = add(Pa, scale3(N, halfAlong(bd, Rb, N)));
      const Rj = jointRot(conn, U, V, N);
      if (Rj !== I3) { Rb = mul3(Rj, Rb); Cb = add(Pa, apply3(Rj, sub3(Cb, Pa))); }
    } else {
      const r = conn.rot ?? [0, conn.angle ?? 0, 0];       // legacy `angle` == rot Y
      Rb = mul3(rotX(r[0] * D2R), mul3(rotY(r[1] * D2R), rotZ(r[2] * D2R)));
      if (conn.local) Rb = mul3(A.R, Rb);
      const su = studSnap(U, A, Rb, bd), sv = studSnap(V, A, Rb, bd);  // parity-correct to A's stud grid
      const Pa = add(add(A.C, scale3(N, halfAlong(A.d, A.R, N))), add(scale3(U, du + su), scale3(V, dv + sv)));
      Cb = add(Pa, scale3(N, halfAlong(bd, Rb, N)));       // flush along normal
    }

    placed.set(conn.b, { id: conn.b, spec: Bspec, def: Bspec, d: bd, R: Rb, C: Cb, depth: (A.depth ?? 0) + 1, mountN, mesh });
    order.push(conn.b);
    if (ghost) ghosts.push(ghost);
  }

  return { placed, list: [...order.map((id) => placed.get(id)), ...ghosts] };
}

export function resolveAssembly(model) {
  const { list } = placeAll(model);
  let cx = 0, cy = 0, cz = 0;
  const pieces = list.map((p) => {
    cx += p.C[0]; cy += p.C[1]; cz += p.C[2];
    return { id: p.id, spec: p.spec, color: p.spec.color, model: mat4(p.R, p.C), center: p.C.slice(), mountN: p.mountN.slice(), depth: p.depth, mesh: p.mesh ?? null };
  });
  const n = pieces.length || 1;
  return { pieces, centroid: [cx / n, cy / n, cz / n] };
}
