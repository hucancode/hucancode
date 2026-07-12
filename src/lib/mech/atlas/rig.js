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

// The channels that live on a limb, and so exist once per flank: the rig is
// ALWAYS split, `shoulderL` and `shoulderR` are two separate channels on two
// separate bones, and nothing here ever ties them together. Mirroring is not a
// wiring — it is a rule the CALLER keeps (write the left channel, copy it into
// the right), so there is only ever one set of sliders to reason about.
// Everything else (waist, neck) sits on the spine and is never doubled.
export const SIDE_CHANNELS = [
  "shoulder", "armOut", "armTwist", "elbow", "foreTwist",
  "wristBend", "wristTilt", "wristTwist", "curl", "hip", "knee",
];
export const SIDES = ["L", "R"];
const SIDED = new Set(SIDE_CHANNELS);
// a pose channel's name on flank S — spine channels have no flank, so they keep
// the name they were written with
export const chan = (key, S) => (SIDED.has(key) ? key + S : key);
// a pose written in bare channel names, forked onto BOTH flanks
const forSides = (pose) => {
  const out = {};
  for (const [k, v] of Object.entries(pose)) {
    if (SIDED.has(k)) for (const S of SIDES) out[k + S] = v;
    else out[k] = v;
  }
  return out;
};
// the bare channel a flanked one came off (`elbowR` -> `elbow`); spine keys pass
export const baseChan = (key) => {
  const b = key.slice(0, -1);
  return SIDES.includes(key.slice(-1)) && SIDED.has(b) ? b : key;
};

// runtime rig controls (degrees), authored once per limb — the real pose object
// carries the forked `atlasPose()` channels
export const ATLAS_POSE = {
  headYaw: 0, headPitch: 0, twist: 0, waistBend: 0, waistTilt: 0,
  shoulder: 0, armOut: 30, armTwist: 0, elbow: 60, foreTwist: 0,
  wristBend: 0, wristTilt: 30, wristTwist: 0, curl: 30,
  hip: 0, knee: 0,
};
export const atlasPose = () => forSides(ATLAS_POSE);

// Rehearsed routines for the choreographer: a setup pose the rig strikes, then a
// KEYFRAME timeline — each key is a partial pose and the `hold` (in beats) it
// takes to reach it, so the routine is authored frame by frame instead of being
// generated. A routine always waves with BOTH arms, each handed its own STYLE —
// the pairing below. A routine whose two styles differ parks the arms in
// OPPOSITE setups, so they ripple against each other; those are offered only
// while the flanks are steered apart, since mirroring would flatten them.
const REST = {
  armOut: 0, shoulder: 0, armTwist: 0, elbow: 0, foreTwist: 0, wristBend: 0, wristTilt: 0,
  wristTwist: 0, curl: 0, twist: 0, waistBend: 0, waistTilt: 0,
  headPitch: 0, headYaw: 0, hip: 0, knee: 0,
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
  { hold: 0.15, pose: { [lead]: level + n, elbow: -2 * n, wristBend: n } },
  // shoulder home, elbow up n -> wrist down 2n, fingers up n
  { hold: 0.12, pose: { [lead]: level, elbow: n, wristBend: -2 * n } },
  // elbow home, wrist up n -> fingers down 2n
  { hold: 0.12, pose: { elbow: 0, wristBend: n } },
  { hold: 0.12, pose: { wristBend: 0, curl: -n } },   // wrist home, fingers up
  { hold: 0.15, pose: { curl: 0 } },                  // fingers home
];

// The arm ripple run BACKWARDS — and this is NOT the forward key list reversed.
// The bone chain only runs one way: a joint carries everything BELOW it and
// nothing above it, so a finger can never counter its own wrist. The counters
// therefore always land on the joints UNDER the one that is swinging, whichever
// way along the arm the crest happens to be travelling.
//
// So the crest starts at the fingers (a leaf — nothing under them to compensate)
// and climbs. Each key swings the joint the crest has reached by +n while ITS OWN
// descendants fold -2n / +n back underneath — and that fold is also what releases
// the joint that just handed the crest up. `lead` = the shoulder channel, parked
// at `level` by the setup.
// The finger curl runs the OTHER WAY ROUND from the bend channels — a positive
// curl closes the hand, i.e. bends it the way a negative wrist bend does — so
// every compensation that lands on the fingers comes through with its sign
// flipped.
const VERT_WAVE = (lead, level, n) => [
  { hold: 0.12, pose: { curl: n } },                              // fingers lead: nothing below them
  { hold: 0.12, pose: { wristBend: n, curl: -2 * n } },             // wrist swings, fingers fold under it
  { hold: 0.12, pose: { elbow: n, wristBend: -2 * n, curl: n } }, // elbow swings, wrist + fingers under it
  // shoulder swings, the whole arm under it folds back
  { hold: 0.12, pose: { [lead]: level - n, elbow: -2 * n, wristBend: n, curl: 0 } },
  // the crest is off the top of the chain: everything unwinds to the setup
  { hold: 0.12, pose: { [lead]: level, elbow: 0, wristBend: 0, curl: 0 } },
];

