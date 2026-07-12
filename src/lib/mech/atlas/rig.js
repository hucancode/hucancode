// ATLAS RIG — DATA. A standing humanoid on the same engines as the dragon: the
// links below name parts and the parent slots they bolt to, the assemble engine
// instantiates the joints and spends the bones, and the pose SLIDERS are the whole
// public surface — a choreographer drives those, and never touches a bone.
//
// `angles` binds the sliders to a link's joint, one entry per DOF, in the joint's
// own DOF order:
//   disc hinge (shoulder / hip)  [disc spin, pin swing, disc spin]
//   hinge (elbow / knee / ankle) [pin swing]
//   wrist                        [bend, tilt, twist]
//   ball (waist / neck)          one free bone, its three euler channels
// A null entry leaves that DOF resting at zero.
import { ATLAS_KIT } from "./parts.js";
import { createAssembly } from "../assemble.js";
import { rad } from "../../math/scalar.js";

// The channels that live on a limb, and so exist once per flank: the rig is ALWAYS
// split, `shoulderL` and `shoulderR` are two channels on two bones, and nothing
// here ties them together. Mirroring is a rule the CALLER keeps, not a wiring.
export const SIDE_CHANNELS = [
  "shoulder", "armOut", "armTwist", "elbow", "foreTwist",
  "wristBend", "wristTilt", "wristTwist", "curl", "hip", "knee", "ankle",
];
export const SIDES = ["L", "R"];

const D = Math.PI / 180;
const deg = (r) => r / D;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// THE CURL ROLL. `curl` is one slider, but a finger does not fold flat — every
// knuckle turning by the same angle coils it into a spiral and drives the tips
// through each other. A hand rolls shut from the FINGERTIP inward, so each segment
// answers only its own SLICE of the sweep (`at`, as a fraction of it) and turns by
// its own `swing` across that slice. Half a slider is a cupped hand, a full one a
// fist. The swings sum to about a half turn — as far as a finger can go before its
// tip drives back through the palm. Below zero there is nothing to roll: the whole
// finger straightens together.
const CURL_MAX = 40;
const CURL_ROLL = [
  { at: [0.55, 1.0], swing: 45 },           // base knuckle: folds last
  { at: [0.3, 0.75], swing: 65 },           // middle
  { at: [0.0, 0.45], swing: 70 },           // tip: leads the roll
];
const CURL_SEG = ["curlBase", "curlMid", "curlTip"];   // what the digits bind, not `curl`
const curlSeg = (i, curl) => {
  if (curl <= 0) return curl;
  const [a, b] = CURL_ROLL[i].at;
  return CURL_ROLL[i].swing * clamp((curl / CURL_MAX - a) / (b - a), 0, 1);
};

const SIDED = new Set([...SIDE_CHANNELS, ...CURL_SEG]);
// a channel's name on flank S — spine channels have no flank and keep their own
const chan = (key, S) => (SIDED.has(key) ? key + S : key);
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
const ATLAS_POSE = {
  headYaw: 0, headPitch: 0, twist: 0, waistBend: 0, waistTilt: 0,
  shoulder: 0, armOut: 30, armTwist: 0, elbow: 60, foreTwist: 0,
  wristBend: 0, wristTilt: 30, wristTwist: 0, curl: 30,
  hip: 0, knee: 0, ankle: 0, hipLevel: 0,
};
export const atlasPose = () => forSides(ATLAS_POSE);

