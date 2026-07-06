// Assembly engine: resolve a part TREE into world transforms.
//
// MODEL = { parts: {id: spec}, baseY?, root: <node> }.
//   parts — the brick library (op-model specs, each with a color).
//   root  — the top NODE of the assembly tree (seated at the origin).
//
// A NODE is a clone of a brick plus how it attaches to its PARENT node:
//   { part,                // id into `parts` — which brick this node stamps
//     children: [...node], // sub-nodes mounted onto this one
//     on:"top|bottom|front|back|left|right",
//     off:[du,dv],         // in-plane offset on the parent face, whole studs
//     rot:[rx,ry,rz],      // node rotation, each a multiple of 90deg (legacy
//                          // `angle` == rot Y; default 0,0,0)
//     attach, joint, jpitch, jyaw, jrot, ah, bh,  // articulation (see below)
//     local:false }        // mount frame (see below)
// Reusing a brick is just adding more nodes that point at the same `part`; no
// spec is ever duplicated (two eyes, two antlers = two nodes, one brick def).
//
// JOINT. Optional articulation applied AFTER seating: the node (and its subtree)
// rotates about the seat point. joint:"ball" -> free spin, jrot:[x,y,z]deg about the
// mount U/V/N axes. joint:"hinge" -> 1-DOF pin swing (jpitch+jyaw). Absent -> rigid.
//
// MOUNT FRAME. By default faces and rotations are WORLD axes: a node does NOT
// inherit its parent's rotation, so a flipped/rotated parent carries nothing into
// its children. Set `local:true` to seat in the parent's LOCAL frame instead: the
// node inherits the parent orientation and the face/offset are taken relative to
// it. Chaining local nodes builds a sub-assembly that rotates as a unit.
//
// Seat order per node:
//   1. rotate the node (by `rot`, composed onto the parent frame when local),
//   2. seat it against the parent `on` face: contact point = parent center pushed
//      out along the face normal by the parent half-extent; the node is then
//      pushed out by its OWN half-extent so the rotated box rests flush,
//   3. slide along the face by `off` (in studs).
// Heights/positions fall out of the stack. Build order = DFS preorder (a parent
// before its children).
//
// resolveAssembly() returns render pieces. (Lattice mating/collision validation
// was removed for simplicity — placement is purely geometric, never blocked.)

import { dims, jointFrame, matCols } from "./solid.js";
import {
  I3, m3Rot, m3Mul, m3MulV, m3AxisAngle,
  vAdd, vSub, vScale, vCross, vNorm, vDot,
} from "../../math/mat3.js";
import { rad } from "../../math/scalar.js";

function mat4(R, C) {
  const m = new Float32Array(16);          // column-major
  m[0] = R[0]; m[1] = R[3]; m[2] = R[6];
  m[4] = R[1]; m[5] = R[4]; m[6] = R[7];
  m[8] = R[2]; m[9] = R[5]; m[10] = R[8];
  m[12] = C[0]; m[13] = C[1]; m[14] = C[2]; m[15] = 1;
  return m;
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

// row-major 3x3 from three row vectors (matCols, its column twin, lives in solid.js)
const matRows = (a, b, c) => [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]];

