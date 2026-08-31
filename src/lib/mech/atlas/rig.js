// ATLAS RIG — DATA. A standing humanoid on the same engines as the dragon: the links
// name parts and the parent slots they bolt to, assemble instantiates the joints and
// spends the bones, and the pose SLIDERS are the whole public surface — a
// choreographer drives those and never touches a bone.
//
// `angles` binds the sliders to a link's joint, one entry per DOF, in the joint's own
// order (a null entry leaves that DOF at zero):
//   disc hinge (shoulder / hip)  [disc spin, pin swing, disc spin]
//   hinge (elbow / knee / ankle) [pin swing]
//   wrist                        [bend, tilt, twist]
//   ball (waist / neck)          one free bone, its three euler channels
import { ATLAS_KIT } from "./parts.js";
import { createRig, rigCache, boundsY } from "../rig.js";
import { clamp } from "../../math/scalar.js";

// angles are RADIANS end to end here; degrees live only in the UI pages.
const DEG = Math.PI / 180;   // radian value of one degree, for writing constants

// The channels that live on a limb, and so exist once per flank: the rig is ALWAYS
// split, `shoulderL` and `shoulderR` are two channels on two bones, and nothing
// here ties them together. Mirroring is a rule the CALLER keeps, not a wiring.
export const SIDE_CHANNELS = [
  "shoulder", "armOut", "armTwist", "elbow", "foreTwist",
  "wristBend", "wristTilt", "wristTwist", "curl", "hip", "knee", "ankle",
];
export const SIDES = ["L", "R"];