// ---- THE LEG ----------------------------------------------------------------
// The leg is a two-link chain in the fore/aft plane and the three leg sliders ARE
// its angles: `hip` swings the thigh off the vertical (+ = forward), `knee` turns
// the shin off the thigh (- = folding back), `ankle` turns the foot off the shin.
// So the ankle sits Lt·sin(hip) + Ls·sin(hip+knee) forward of the hip and
// Lt·cos(hip) + Ls·cos(hip+knee) below it, and a sole lies flat on the floor when
// hip + knee + ankle = 0. Measured off the built rig, so a longer shin just moves
// the numbers.
const LEG = { Lt: 0, Ls: 0, hipY: 0, ankleY: 0, perLevel: 0, maxDrop: 0 };
const measureLeg = (rig) => {
  rig.setPose({});
  const W = rig.skeleton.resolve();
  const at = (link) => W[rig.dof(link)[0]].t;
  const span = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const [hip, knee, ankle] = [at("legL"), at("shinL"), at("footL")];
  const Lt = span(hip, knee), Ls = span(knee, ankle);
  LEG.Lt = Lt;
  LEG.Ls = Ls;
  LEG.hipY = hip[1];
  LEG.ankleY = ankle[1];                     // where a planted foot's ankle rides
  // hipLevel is a RATE, not a distance: each -1 sinks the hip by what folding a
  // knee 60° costs it in height, so -2 sinks twice as far and the legs fold on to
  // hold it. It stops where the leg runs out of fold.
  const k = -60 * D;
  LEG.perLevel = Lt + Ls - Math.sqrt(Lt * Lt + Ls * Ls + 2 * Lt * Ls * Math.cos(k));
  LEG.maxDrop = Lt + Ls - Math.abs(Lt - Ls) - 0.02;
};
const hipDrop = (level) => clamp(-Math.min(level, 0) * LEG.perLevel, 0, LEG.maxDrop);

// THE LEG SOLVER. The leg sliders are an INTENT — where the dancer wants the foot
// — not the final angles, because the hip may be sunk so low that a straight leg
// would stand the foot underground, or a swing may reach further than a leg is
// long. So the intent is read FORWARD into a foot position, corrected THERE (on
// the floor, within reach), and solved BACK into angles. A leg is then only ever
// posed by angles a real leg of this length could hold.
//
// The CROUCH needs no author: it is what a leg at rest SOLVES to. Every slider
// zero asks for a foot straight down, which is under the floor as soon as the hip
// sinks — so the correction lifts it back onto the floor and the solve folds the
// knee forward and leans the shin back to meet it.
const solveLeg = (hip, knee, ankle, level) => {
  const { Lt, Ls, hipY, ankleY } = LEG;
  const z = Lt * Math.sin(hip * D) + Ls * Math.sin((hip + knee) * D);
  const y = Lt * Math.cos(hip * D) + Ls * Math.cos((hip + knee) * D);
  const floor = hipY - hipDrop(level) - ankleY;
  const planted = y >= floor - 1e-9;          // it reached the floor, so it stands on it
  const down = Math.min(y, floor);
  // A target further off than the leg is long straightens it: the fold clamps to
  // nothing and the leg reaches along the same line, so the foot falls SHORT of the
  // target rather than off it — and short of a target on the floor is above it.
  const r = Math.hypot(z, down);
  const k = -deg(Math.acos(clamp((r * r - Lt * Lt - Ls * Ls) / (2 * Lt * Ls), -1, 1)));
  const h = deg(Math.atan2(z, down)) - deg(Math.atan2(Ls * Math.sin(k * D), Lt + Ls * Math.cos(k * D)));
  return { hip: h, knee: k, ankle: planted ? -(h + k) : ankle };
};

// ---- ROUTINES ---------------------------------------------------------------
// A setup pose the rig strikes, then a KEYFRAME timeline: each key is a partial
// pose and the `hold` (in beats) it takes to reach it. A routine is an ARM routine,
// so REST stands the legs squarely and the solver folds them into whatever stance
// the hip level asks for.
const REST = {
  armOut: 0, shoulder: 0, armTwist: 0, elbow: 0, foreTwist: 0, wristBend: 0, wristTilt: 0,
  wristTwist: 0, curl: 0, twist: 0, waistBend: 0, waistTilt: 0,
  headPitch: 0, headYaw: 0, hip: 0, knee: 0, ankle: 0,
};

// The ripple down an arm. A joint raising by n swings everything below it up too,
// so the two joints under it fold back: the next by 2n, the one after by n again.
// That +n / -2n / +n chain leaves the hand where it was and reads as a CREST at the
// raised joint. The crest then travels: each key drops the joint that held it back
// to rest and hands it to the one below, which brings its own compensators with it.
// `lead` = the shoulder channel the setup holds at `level`; `n` = its raise.
// The finger curl runs the OTHER WAY ROUND from the bend channels (a positive curl
// closes the hand), so every compensation landing on the fingers has its sign flipped.
const WAVE = (lead, level, n) => [
  { hold: 0.15, pose: { [lead]: level + n, elbow: -2 * n, wristBend: n } },
  { hold: 0.12, pose: { [lead]: level, elbow: n, wristBend: -2 * n } },
  { hold: 0.12, pose: { elbow: 0, wristBend: n } },
  { hold: 0.12, pose: { wristBend: 0, curl: -n } },
  { hold: 0.15, pose: { curl: 0 } },
];

