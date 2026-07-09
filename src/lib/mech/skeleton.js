// SKELETON — the rig machinery both rigs (dragon, atlas) are built on.
//
// Skeleton rules (the whole point of a rig):
//   - a bone is ONE rotation about ONE axis. Only joints rotate, so every
//     bone sits on a joint DOF: a ball joint = 3 chained bones (x, y, z),
//     an L-seated hinge1 = 3 bones (spinF, swing, spinM), a hinge = 1 bone.
//   - every primitive rides exactly one bone, and a rig NEVER re-models
//     geometry: it instantiates parts (kit.buildPart) and places them.
//
// Parts connect by MOUNT SLOT MATCHING: joints define their two mount slots
// (jointMounts), parts re-export them in part space (kit.partSlots), and a rig
// definition just names which slot mates with which — positions coincide,
// normals oppose, and a joint's bones rotate about the match point.
import { meshOf } from "./primitives.js";
import {
  I3, vAdd, vScale, vLen, vNorm, vCross, m3Mul, m3MulV, m3T, m3Rot,
} from "../math/mat3.js";

// orthonormal frame with local +Z aligned to z, +Y as up as possible
// (columns X, Y, Z)
export function frameFromZ(z) {
  const Z = vNorm(z);
  let X = vCross([0, 1, 0], Z);
  if (vLen(X) < 1e-4) X = vCross([1, 0, 0], Z);   // tangent went vertical
  X = vNorm(X);
  const Y = vCross(Z, X);
  return [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]];
}

// xf = { r: mat3, t: vec3 }; compose applies b in a's frame
export const xf = (r, t) => ({ r, t });
export const xfCompose = (a, b) => ({ r: m3Mul(a.r, b.r), t: vAdd(a.t, m3MulV(a.r, b.t)) });
export const xfT = (t) => ({ r: I3, t });

// ---- mount-slot frames -------------------------------------------------------
// a slot { pos, n, f } forms a full coordinate system: columns [f, n×f, n]
export const slotFrame = (s) => {
  const f = vNorm(s.f), n = vNorm(s.n), b = vCross(n, f);
  return [f[0], b[0], n[0], f[1], b[1], n[1], f[2], b[2], n[2]];
};
// REST rotation seating a child slot against a parent slot: positions
// coincide (handled by the bone offset), forwards ALIGN, normals OPPOSE
export const matchRot = (parentSlot, childSlot) => {
  const f = vNorm(parentSlot.f), n = vScale(vNorm(parentSlot.n), -1);
  const b = vCross(n, f);
  const target = [f[0], b[0], n[0], f[1], b[1], n[1], f[2], b[2], n[2]];
  return m3Mul(target, m3T(slotFrame(childSlot)));
};

// ---- skeleton --------------------------------------------------------------
// bone = one rotation about one axis, seated at `offset` in the parent frame,
// with an optional fixed REST rotation (the slot-match orientation).
// world(bone) = world(parent) ∘ T(offset) ∘ REST ∘ R(axis, angle)
export function createSkeleton() {
  const bones = [];
  return {
    bones,
    add(name, parent = -1, offset = [0, 0, 0], axis = "x", rest = null) {
      bones.push({ name, parent, offset, axis, angle: 0, rest });
      return bones.length - 1;
    },
    resolve() {
      const out = [];
      for (const b of bones) {
        let R = m3Rot(b.axis, b.angle);
        if (b.rest) R = m3Mul(b.rest, R);
        out.push(b.parent < 0 ? xf(R, [...b.offset]) : xfCompose(out[b.parent], xf(R, b.offset)));
      }
      return out;
    },
  };
}

// a full 3-DOF joint (ball / shoulder) = 3 chained bones, x -> y -> z; the rest
// (slot-match) rotation rides the first bone
export function addBall(sk, name, parent, offset = [0, 0, 0], rest = null) {
  const x = sk.add(`${name}.x`, parent, offset, "x", rest);
  const y = sk.add(`${name}.y`, x, [0, 0, 0], "y");
  const z = sk.add(`${name}.z`, y, [0, 0, 0], "z");
  return [x, y, z];
}

// set the 3 chained bones from a relative rotation matrix (M = Rx·Ry·Rz)
export function setBall(sk, ids, M) {
  const sy = Math.max(-1, Math.min(1, M[2]));
  if (Math.abs(sy) > 0.99999) {                   // gimbal: fold z into x
    sk.bones[ids[0]].angle = (sy > 0 ? 1 : -1) * Math.atan2(M[3], M[4]);
    sk.bones[ids[1]].angle = Math.asin(sy);
    sk.bones[ids[2]].angle = 0;
  } else {
    sk.bones[ids[0]].angle = Math.atan2(-M[5], M[8]);
    sk.bones[ids[1]].angle = Math.asin(sy);
    sk.bones[ids[2]].angle = Math.atan2(-M[1], M[0]);
  }
}

// mirrored copy of a slot (X-flip): the other flank of a symmetric rig
export const mirrorSlot = (s) => ({
  pos: [-s.pos[0], s.pos[1], s.pos[2]],
  n: [-s.n[0], s.n[1], s.n[2]],
  f: [-s.f[0], s.f[1], s.f[2]],
});

// the unit meshes an item list references, cached across frames — the renderer
// draws one instanced call per key
export function createMeshCache() {
  const meshes = {};
  return {
    meshes,
    ensure(items) {
      for (const it of items) if (!meshes[it.key]) meshes[it.key] = meshOf(it.key);
    },
  };
}
