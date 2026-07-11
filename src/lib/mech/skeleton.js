// SKELETON ENGINE — BONES, nothing else. No parts, no slots, no joints, no
// meshes: this file knows only that a bone is ONE degree of freedom hanging off
// a parent bone.
//
//   world(bone) = world(parent) ∘ T(offset) ∘ REST ∘ M(bone)
//
// M(bone) is the bone's single DOF:
//   "x" | "y" | "z"     ONE rotation about ONE axis  (a hinge DOF, a turntable)
//   "free"              ONE full rotation, all axes  (a ball DOF; set `rot`)
//   "tx" | "ty" | "tz"  ONE translation along ONE axis (a prismatic DOF)
//
// REST is a fixed rotation baked at build time (the assemble engine puts the
// seating rotation of the joint there); `offset` is where the bone sits in its
// parent's frame. Per frame only `angle` (or `rot`, for a free bone) changes.
import { I3, vAdd, m3Mul, m3MulV, m3Rot } from "../math/mat3.js";

// xf = { r: mat3, t: vec3 }; compose applies b in a's frame
export const xf = (r, t) => ({ r, t });
export const xfCompose = (a, b) => ({ r: m3Mul(a.r, b.r), t: vAdd(a.t, m3MulV(a.r, b.t)) });
export const xfT = (t) => ({ r: I3, t });

const SLIDE = { tx: 0, ty: 1, tz: 2 };

export function createSkeleton() {
  const bones = [];
  return {
    bones,
    // axis: "x"|"y"|"z" (rotate) | "free" (rotate, all axes) | "tx"|"ty"|"tz" (slide)
    add(name, parent = -1, offset = [0, 0, 0], axis = "x", rest = null) {
      bones.push({ name, parent, offset, axis, angle: 0, rot: null, rest });
      return bones.length - 1;
    },
    // FK: every bone's world transform, parents before children (the assemble
    // engine always adds a parent before its children, so one pass suffices)
    resolve() {
      const out = [];
      for (const b of bones) {
        let R = I3, t = [0, 0, 0];
        if (b.axis === "free") R = b.rot ?? I3;
        else if (b.axis in SLIDE) t[SLIDE[b.axis]] = b.angle;
        else R = m3Rot(b.axis, b.angle);
        if (b.rest) {                                  // REST ∘ M(bone)
          R = m3Mul(b.rest, R);
          if (t[0] || t[1] || t[2]) t = m3MulV(b.rest, t);
        }
        const local = xf(R, vAdd(b.offset, t));
        out.push(b.parent < 0 ? local : xfCompose(out[b.parent], local));
      }
      return out;
    },
  };
}
