// ATLAS RIG — a standing humanoid on the same machinery as the dragon rig:
// parts (atlas/parts.js) connect by mount-slot matching, one bone per joint
// DOF, no curve — the pose sliders drive the bones directly. Every articulated
// link plugs its part's MOVING joint half onto the FIXED half its parent part
// emits, so the bone rotation happens inside a real mechanism.
import { ATLAS_KIT } from "./parts.js";
import { currentJointGroup, resetJointGroups } from "../joints.js";
import { colorMemo } from "../color.js";
import { bake } from "../primitives.js";
import {
  createSkeleton, addBall, matchRot, createMeshCache, xfCompose, xfT,
} from "../skeleton.js";
import { rad } from "../../math/scalar.js";
import { vAdd, vSub, vScale, vNorm, m3Mul, m3MulV } from "../../math/mat3.js";

// runtime rig controls (degrees)
export const ATLAS_POSE = {
  headYaw: 0, headPitch: 0, twist: 0, waistBend: 0, waistTilt: 0,
  shoulder: 0, armOut: 30, elbow: 60,
  wristBend: 0, wristTilt: 30, wristTwist: 0, curl: 30,
  hip: 0, knee: 0,
};

// Rehearsed routines for the choreographer: a setup pose the rig strikes, then
// a sequence of partial poses walked keyframe by keyframe.
//
// Every pose channel drives BOTH sides, so the atlas always waves with two
// arms: `armOut` swings them out to the sides, `shoulder` swings them forward.
const REST = {
  armOut: 0, shoulder: 0, elbow: 0, wristBend: 0, wristTilt: 0,
  wristTwist: 0, curl: 0, twist: 0, waistBend: 0, waistTilt: 0,
  headPitch: 0, headYaw: 0,
};
// A wave: strike the setup, then run a ripple out of it `loops` times. The lead
// joint swings away and settles back to whatever the setup put it at, and each
// joint down the chain picks the motion up as the one before it lets go.
const wave = (setup, lead) => ({
  setup: { ...REST, ...setup },
  sequence: [
    lead,
    { ...Object.fromEntries(Object.keys(lead).map((k) => [k, setup[k]])), elbow: 45 },
    { elbow: 0, wristBend: 45 },
    { wristBend: 0, curl: 60 },
    { curl: 0 },
  ],
  stepRatio: 0.3, loops: 4,
});

export const ATLAS_MONTAGES = {
  // arms out level with the shoulders, ripple running down each one
  armWave: wave({ armOut: 90 }, { armOut: 115 }),
  // arms held out front, the ripple travelling away from the chest
  frontWave: wave({ shoulder: 90 }, { shoulder: 115 }),
};

// `angles` maps a bone axis of the link's 3-DOF joint to [pose key, sign];
// `curl` marks the finger links whose part rebuilds with the internal-digit
// pose channel fed from the knuckle bone. `swingBone` marks a link that owns
// BOTH halves of its mount hinge: the named bone's rotation is the pin swing,
// so it must not turn the part's fixed half — it goes to the part's pose
// channel instead, and the part is placed by the bone ABOVE it.
const atlasSide = (S, sgn) => [
  // the right arm seats with a rotY(pi) rest (the shoulder hinge1 disc must
  // face the chest), which flips the LOCAL x/z senses — hence per-side signs.
  // x = spinF, the mount-1 ROOT DISC turning in the torso's cone seat (a rigid
  // spin of the whole joint); z = the pin swing, which only the tang takes.
  { name: `arm${S}`, part: "upperArm", parent: "torso", at: `shoulder${S}`, slot: "mount",
    angles: { x: ["shoulder", -sgn], z: ["armOut", -1] }, swingBone: "z" },
  { name: `fore${S}`, part: "forearm", parent: `arm${S}`, at: "elbow", slot: "mount",
    angles: { x: ["elbow", -sgn] } },
  // hinge2 wrist: bend rides the wrist link's stage-A pin (X). The wrist part
  // owns the WHOLE stage-B hinge, so tilt lives on a `pinBone` seated at that
  // stage's pin and feeds the part's pose channel — only the tang swings.
  // The palm bolts to the tang's disc, so its twist IS that disc turning.
  { name: `wrist${S}`, part: "wrist", parent: `fore${S}`, at: "wrist", slot: "mount",
    angles: { x: ["wristBend", -sgn] },
    pinBone: { at: "pin", axis: "z", angle: ["wristTilt", 1], pose: "tilt" } },
  { name: `palm${S}`, part: "palm", parent: `wrist${S}`, at: "out", slot: "mount",
    angles: { y: ["wristTwist", sgn] } },
  ...[0, 1, 2].map((i) => ({
    name: `finger${S}${i}`, part: "finger", parent: `palm${S}`, at: `f${i}`, slot: "mount",
    angles: { x: ["curl", -1] }, curl: true,
  })),
  { name: `leg${S}`, part: "thigh", parent: "pelvis", at: `hip${S}`, slot: "mount",
    angles: { x: ["hip", -1] } },
  { name: `shin${S}`, part: "shin", parent: `leg${S}`, at: "knee", slot: "mount",
    angles: { x: ["knee", 1] } },
  { name: `foot${S}`, part: "foot", parent: `shin${S}`, at: "ankle", slot: "mount" },
];

