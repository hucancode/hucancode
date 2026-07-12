// SKELETON ENGINE — BONES, nothing else. No parts, no slots, no joints, no
// meshes: a bone is ONE degree of freedom hanging off a parent bone.
//
//   world(bone) = world(parent) ∘ T(offset) ∘ REST ∘ M(bone)
//
// M(bone) is that single DOF:
//   "x" | "y" | "z"     ONE rotation about ONE axis  (a hinge, a turntable)
//   "free"              ONE full rotation, all axes  (a ball; set `rot`)
//   "tx" | "ty" | "tz"  ONE translation along ONE axis (a prismatic)
//
// REST is a fixed rotation baked at build time (assemble puts the joint's
// seating rotation there); `offset` is where the bone sits in its parent's
// frame. Per frame only `angle` (or `rot`) changes.
import { I3, vAdd, m3Mul, m3MulV, m3Rot } from "../math/mat3.js";

// a transform is { r: mat3, t: vec3 }; compose applies b in a's frame
const compose = (a, b) => ({ r: m3Mul(a.r, b.r), t: vAdd(a.t, m3MulV(a.r, b.t)) });

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
    // FK: every bone's world transform, parents before children (assemble always
    // adds a parent before its children, so one pass suffices)
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
        const local = { r: R, t: vAdd(b.offset, t) };
        out.push(b.parent < 0 ? local : compose(out[b.parent], local));
      }
      return out;
    },
  };
}
