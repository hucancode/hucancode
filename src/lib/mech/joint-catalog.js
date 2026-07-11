// JOINT CATALOG — the reference view of the joint engine: one joint on its own,
// its modeling params and its DOFs exposed. Purely a viewer; the mechanisms live
// in joints.js and every rig bolts through the same specs.
//
// The pose sliders drive the joint's DOF channels — the SAME channels a rig's
// bones bind to, so what the catalog shows a joint doing is exactly what it
// does in a figure. Degrees in, radians out (a prismatic slide is a distance,
// so it skips the conversion).
import { JOINTS, jointModel } from "./joints.js";
import { collect } from "./kit.js";
import { rad } from "../math/scalar.js";

const HINGE = { jaw: 0.24, lugT: 0.12, lugL: 0.45, lugD: 0.55, pinR: 0.14, clr: 0.03, pinOut: 0.05, flangeT: 0.16 };

export const JOINT_PARAMS = {
  hinge: { ...HINGE, tang: 0, discF: 0, discM: 0 },
  discHinge: { ...HINGE },
  wrist: { ...HINGE, tang: 0, discF: 0, discMid: 1, discM: 1 },
  pin: { pinR: 0.14, jaw: 0.24, lugT: 0.12, clr: 0.03, pinOut: 0.05 },
  ball: { ballR: 0.3, socketT: 0.1, cut: 0.75, studR: 0.11, studLen: 0.3, flangeW: 0.95, flangeT: 0.14, disc: 0 },
  pivot: { barrelR: 0.3, barrelLen: 0.8, flangeR: 0.44, neckR: 0.17, neckLen: 0.16, capR: 0.32 },
  prismatic: { sleeveW: 0.5, sleeveLen: 0.7, sleeveD: 0.5, ramW: 0.3, ramLen: 0.7 },
};

// the DOF channels of each joint, in bone order — one slider per bone the joint
// would cost a rig (a ball's one free bone takes all three)
export const JOINT_POSE = Object.fromEntries(
  Object.keys(JOINT_PARAMS).map((k) => [k, Object.fromEntries(JOINTS[k].pose.map((c) => [c, 0]))]),
);

export const JOINT_NAMES = Object.keys(JOINT_PARAMS);

export function jointCatalogModel(kind, seed = 1, params = null, pose = null) {
  const p = { ...JOINT_PARAMS[kind], ...(params || {}) };
  const q = {};
  for (const k of Object.keys(JOINT_POSE[kind]))
    q[k] = kind === "prismatic" ? (pose?.[k] ?? 0) : rad(pose?.[k] ?? 0);
  // the params double as the joint's build options (the disc / tang flags)
  return collect((add) => jointModel(kind, add, p, q, p), seed);
}
