// ATLAS RIG — DATA. A standing humanoid on the same engines as the dragon: the
// links below name parts and the parent slots they bolt to, the assemble engine
// instantiates the joints and spends the bones, and the pose SLIDERS
// (ATLAS_POSE) are the whole public surface — a choreographer drives those, and
// never touches a bone.
//
// `angles` binds the sliders to a link's joint, one entry per DOF, in the
// joint's own DOF order:
//   disc hinge (shoulder / hip)  [disc spin, pin swing, disc spin]
//   hinge (elbow / knee / ankle) [pin swing]
//   wrist                        [bend, tilt, twist]
//   ball (waist / neck)          one free bone, its three euler channels
// A null entry leaves that DOF resting at zero.
import { ATLAS_KIT, ATLAS_JOINTS } from "./parts.js";
import { createAssembly } from "../assemble.js";
import { rad } from "../../math/scalar.js";

// runtime rig controls (degrees)
export const ATLAS_POSE = {
  headYaw: 0, headPitch: 0, twist: 0, waistBend: 0, waistTilt: 0,
  shoulder: 0, armOut: 30, armTwist: 0, elbow: 60, foreTwist: 0,
  wristBend: 0, wristTilt: 30, wristTwist: 0, curl: 30,
  hip: 0, knee: 0,
};

// Rehearsed routines for the choreographer: a setup pose the rig strikes, then a
// KEYFRAME timeline — each key is a partial pose and the `hold` (in beats) it
// takes to reach it, so the routine is authored frame by frame instead of being
// generated. Every pose channel drives BOTH sides, so the atlas always waves with
// two arms: `armOut` swings them out to the sides, `shoulder` swings them forward.
const REST = {
  armOut: 0, shoulder: 0, armTwist: 0, elbow: 0, foreTwist: 0, wristBend: 0, wristTilt: 0,
  wristTwist: 0, curl: 0, twist: 0, waistBend: 0, waistTilt: 0,
  headPitch: 0, headYaw: 0,
};

// The ripple down an arm, keyframe by keyframe. A joint raising by n swings
// everything below it up with it, so the two joints under it fold back: the next
// one down by 2n, and the one after that up by n again. That +n / -2n / +n chain
// leaves the hand where it was and reads as a CREST at the raised joint instead
// of the whole arm lifting. The crest then travels: each key drops the joint that
// held it back to rest and hands it to the one below, which brings its own pair of
// compensators with it (the finger curl runs the other way round, so its sign is
// flipped).
// `lead` = the shoulder channel the setup holds level (armOut for the side wave,
// shoulder for the front one), `level` = where it holds, `n` = its raise.
const WAVE = (lead, level, n) => [
  // shoulder up n -> elbow down 2n, wrist up n
  { hold: 0.35, pose: { [lead]: level + n, elbow: -2 * n, wristBend: n } },
  // shoulder home, elbow up n -> wrist down 2n, fingers up n
  { hold: 0.30, pose: { [lead]: level, elbow: n, wristBend: -2 * n } },
  // elbow home, wrist up n -> fingers down 2n
  { hold: 0.30, pose: { elbow: 0, wristBend: n } },
  { hold: 0.30, pose: { wristBend: 0, curl: -n } },   // wrist home, fingers up
  { hold: 0.35, pose: { curl: 0 } },                  // fingers home
];

export const ATLAS_MONTAGES = {
  // ARM WAVE. Arms out level with the shoulders and rolled a quarter turn on the
  // shoulder disc — the roll runs -90, not +90, because on that side of the
  // turntable a positive elbow / wrist bend LIFTS the hand the same way `armOut`
  // does, so raise, elbow and wrist all push the wave the same way instead of
  // each joint undoing the one above it. The keys then run the ripple out of the
  // shoulder: raise leads, the elbow picks it up, the wrist after that, the
  // fingers last, and each joint unwinds as the next one takes over.
  armWave: {
    setup: { ...REST, armOut: 90, armTwist: -90 },
    keys: WAVE("armOut", 90, 35),
    loops: 4,
  },
  // FRONT WAVE. Arms held out front (no roll: the elbow already bends in the
  // vertical plane there), the same ripple travelling away from the chest.
  frontWave: {
    setup: { ...REST, shoulder: 90 },
    keys: WAVE("shoulder", 90, 35),
    loops: 4,
  },
};