// The same ripple run BACKWARDS — and NOT the key list reversed. The bone chain
// only runs one way: a joint carries everything BELOW it and nothing above, so a
// finger can never counter its own wrist. The counters therefore always land on the
// joints UNDER the one swinging, whichever way the crest travels. So the crest
// starts at the fingers (a leaf, nothing under them) and climbs.
const VERT_WAVE = (lead, level, n) => [
  { hold: 0.12, pose: { curl: n } },
  { hold: 0.12, pose: { wristBend: n, curl: -2 * n } },
  { hold: 0.12, pose: { elbow: n, wristBend: -2 * n, curl: n } },
  { hold: 0.12, pose: { [lead]: level - n, elbow: -2 * n, wristBend: n, curl: 0 } },
  { hold: 0.12, pose: { [lead]: level, elbow: 0, wristBend: 0, curl: 0 } },
];

// ONE ARM'S wave, whole: the `raise` it strikes on top of REST and the keys the
// crest travels through. A style knows nothing about the other arm — pairing two of
// them is what makes a routine, so forward and back are two constants, not one with
// a sign flag.
const STYLE = {
  sideOut: { raise: { armOut: 90, armTwist: -90 }, keys: WAVE("armOut", 90, 35), loops: 2 },
  front: { raise: { shoulder: 90 }, keys: WAVE("shoulder", 90, 35), loops: 2 },
  back: { raise: { shoulder: -90 }, keys: WAVE("shoulder", -90, -35), loops: 2 },
  overhead: { raise: { armOut: 180, armTwist: 0 }, keys: VERT_WAVE("shoulder", 0, 20), loops: 2 },
  hang: { raise: { armOut: 0, armTwist: 0 }, keys: VERT_WAVE("shoulder", 0, -20), loops: 2 },
};

// A ROUTINE pairs a style per flank. Where the columns differ the arms park in
// OPPOSITE setups and wave against each other — dropped while mirroring, which
// would copy the left arm over the right and flatten them into one move. Paired
// styles must share a key count and holds.
const ROUTINES = {
  armWave: { L: STYLE.sideOut, R: STYLE.sideOut },
  frontWave: { L: STYLE.front, R: STYLE.front },
  frontWaveOpposed: { L: STYLE.front, R: STYLE.back },
  verticalWave: { L: STYLE.overhead, R: STYLE.overhead },
  verticalWaveOpposed: { L: STYLE.overhead, R: STYLE.hang },
};

const onSide = (pose, S) =>
  Object.fromEntries(Object.entries(pose).map(([k, v]) => [chan(k, S), v]));

// the two styles laid side by side: setups merged, and key `i` of the left merged
// with key `i` of the right, so the arms ripple in lockstep
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