const CURL = [
  { in: [0, 0.5], out: [0, -Math.PI / 6] },  // knuckle: leads, and is spent by the halfway mark
  { in: [0.2, 0.8], out: [0, Math.PI / 4] }, // middle:  takes over where the knuckle stops
  { in: [0.5, 1], out: [0, Math.PI / 4] },   // tip:     finishes the fist
];
const CURL_SEG = ["curlBase", "curlMid", "curlTip"];   // what the digits bind, not `curl`
const curlSeg = (i, curl) => {
  const [a, b] = CURL[i].in, [lo, hi] = CURL[i].out;
  return lo + (hi - lo) * clamp((curl - a) / (b - a), 0, 1);
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

const ATLAS_POSE = {
  headYaw: 0, headPitch: 0, twist: 0, waistBend: 0, waistTilt: 0,
  shoulder: 0, armOut: Math.PI / 6, armTwist: 0, elbow: Math.PI / 3, foreTwist: 0,
  wristBend: 0, wristTilt: Math.PI / 6, wristTwist: 0, curl: 0.35,
  hip: 0, knee: 0, ankle: 0, hipLevel: 0,
};
export const atlasPose = () => forSides(ATLAS_POSE);

// ---- THE LEG ----------------------------------------------------------------
// A two-link chain in the fore/aft plane, and the three leg sliders ARE its angles:
// `hip` swings the thigh off the vertical (+ = forward), `knee` turns the shin off
// the thigh (- = folding back), `ankle` turns the foot off the shin. So the ankle
// sits Lt·sin(hip) + Ls·sin(hip+knee) forward of the hip and Lt·cos(hip) +
// Ls·cos(hip+knee) below it, and a sole lies flat when hip + knee + ankle = 0.
// Measured off the BUILT rig, so a longer shin just moves the numbers.
const measureLeg = (rig) => {
  rig.setPose({});
  const W = rig.skeleton.resolve();
  const at = (link) => W[rig.dof(link)[0]].t;
  const span = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const [hip, knee, ankle] = [at("legL"), at("shinL"), at("footL")];
  const Lt = span(hip, knee), Ls = span(knee, ankle);
  // hipLevel is a RATE, not a distance: each -1 sinks the hip by what folding a knee
  // 60° costs it in height, so -2 sinks twice as far and the legs fold on to hold
  // it. It stops where the leg runs out of fold.
  const k = -Math.PI / 3;
  return {
    Lt, Ls,
    hipY: hip[1],
    ankleY: ankle[1],                        // where a planted foot's ankle rides
    perLevel: Lt + Ls - Math.sqrt(Lt * Lt + Ls * Ls + 2 * Lt * Ls * Math.cos(k)),
    maxDrop: Lt + Ls - Math.abs(Lt - Ls) - 0.02,
  };
};
const hipDrop = (L, level) => clamp(-Math.min(level, 0) * L.perLevel, 0, L.maxDrop);

// THE LEG SOLVER. The leg sliders are an INTENT — where the dancer wants the foot —
// not the final angles: the hip may be sunk so low that a straight leg would stand
// the foot underground, or a swing may reach further than a leg is long. So the
// intent is read FORWARD into a foot position, corrected THERE (onto the floor,
// within reach), and solved BACK into angles — a leg is only ever posed by angles a
// real leg of this length could hold.
//
// The CROUCH needs no author: it is what a leg at rest SOLVES to. Every slider zero
// asks for a foot straight down, which is under the floor as soon as the hip sinks,
// so the correction lifts it back up and the solve folds the knee forward and leans
// the shin back to meet it.
const solveLeg = (L, hip, knee, ankle, level) => {
  const { Lt, Ls, hipY, ankleY } = L;
  const z = Lt * Math.sin(hip) + Ls * Math.sin(hip + knee);
  const y = Lt * Math.cos(hip) + Ls * Math.cos(hip + knee);
  const floor = hipY - hipDrop(L, level) - ankleY;
  const planted = y >= floor - 1e-9;          // it reached the floor, so it stands on it
  const down = Math.min(y, floor);
  // A target further off than the leg is long straightens it: the fold clamps to
  // nothing and the leg reaches along the same line, so the foot falls SHORT of the
  // target rather than off it — and short of a target on the floor is above it.
  const r = Math.hypot(z, down);
  const k = -Math.acos(clamp((r * r - Lt * Lt - Ls * Ls) / (2 * Lt * Ls), -1, 1));
  const h = Math.atan2(z, down) - Math.atan2(Ls * Math.sin(k), Lt + Ls * Math.cos(k));
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

const fist = (n) => Math.abs(n) / (Math.PI / 2);
const WAVE = (lead, level, n) => [
  { hold: 0.15, pose: { [lead]: level + n, elbow: -2 * n, wristBend: n } },
  { hold: 0.12, pose: { [lead]: level, elbow: n, wristBend: -2 * n } },
  { hold: 0.12, pose: { elbow: 0, wristBend: n } },
  { hold: 0.12, pose: { wristBend: 0, curl: fist(n) } },
  { hold: 0.15, pose: { curl: 0 } },
];

const VERT_WAVE = (lead, level, n) => [
  { hold: 0.12, pose: { curl: fist(n) } },
  { hold: 0.12, pose: { wristBend: n, curl: 0 } },
  { hold: 0.12, pose: { elbow: n, wristBend: -2 * n, curl: fist(n) } },
  { hold: 0.12, pose: { [lead]: level - n, elbow: -2 * n, wristBend: n, curl: 0 } },
  { hold: 0.12, pose: { [lead]: level, elbow: 0, wristBend: 0, curl: 0 } },
];

const P2 = Math.PI / 2;   // 90°
const STYLE = {
  sideOut: { raise: { armOut: P2, armTwist: -P2 }, keys: WAVE("armOut", P2, 35 * DEG), loops: 2 },
  front: { raise: { shoulder: P2 }, keys: WAVE("shoulder", P2, 35 * DEG), loops: 2 },
  back: { raise: { shoulder: -P2 }, keys: WAVE("shoulder", -P2, -35 * DEG), loops: 2 },
  overhead: { raise: { armOut: Math.PI, armTwist: 0 }, keys: VERT_WAVE("shoulder", 0, 20 * DEG), loops: 2 },
};

const ROUTINES = {
  armWave: { L: STYLE.sideOut, R: STYLE.sideOut },
  frontWave: { L: STYLE.front, R: STYLE.front },
  frontWaveOpposed: { L: STYLE.front, R: STYLE.back },
  verticalWave: { L: STYLE.overhead, R: STYLE.overhead },
};

const onSide = (pose, S) =>
  Object.fromEntries(Object.entries(pose).map(([k, v]) => [chan(k, S), v]));

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

const MONTAGE_LABELS = { armWave: "arm wave", frontWave: "front wave", verticalWave: "vertical wave" };
export const montageLabel = (name) => {
  const base = name.replace(/Opposed$/, "");
  return (MONTAGE_LABELS[base] ?? base) + (base === name ? "" : " opposed");
};

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

// ---- THE SLIDER SURFACE ------------------------------------------------------
// Every pose channel, its range, and the MIRROR rule laid over them. The rig is always
// split (see SIDE_CHANNELS), so mirroring is these functions tying the two flanks
// together — a caller's rule, never a wiring.
// [key, label, min, max, step?], on BARE channel names
export const ATLAS_CTL = [
  ["headYaw", "head yaw", -Math.PI, Math.PI, DEG],
  ["headPitch", "head pitch", -30 * DEG, 30 * DEG, DEG],
  ["twist", "waist twist", -Math.PI, Math.PI, DEG],
  ["waistBend", "waist bend", -45 * DEG, 45 * DEG, DEG],
  ["waistTilt", "waist tilt", -45 * DEG, 45 * DEG, DEG],
  ["shoulder", "arm swing", -Math.PI, Math.PI, DEG],
  ["armOut", "arm raise", -10 * DEG, Math.PI, DEG],
  ["armTwist", "arm twist", -Math.PI, Math.PI, DEG],
  ["elbow", "elbow bend", -Math.PI / 2, Math.PI / 2, DEG],
  ["foreTwist", "forearm twist", -Math.PI, Math.PI, DEG],
  ["wristBend", "wrist bend", -100 * DEG, 100 * DEG, DEG],
  ["wristTilt", "wrist tilt", -100 * DEG, 100 * DEG, DEG],
  ["wristTwist", "wrist twist", -Math.PI, Math.PI, DEG],
  ["curl", "finger curl", 0, 1, 0.01],   // a 0..1 fist, not an angle
  ["hip", "leg swing", -45 * DEG, 45 * DEG, DEG],
  ["knee", "knee bend", -Math.PI / 3, 0, DEG],
  ["ankle", "ankle bend", -30 * DEG, 30 * DEG, DEG],
];
export const LEVEL_CTL = [["hipLevel", "hip level", -1.5, 0, 0.01]];

// bare rows -> flanked ones; mirrored, the left channel stands for both
export const sided = (ctl, mirror) =>
  ctl.flatMap(([key, label, ...rest]) =>
    !SIDED.has(key) ? [[key, label, ...rest]]
      : mirror ? [[key + "L", label, ...rest]]
        : SIDES.map((S) => [key + S, `${label} ${S}`, ...rest]),
  );
export const coreCtl = [...LEVEL_CTL, ...ATLAS_CTL].filter(([key]) => !SIDED.has(key));
export const flankCtl = (S) =>
  ATLAS_CTL.filter(([key]) => SIDED.has(key))
    .map(([key, label, ...rest]) => [key + S, label, ...rest]);
// mirrored, the right flank is not the user's to edit — it follows the left
export const rigLocked = (mirror) =>
  new Set(mirror ? SIDE_CHANNELS.map((key) => key + "R") : []);
// a pose whose left-flank writes land on the right flank too
export const mirrorWrites = (pose) => new Proxy(pose, {
  set(t, key, v) {
    t[key] = v;
    if (typeof key === "string" && key.endsWith("L") && SIDED.has(baseChan(key)))
      t[baseChan(key) + "R"] = v;
    return true;
  },
});
export const twinOf = (key) =>
  (key.endsWith("L") && SIDED.has(baseChan(key)) ? baseChan(key) + "R" : null);

// ---- WHAT A CHOREOGRAPHER MAY DRIVE -----------------------------------------
const BIG_DEPTH = 2;                 // this near the root, a channel carries a beat
const LEG_CHANNELS = ["hip", "knee", "ankle"];
const CHOREO_PULSE = ["hipLevel"];   // whole-body: its own slot in the beat
const CHOREO_SPIN = "twist";
const CHOREO_EXCLUSIVE = [["twist", "waistBend", "waistTilt"]];   // one waist ball
const CHOREO_GROUNDED = [SIDES.map((S) => LEG_CHANNELS.map((key) => key + S))];
// ratio channels (a rate, a 0..1 fist) have no angle grid to snap to
const RATIO = new Set(["curl", "hipLevel"]);
// mirrored, the legs move as ONE and the figure would hop: take them out of the beat
// and park them (a leg left in the air by the flip still has to walk home)
const choreoSliders = (mirror) => {
  const skip = new Set(mirror ? LEG_CHANNELS : []);
  return sided([...LEVEL_CTL, ...ATLAS_CTL].filter(([key]) => !skip.has(key)), mirror)
    .map(([key, , min, max]) => ({
      key, min, max,
      big: key === "hipLevel" || ATLAS_POSE_DEPTH[key] <= BIG_DEPTH,
      grid: RATIO.has(baseChan(key)) ? 0 : undefined,
    }));
};
// the whole rig, as createChoreographer wants it, under the mirror rule
export const atlasChoreo = (mirror) => ({
  sliders: choreoSliders(mirror),
  home: atlasPose(),
  montages: atlasMontages(mirror),
  exclusives: CHOREO_EXCLUSIVE,
  grounded: CHOREO_GROUNDED,
  parked: mirror ? LEG_CHANNELS.flatMap((key) => SIDES.map((S) => key + S)) : [],
  pulse: CHOREO_PULSE,
  spin: CHOREO_SPIN,
  twin: mirror ? twinOf : null,
});

export function createAtlasRig(seed = 1) {
  const restPose = atlasPose();
  let LEG, rootBone, rootY;

  const { model, rig } = createRig({
    kit: ATLAS_KIT,
    links: ATLAS_DEF,
    rest: restPose,
    seed,
    setup(r) {
      LEG = measureLeg(r);                 // the solver poses off these
      rootBone = r.bones[r.link("pelvis").ids[0]];
      rootY = rootBone.offset[1];
      return {};
    },
    solve(o) {
      const level = o.hipLevel ?? 0;
      for (const S of SIDES) {
        // the curl slider rolls out into the segment channels the digits ride
        for (let i = 0; i < CURL_SEG.length; i++)
          o[CURL_SEG[i] + S] = curlSeg(i, o[chan("curl", S)]);
        // and both legs are re-solved against the floor the hip level leaves them:
        // the planted one folds into the crouch, the dancing one stays out of the ground
        const leg = solveLeg(LEG, o[chan("hip", S)], o[chan("knee", S)], o[chan("ankle", S)], level);
        for (const key of ["hip", "knee", "ankle"]) o[chan(key, S)] = leg[key];
      }
      rootBone.offset[1] = rootY - hipDrop(LEG, level);
    },
  });

  // stand the figure on the grid: build the rest pose off an unlifted root and push
  // the root up by the lowest vertex it puts underground (the soles). The span the
  // same sweep measures is the standing height, which frames the view.
  const { items, meshes } = model();
  const b = boundsY(items, meshes);
  rootY -= b.minY;                          // the standing root, which the hip level sinks from
  rootBone.offset[1] = rootY;

  return { model, height: b.height, rig };
}

// one live rig, rebuilt when the color seed changes
const rigFor = rigCache(createAtlasRig);
// head-to-sole span of the standing figure — the page aims the camera at its middle
export const atlasHeight = (seed = 1) => rigFor(seed).height;
export function atlasModel(seed = 1, pose = {}, opts = {}) {
  return rigFor(seed).model(pose, opts);
}