// one arm + one leg. `sgn` flips the channels that must read the same way on
// both flanks (the right side's joint seats mirrored, so its local senses flip).
const side = (S, sgn) => [
  // shoulder: the female DISC spins the arm fore/aft, the PIN swings it out, and
  // the male disc is the turntable the upper arm rolls on (armTwist)
  { name: `arm${S}`, part: "upperArm", parent: "torso", at: `shoulder${S}`,
    angles: [["shoulder", -sgn], ["armOut", -1], ["armTwist", sgn]] },
  // the tang's flange is a DISC: it seats on the forearm box's top face and
  // carries it up to the pin, so the box stays clear of the jaw — and that same
  // disc is the turntable the forearm rolls on (foreTwist)
  { name: `fore${S}`, part: "forearm", parent: `arm${S}`, at: "elbow",
    angles: [["elbow", -sgn], ["foreTwist", sgn]] },
  // the palm bolts straight to the wrist's tang disc — the twist IS that disc
  { name: `palm${S}`, part: "palm", parent: `fore${S}`, at: "wrist",
    angles: [["wristBend", -sgn], ["wristTilt", 1], ["wristTwist", sgn]] },
  // three fingers, three digits each, every knuckle on the one curl channel
  ...[0, 1, 2].flatMap((f) => [0, 1, 2].map((i) => ({
    name: `dig${S}${f}${i}`,
    part: "digit",
    params: { w: 0.1 * (1 - i * 0.12), len: 0.12 },
    parent: i === 0 ? `palm${S}` : `dig${S}${f}${i - 1}`,
    at: i === 0 ? `f${f}` : "tip",
    angles: [["curl", 1]],
  }))),
  // hip: the DISC swings the leg fore/aft (the pin would kick it out sideways)
  { name: `leg${S}`, part: "thigh", parent: "pelvis", at: `hip${S}`,
    angles: [["hip", -sgn], null, null] },
  { name: `shin${S}`, part: "shin", parent: `leg${S}`, at: "knee",
    angles: [["knee", 1]] },
  { name: `foot${S}`, part: "foot", parent: `shin${S}`, at: "ankle" },
];

const ATLAS_DEF = [
  { name: "pelvis", part: "pelvis", pivot: "waist" },                       // root
  // the waist is a ball: one free bone, all three channels on it
  { name: "torso", part: "torso", parent: "pelvis", at: "waist",
    angles: [[["waistBend", 1], ["twist", 1], ["waistTilt", 1]]] },
  { name: "head", part: "head", parent: "torso", at: "neck",
    angles: [[["headPitch", 1], ["headYaw", 1], null]] },
  ...side("L", 1),
  ...side("R", -1),
];

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
    for (const bind of d.angles ?? []) {
      if (!bind) continue;
      if (Array.isArray(bind[0])) for (const b of bind) { if (b) note(b[0], dep); }
      else note(bind[0], dep);
    }
  }
  return out;
})();

export function createAtlasRig(seed = 1) {
  const rig = createAssembly({ kit: ATLAS_KIT, links: ATLAS_DEF, seed });

  // `opts` goes straight to the assembly's emit, so a build animation can
  // displace groups through it
  function model(pose = {}, opts = {}) {
    const o = { ...ATLAS_POSE, ...pose };
    rig.setPose(Object.fromEntries(Object.keys(o).map((k) => [k, rad(o[k])])));
    return rig.emit(opts);
  }

  // stand the figure on the grid: build the rest pose off an unlifted root and
  // push the root up by the lowest vertex it puts underground (the soles). The
  // span the same sweep measures is the standing height, which frames the view.
  const rootBone = rig.bones[rig.link("pelvis").ids[0]];
  let minY = Infinity, maxY = -Infinity;
  const { items, meshes } = model();
  for (const it of items) {
    const { positions } = meshes[it.key];
    for (let i = 0; i < positions.length; i += 3) {
      const y = it.m[3] * positions[i] + it.m[4] * positions[i + 1]
        + it.m[5] * positions[i + 2] + it.t[1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  rootBone.offset[1] -= minY;

  return { model, height: maxY - minY, rig };
}

let _arig = null, _arigSeed = null;
const rigFor = (seed) => {
  if (!_arig || _arigSeed !== seed) { _arig = createAtlasRig(seed); _arigSeed = seed; }
  return _arig;
};
// head-to-sole span of the standing figure — the page aims the camera at its middle
export const atlasHeight = (seed = 1) => rigFor(seed).height;
export function atlasModel(seed = 1, pose = {}, opts = {}) {
  return rigFor(seed).model(pose, opts);
}