// ONE ARM'S wave, whole and self-contained: the `raise` it strikes on top of REST,
// and the key list the crest travels through from there. A style is written for a
// single arm and knows nothing about the other one — pairing two of them is what
// makes a routine, so a style that swings the arm FORWARD and one that swings it
// BACK are simply two constants, not one constant with a sign flag.
// The BACK / HANG styles are the reversed setups: same ripple, struck from the
// opposite parking spot, so the crest travels the other way through the arm.
const STYLE = {
  // arm out to the flank, waving in the side plane
  sideOut: { raise: { armOut: 90, armTwist: -90 }, keys: WAVE("armOut", 90, 35), loops: 3 },
  // arm reached forward, waving fore/aft
  front: { raise: { shoulder: 90 }, keys: WAVE("shoulder", 90, 35), loops: 3 },
  // arm swung BACK behind the figure — the fore/aft wave run the other way
  back: { raise: { shoulder: -90 }, keys: WAVE("shoulder", -90, -35), loops: 3 },
  // arm straight up, the crest climbing from the fingers to the shoulder
  overhead: { raise: { armOut: 180, armTwist: 0 }, keys: VERT_WAVE("shoulder", 0, 20), loops: 2 },
  // arm hanging at the side, the same climb run downward off the low parking spot
  hang: { raise: { armOut: 0, armTwist: 0 }, keys: VERT_WAVE("shoulder", 0, -20), loops: 2 },
};

// A ROUTINE pairs a style per flank. The two columns are always struck, so both
// arms always move; where the columns differ the arms park in OPPOSITE setups
// (one forward, one back; one overhead, one down) and wave against each other.
// Those OPPOSED pairs are dropped while the caller is mirroring — it would copy
// the left arm over the right and flatten them back into one move.
// The choreographer draws routines at random, so the opposed pairs come up on
// their own; paired styles must share a key count and holds.
const ROUTINES = {
  armWave: { L: STYLE.sideOut, R: STYLE.sideOut },
  frontWave: { L: STYLE.front, R: STYLE.front },
  frontWaveOpposed: { L: STYLE.front, R: STYLE.back },
  verticalWave: { L: STYLE.overhead, R: STYLE.overhead },
  verticalWaveOpposed: { L: STYLE.overhead, R: STYLE.hang },
};

// a single arm's partial pose, moved onto flank S (spine channels pass through)
const onSide = (pose, S) =>
  Object.fromEntries(Object.entries(pose).map(([k, v]) => [chan(k, S), v]));

// The two styles laid side by side: setups merged, and key `i` of the left run
// merged with key `i` of the right, so the arms ripple in lockstep out of
// whatever setups they were each given.
export const atlasMontages = (mirror = false) =>
  Object.fromEntries(
    Object.entries(ROUTINES)
      .filter(([name]) => !mirror || !name.endsWith("Opposed"))
      .map(([name, { L, R }]) => [name, {
        setup: { ...forSides(REST), ...onSide(L.raise, "L"), ...onSide(R.raise, "R") },
        keys: L.keys.map((k, i) => ({
          ...k,
          pose: { ...onSide(k.pose, "L"), ...onSide(R.keys[i].pose, "R") },
        })),
        loops: L.loops,
      }]),
  );

// one arm + one leg, on its OWN channels (`elbowL` / `elbowR`). `sgn` flips the
// ones that must read the same way on both flanks — the right side's joint seats
// mirrored, so its local senses flip — which is why a raise is still a raise when
// the same value is copied from the left channel onto the right one.
const side = (S, sgn) => {
  const c = (key, s) => [chan(key, S), s];
  return [
  // shoulder: the female DISC spins the arm fore/aft, the PIN swings it out, and
  // the male disc is the turntable the upper arm rolls on (armTwist)
  { name: `arm${S}`, part: "upperArm", parent: "torso", at: `shoulder${S}`,
    angles: [c("shoulder", -sgn), c("armOut", -1), c("armTwist", sgn)] },
  // the tang's flange is a DISC: it seats on the forearm box's top face and
  // carries it up to the pin, so the box stays clear of the jaw — and that same
  // disc is the turntable the forearm rolls on (foreTwist)
  { name: `fore${S}`, part: "forearm", parent: `arm${S}`, at: "elbow",
    angles: [c("elbow", -sgn), c("foreTwist", sgn)] },
  // the palm bolts straight to the wrist's tang disc — the twist IS that disc
  { name: `palm${S}`, part: "palm", parent: `fore${S}`, at: "wrist",
    angles: [c("wristBend", -sgn), c("wristTilt", 1), c("wristTwist", sgn)] },
  // three fingers, three digits each, every knuckle on the one curl channel
  ...[0, 1, 2].flatMap((f) => [0, 1, 2].map((i) => ({
    name: `dig${S}${f}${i}`,
    part: "digit",
    params: { w: 0.1 * (1 - i * 0.12), len: 0.12 },
    parent: i === 0 ? `palm${S}` : `dig${S}${f}${i - 1}`,
    at: i === 0 ? `f${f}` : "tip",
    angles: [c("curl", 1)],
  }))),
  // hip: the DISC swings the leg fore/aft (the pin would kick it out sideways)
  { name: `leg${S}`, part: "thigh", parent: "pelvis", at: `hip${S}`,
    angles: [c("hip", -sgn), null, null] },
  { name: `shin${S}`, part: "shin", parent: `leg${S}`, at: "knee",
    angles: [c("knee", 1)] },
  { name: `foot${S}`, part: "foot", parent: `shin${S}`, at: "ankle" },
  ];
};

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
  const restPose = atlasPose();

  // `opts` goes straight to the assembly's emit, so a build animation can
  // displace groups through it
  function model(pose = {}, opts = {}) {
    const o = { ...restPose, ...pose };
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

// one live rig, rebuilt when the color seed changes
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