const ATLAS_DEF = [
  { name: "pelvis", part: "pelvis", pivot: "waist" },
  // the waist is a ball: all three bones of the link carry a channel
  { name: "torso", part: "torso", parent: "pelvis", at: "waist", slot: "mount",
    angles: { x: ["waistBend", 1], y: ["twist", 1], z: ["waistTilt", 1] } },
  { name: "head", part: "head", parent: "torso", at: "neck", slot: "mount",
    angles: { x: ["headPitch", 1], y: ["headYaw", 1] } },
  ...atlasSide("L", 1),
  ...atlasSide("R", -1),
];

// root placement in the ground plane; the lift is solved from the built figure
// (createAtlasRig) so the soles stand on the grid whatever the part params are
const ATLAS_ROOT = [0, 0, 0];

// bone depth of every pose channel (pelvis = 0). A channel drives the link it
// sits on, so its depth IS that link's depth: `twist` turns the torso near the
// root, `curl` turns a finger out at a leaf. The choreographer reads this to
// tell a big root move from a small leaf one.
export const ATLAS_POSE_DEPTH = (() => {
  const depth = {}, out = {};
  const note = (key, d) => { out[key] = key in out ? Math.min(out[key], d) : d; };
  for (const d of ATLAS_DEF) {
    const dep = d.parent ? depth[d.parent] + 1 : 0;
    depth[d.name] = dep;
    for (const [key] of Object.values(d.angles ?? {})) note(key, dep);
    if (d.pinBone) note(d.pinBone.angle[0], dep);
  }
  return out;
})();