// ---- THE LINKS --------------------------------------------------------------
// One arm + one leg, on their OWN channels. `sgn` flips the ones that must READ the
// same on both flanks: the right limb hangs off a REVERSED PIN (see assemble's note
// on mirroring), so its local senses flip, and a raise stays a raise when the left
// channel's value is copied onto the right.
//
// That reversed pin also rides the whole right chain a half-turn about the limb
// axis. A barrel like the shin cannot tell, but a part with a FRONT can: the palm's
// finger layout and the foot's toe would face backwards on that side. `flip` bolts
// those two back the other way round.
const side = (S, sgn) => {
  const c = (key, s) => [chan(key, S), s];
  return [
  // shoulder: the female DISC spins the arm fore/aft, the PIN swings it out, and
  // the male disc is the turntable the upper arm rolls on (armTwist)
  { name: `arm${S}`, part: "upperArm", parent: "torso", at: `shoulder${S}`,
    angles: [c("shoulder", -sgn), c("armOut", -1), c("armTwist", sgn)] },
  // the tang's flange is a DISC: it seats on the forearm box's top face and carries
  // it up to the pin, so the box stays clear of the jaw — and that same disc is the
  // turntable the forearm rolls on (foreTwist)
  { name: `fore${S}`, part: "forearm", parent: `arm${S}`, at: "elbow",
    angles: [c("elbow", -sgn), c("foreTwist", sgn)] },
  // the palm bolts straight to the wrist's tang disc — the twist IS that disc. The
  // flip turns the palm, not the joint, so the wrist's own axes are untouched.
  { name: `palm${S}`, part: "palm", parent: `fore${S}`, at: "wrist", flip: sgn < 0,
    angles: [c("wristBend", -sgn), c("wristTilt", 1), c("wristTwist", sgn)] },
  // three fingers, three digits each, every knuckle on its own slice of the curl
  ...[0, 1, 2].flatMap((f) => [0, 1, 2].map((i) => ({
    name: `dig${S}${f}${i}`,
    part: "digit",
    params: { w: 0.1 * (1 - i * 0.12), len: 0.12 },
    parent: i === 0 ? `palm${S}` : `dig${S}${f}${i - 1}`,
    at: i === 0 ? `f${f}` : "tip",
    angles: [c(CURL_SEG[i], 1)],
  }))),
  // hip: the DISC swings the leg fore/aft (the pin would kick it out sideways)
  { name: `leg${S}`, part: "thigh", parent: "pelvis", at: `hip${S}`,
    angles: [c("hip", -sgn), null, null] },
  { name: `shin${S}`, part: "shin", parent: `leg${S}`, at: "knee",
    angles: [c("knee", -sgn)] },
  // the ankle pitches the foot: toe down to push off, toe up to land on the heel
  { name: `foot${S}`, part: "foot", parent: `shin${S}`, at: "ankle", flip: sgn < 0,
    angles: [c("ankle", -sgn)] },
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

// bone depth of every pose channel (pelvis = 0). A channel drives the link it sits
// on, so its depth IS that link's depth: `twist` turns the torso near the root,
// `curl` turns a finger out at a leaf. The choreographer reads this to tell a big
// root move from a small leaf one.
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
  // the digits ride the segment channels, so the `curl` SLIDER binds nothing of its
  // own — it is as deep as the knuckles it rolls
  for (const S of SIDES)
    out[chan("curl", S)] = Math.min(...CURL_SEG.map((key) => out[key + S]));
  return out;
})();

export function createAtlasRig(seed = 1) {
  const rig = createAssembly({ kit: ATLAS_KIT, links: ATLAS_DEF, seed });
  measureLeg(rig);                        // the solver poses off these
  const restPose = atlasPose();

  // `opts` goes straight to the assembly's emit, so a build animation can displace
  // groups through it
  function model(pose = {}, opts = {}) {
    const o = { ...restPose, ...pose };
    const level = o.hipLevel ?? 0;
    for (const S of SIDES) {
      // the curl slider rolls out into the segment channels the digits ride
      for (let i = 0; i < CURL_SEG.length; i++)
        o[CURL_SEG[i] + S] = curlSeg(i, o[chan("curl", S)]);
      // and both legs are re-solved against the floor the hip level leaves them:
      // the planted one folds into the crouch, the dancing one stays out of the ground
      const leg = solveLeg(o[chan("hip", S)], o[chan("knee", S)], o[chan("ankle", S)], level);
      for (const key of ["hip", "knee", "ankle"]) o[chan(key, S)] = leg[key];
    }
    rootBone.offset[1] = rootY - hipDrop(level);
    rig.setPose(Object.fromEntries(Object.keys(o).map((k) => [k, rad(o[k])])));
    return rig.emit(opts);
  }

  // stand the figure on the grid: build the rest pose off an unlifted root and push
  // the root up by the lowest vertex it puts underground (the soles). The span the
  // same sweep measures is the standing height, which frames the view.
  const rootBone = rig.bones[rig.link("pelvis").ids[0]];
  let rootY = rootBone.offset[1];
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
  rootY -= minY;                          // the standing root, which the hip level sinks from
  rootBone.offset[1] = rootY;

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