// Seating mode of a connection, derived from where B attaches:
//   attach "face"  -> "grid" (rigid stud clutch, 90deg rot + parity snap)
//   attach "hinge" -> "free" (articulated pivot, continuous joint)
// Legacy fallback: a joint field implies free.
export function connMode(conn) {
  if (conn.attach === "hinge") return "free";
  if (conn.attach === "face") return "grid";
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
//   ball  — free spin: jrot[x,y,z]deg about the U, V, N axes.
//   hinge — 1-DOF: swings about U (the PIN) only. The knuckle is a solid of
//           revolution about the pin, so swinging about the pin leaves the ring
//           seated while the body moves; any other axis would tilt the ring out
//           of the joint. Both jpitch and jyaw drive this single pin swing (their
//           sum); `jangle` is read as a legacy pitch.
function jointRot(conn, U, V, N) {
  if (!conn.joint || conn.joint === "none") return I3;
  if (conn.joint === "hinge") {
    const pitch = rad(conn.jpitch ?? conn.jangle ?? 0);
    const yaw = rad(conn.jyaw ?? 0);
    return m3AxisAngle(...U, pitch + yaw);                // pin swing only — ring stays put
  }
  const [jx, jy, jz] = conn.jrot ?? [0, 0, 0];   // ball: compose U then V then N
  return m3Mul(m3AxisAngle(...N, rad(jz)), m3Mul(m3AxisAngle(...V, rad(jy)), m3AxisAngle(...U, rad(jx))));
}

// half-extent of a box (half-sizes hw,hh,hd, rotation R) along a unit world dir w
function halfAlong(d, R, w) {
  const ex = [R[0], R[3], R[6]], ey = [R[1], R[4], R[7]], ez = [R[2], R[5], R[8]];
  return d.hw * Math.abs(vDot(w, ex)) + d.hh * Math.abs(vDot(w, ey)) + d.hd * Math.abs(vDot(w, ez));
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

// Seat a child NODE (carrying the attachment) onto its already-placed parent A.
// Returns { placement, ghost }. The seating math is identical to the legacy
// per-connection resolver — only the inputs changed (node vs connection).
function seatChild(A, conn, Bspec, bd) {
  const F = FACES[conn.on ?? "top"] ?? FACES.top;

  // mount frame: world axes by default, parent's local frame when `local`
  const faceR = conn.local ? A.R : I3;
  const N = m3MulV(faceR, F.n), U = m3MulV(faceR, F.u), V = m3MulV(faceR, F.v);
  const [du, dv] = conn.off ?? [0, 0];

  // Two exclusive seating modes with completely different logic:
  //   grid — rigid LEGO clutch: 90deg `rot`, parity stud-snap, whole-stud `off`.
  //   free — articulated joint: the node's joint center is mated to A's joint
  //          center (a shared hinge pin / ball center) and swings about THAT point.
  const mode = connMode(conn);
  let Rb, Cb, mountN = N, mesh = null, ghost = null;
  const jt = conn.joint === "ball" ? "ball" : "hinge";
  const aIdx = mode === "free" ? jointIdxOf(A.spec, conn.ah, jt) : -1;
  const bIdx = mode === "free" ? jointIdxOf(Bspec, conn.bh, jt) : -1;
  const aOp = aIdx >= 0 ? A.spec.ops[aIdx] : null;
  const bOp = bIdx >= 0 ? Bspec.ops[bIdx] : null;
  if (mode === "free" && aOp && bOp) {
    const fa = jointFrame(A.spec, aOp), fb = jointFrame(Bspec, bOp);   // local frames
    const nA = vNorm(m3MulV(A.R, fa.n)), pinA = vNorm(m3MulV(A.R, fa.pin));
    const pivot = vAdd(A.C, m3MulV(A.R, fa.center));     // shared hinge pin / ball center
    // base seat: node's joint faces A's (normal opposes, pin parallel), joint center
    // on the pivot. seat(R) returns the center so the node's joint center -> pivot.
    const nt = vScale(nA, -1), qt = vCross(nt, pinA);
    const R0 = m3Mul(matCols(nt, pinA, qt), matRows(fb.n, fb.pin, vCross(fb.n, fb.pin)));
    const seat = (R) => vSub(pivot, m3MulV(R, fb.center));
    if (jt === "hinge") {
      // Two pieces: the KNUCKLE stays interlocked (swings about the pin only); the
      // BODY additionally yaws about the joint normal — "rotate the block, not the
      // hinge". Both pivot about the shared ring center.
      const pitch = rad(conn.jpitch ?? conn.jangle ?? 0), yaw = rad(conn.jyaw ?? 0);
      const Rring = pitch ? m3Mul(m3AxisAngle(...pinA, pitch), R0) : R0;
      // yaw the block first (about the normal), THEN fold the hinge (about the pin)
      const Ryaw = yaw ? m3Mul(m3AxisAngle(...nA, yaw), R0) : R0;
      const Rbody = pitch ? m3Mul(m3AxisAngle(...pinA, pitch), Ryaw) : Ryaw;
      Rb = Rbody; Cb = seat(Rbody); mountN = nA;
      mesh = { skip: bIdx };                             // body omits the linked knuckle
      ghost = { id: `${conn.part}#knuckle`, spec: Bspec, d: bd, R: Rring, C: seat(Rring),
        depth: (A.depth ?? 0) + 1, mountN: nA, mesh: { only: bIdx } };
    } else {
      const Rj = jointRot(conn, pinA, vNorm(qt), nA);    // ball: whole node spins about center
      Rb = Rj !== I3 ? m3Mul(Rj, R0) : R0; Cb = seat(Rb); mountN = nA;
    }
  } else if (mode === "free") {
    // fallback (parts lack a matching joint op): flush seat, pivot at joint center
    Rb = conn.local ? A.R : I3;
    const Pa = vAdd(vAdd(A.C, vScale(N, halfAlong(A.d, A.R, N))), vAdd(vScale(U, du), vScale(V, dv)));
    Cb = vAdd(Pa, vScale(N, halfAlong(bd, Rb, N)));
    const Rj = jointRot(conn, U, V, N);
    if (Rj !== I3) { Rb = m3Mul(Rj, Rb); Cb = vAdd(Pa, m3MulV(Rj, vSub(Cb, Pa))); }
  } else {
    const r = conn.rot ?? [0, conn.angle ?? 0, 0];       // legacy `angle` == rot Y
    Rb = m3Mul(m3Rot("x", rad(r[0])), m3Mul(m3Rot("y", rad(r[1])), m3Rot("z", rad(r[2]))));
    if (conn.local) Rb = m3Mul(A.R, Rb);
    const su = studSnap(U, A, Rb, bd), sv = studSnap(V, A, Rb, bd);  // parity-correct to A's stud grid
    const Pa = vAdd(vAdd(A.C, vScale(N, halfAlong(A.d, A.R, N))), vAdd(vScale(U, du + su), vScale(V, dv + sv)));
    Cb = vAdd(Pa, vScale(N, halfAlong(bd, Rb, N)));      // flush along normal
  }

  const placement = { id: conn.part, spec: Bspec, d: bd, R: Rb, C: Cb,
    depth: (A.depth ?? 0) + 1, mountN, mesh };
  return { placement, ghost };
}

// Walk the assembly tree, DFS preorder (parent before children), placing every
// node into { id, spec, d, R, C, depth, mountN, mesh }. Shared by the renderer
// and the UI so both agree on placement. The root node seats at the origin and
// carries no attachment; each child seats onto its parent via seatChild. Hinges
// also emit a render-only "ghost" knuckle that stays interlocked as the body folds.
function placeAll(model) {
  const nodes = [];      // every placement, DFS preorder = build order
  const ghosts = [];     // render-only knuckles
  const baseY = model.baseY ?? 0;

  const walk = (node, A) => {
    if (!node) return;
    const spec = model.parts?.[node.part];
    if (!spec) { console.warn(`[assembly] unknown part ${node?.part}`); return; }
    const d = dims(spec);
    let placement;
    if (!A) {
      placement = { id: node.part, spec, d, R: I3, C: [0, baseY + d.hh, 0],
        depth: 0, mountN: [0, 1, 0], mesh: null };
      nodes.push(placement);
    } else {
      const { placement: pl, ghost } = seatChild(A, node, spec, d);
      placement = pl;
      nodes.push(pl);
      if (ghost) ghosts.push(ghost);
    }
    for (const ch of node.children ?? []) walk(ch, placement);
  };
  walk(model.root, null);

  return { list: [...nodes, ...ghosts] };
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