export function createAtlasRig(seed = 1) {
  const defs = ATLAS_DEF.map((d) => ({ ...d, slots: ATLAS_KIT.partSlots(d.part, d.params ?? null) }));
  const byName = Object.fromEntries(defs.map((d) => [d.name, d]));
  for (const d of defs) d.slots.slot0 = d.slots[d.parent ? d.slot : d.pivot];

  // skeleton: every link = 3 chained bones at the slot-match point (unused
  // axes just stay at angle 0)
  const sk = createSkeleton();
  const AX = { x: 0, y: 1, z: 2 };
  const boneOf = {}, geoOf = {}, depthOf = {};
  // where a link's children measure their offset from: the slot the link's
  // own bones sit on, unless a pinBone moved the child anchor down to a pin
  const anchorOf = (d) => (d.pinBone ? d.slots[d.pinBone.at].pos : d.slots.slot0.pos);
  for (const d of defs) {
    const par = d.parent ? byName[d.parent] : null;
    const offset = par ? vSub(par.slots[d.at].pos, anchorOf(par)) : [...ATLAS_ROOT];
    const rest = par ? matchRot(par.slots[d.at], d.slots[d.slot]) : null;
    d.ids = addBall(sk, d.name, par ? boneOf[d.parent] : -1, offset, rest);
    boneOf[d.name] = d.ids[2];                       // children chain off the full rotation
    // a swingBone link owns its whole mount hinge: its fixed half must not
    // turn with the swing, so the geometry hangs on the bone just above it
    geoOf[d.name] = d.swingBone ? d.ids[AX[d.swingBone] - 1] : d.ids[2];
    // a pinBone link owns a hinge further down its own body: the swing sits on
    // an extra bone at that pin, which the children (but not the part) ride
    if (d.pinBone) {
      d.pinId = sk.add(`${d.name}.pin`, d.ids[2],
        vSub(d.slots[d.pinBone.at].pos, d.slots.slot0.pos), d.pinBone.axis);
      boneOf[d.name] = d.pinId;
    }
    depthOf[d.name] = par ? depthOf[d.parent] + 1 : 0;
  }

  const colorFor = colorMemo(seed);
  const capture = (d, ppose, out) => {
    ATLAS_KIT.buildPart(d.part, (g) => {
      const b = bake(g);
      out.push({
        key: b.key, m: b.m, t: b.t,
        color: colorFor(b.id),
        group: `${d.name}:${currentJointGroup() ?? "body"}`,
      });
    }, d.params ?? null, ppose);
    return out;
  };
  // static templates for every part without a live pose channel (all but the
  // fingers, whose internal digit joints follow the curl bone, and the links
  // that articulate their own mount hinge)
  resetJointGroups();
  for (const d of defs) if (!d.curl && !d.swingBone && !d.pinBone) d.tpl = capture(d, null, []);

  const meshCache = createMeshCache();

  function model(pose = {}) {
    const o = { ...ATLAS_POSE, ...pose };
    for (const d of defs) {
      if (d.pinBone) {
        const [key, sign] = d.pinBone.angle;
        sk.bones[d.pinId].angle = sign * rad(o[key]);
      }
      if (!d.angles) continue;
      for (const [axis, [key, sign]] of Object.entries(d.angles))
        sk.bones[d.ids[AX[axis]]].angle = sign * rad(o[key]);
    }
    const W = sk.resolve();

    const items = [];
    resetJointGroups();
    for (const d of defs) {
      const t = xfCompose(W[geoOf[d.name]], xfT(vScale(d.slots.slot0.pos, -1)));
      const an = vNorm(vScale(m3MulV(t.r, d.slots.slot0.n), -1));
      const depth = depthOf[d.name];
      const ppose = d.curl ? { curl: sk.bones[d.ids[0]].angle }
        : d.swingBone ? { swing: sk.bones[d.ids[AX[d.swingBone]]].angle }
        : d.pinBone ? { [d.pinBone.pose]: sk.bones[d.pinId].angle }
        : null;
      for (const e of d.tpl ?? capture(d, ppose, []))
        items.push({
          key: e.key,
          m: m3Mul(t.r, e.m),
          t: vAdd(m3MulV(t.r, e.t), t.t),
          color: e.color, group: e.group, an, depth,
        });
    }
    meshCache.ensure(items);
    return { items, meshes: meshCache.meshes };
  }

  // stand the figure on the grid: build the rest pose off an unlifted root and
  // push the root up by the lowest vertex it puts underground (the soles). The
  // span the same sweep measures is the standing height, which frames the view.
  const rootBone = sk.bones[defs[0].ids[0]];
  let minY = Infinity, maxY = -Infinity;
  for (const it of model().items) {
    const { positions } = meshCache.meshes[it.key];
    for (let i = 0; i < positions.length; i += 3) {
      const y = it.m[3] * positions[i] + it.m[4] * positions[i + 1]
        + it.m[5] * positions[i + 2] + it.t[1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  rootBone.offset[1] -= minY;

  return { model, height: maxY - minY };
}

let _arig = null, _arigSeed = null;
const rigFor = (seed) => {
  if (!_arig || _arigSeed !== seed) { _arig = createAtlasRig(seed); _arigSeed = seed; }
  return _arig;
};
// head-to-sole span of the standing figure — the page aims the camera at its middle
export const atlasHeight = (seed = 1) => rigFor(seed).height;
export function atlasModel(seed = 1, pose = {}) {
  return rigFor(seed).model(pose);
}
