// Assembly engine: resolve a part graph into world transforms.
//
// A model = { parts: {id: spec}, root, baseY?, connections: [...] }.
// Each connection mounts part B onto a FACE of an already-placed part A:
//   { a, b, on:"top|bottom|front|back|left|right",
//     off:[du,dv],         // in-plane offset on A's face, in studs (default 0,0)
//     bFace:"bottom",      // B's mating face (default "bottom")
//     bOff:[du,dv],        // in-plane offset on B's mating face (default 0,0)
//     angle: deg }         // twist of B about the mount normal (default 0)
//
// B's mating face is laid flush against A's `on` face; heights/positions fall
// out of the stack. Resolution order = connection order = build order.

import { TYPE_HEIGHT, BRICK_H } from "./brick.js";

const D2R = Math.PI / 180;

// ---- tiny row-major 3x3 rotation lib ---------------------------------------
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

// ---- part dimensions -------------------------------------------------------
function dims(spec) {
  const sx = spec.size ? spec.size[0] : (spec.sx ?? spec.studsX ?? 2);
  const sz = spec.size ? spec.size[1] : (spec.sz ?? spec.studsZ ?? 2);
  const h = spec.h ?? spec.height ?? TYPE_HEIGHT[spec.type] ?? BRICK_H;
  return { sx, sz, h, hw: sx / 2, hd: sz / 2, hh: h / 2 };
}

// face center + in-plane axes (A local frame). off applied as du*u + dv*v.
function facePoint(d, face, off = [0, 0]) {
  const [du, dv] = off;
  switch (face) {
    case "top":    return [du, d.hh, dv];
    case "bottom": return [du, -d.hh, dv];
    case "front":  return [du, dv, d.hd];
    case "back":   return [du, dv, -d.hd];
    case "right":  return [d.hw, dv, du];
    case "left":   return [-d.hw, dv, du];
  }
  return [du, d.hh, dv];
}

// rotation aligning B's mating face (default bottom, -Y) onto A's `on` face
function mountRot(on) {
  switch (on) {
    case "top":    return I3;
    case "bottom": return rotX(Math.PI);
    case "front":  return rotX(Math.PI / 2);
    case "back":   return rotX(-Math.PI / 2);
    case "right":  return rotZ(-Math.PI / 2);
    case "left":   return rotZ(Math.PI / 2);
  }
  return I3;
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
    const bFace = conn.bFace ?? "bottom";

    // world contact point on A's face
    const Pa = add(A.C, apply3(A.R, facePoint(A.d, on, conn.off ?? [0, 0])));
    // B orientation: A frame -> twist about mount normal -> align mating face
    const Rb = mul3(A.R, mul3(rotY((conn.angle ?? 0) * D2R), mountRot(on)));
    // place B so its mating-face point coincides with Pa
    const Pb = facePoint(bd, bFace, conn.bOff ?? [0, 0]);
    const Cb = sub(Pa, apply3(Rb, Pb));

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
