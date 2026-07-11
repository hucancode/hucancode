// DRAGON RIG — DATA, plus the one thing that is really the dragon's own: the
// spine solve. Everything mechanical belongs to the engines: parts.js models
// bodies, joints.js models joints, skeleton.js spins bones, assemble.js bolts
// the three together. This file only says WHICH parts hang off which, and
// drives the bones the assembly handed it.
//
// The body chain rides a CLOSED CATMULL-ROM LOOP: the spine's ball joints are
// chord-marched along the curve at the exact pitches the assembly reports (so
// every stud lands in its socket), and `offset` slides the dragon along it.
//
// The rig's public surface is a handful of SLIDERS (DRAGON_POSE) — that is all
// a choreographer or a page ever touches. They reach the bones through the
// assembly; the skeleton underneath is not something a caller has to know.
import { DRAGON_KIT, DRAGON_JOINTS } from "./parts.js";
import { createAssembly } from "../assemble.js";
import { buildSpline } from "../../math/curve.js";
import { rad } from "../../math/scalar.js";
import { vSub, vLen, vNorm, vCross, m3Mul, m3T } from "../../math/mat3.js";

// runtime rig controls (degrees, except offset = 0..1 along the loop)
export const DRAGON_POSE = {
  offset: 0, jaw: 12, armSwing: 30, elbow: 45, legSwing: -25, knee: 35,
};

const SEG_P = { bodyR: 0.5, segLen: 1.35, discs: 3, finR: 0.38 };
const SEG7_P = { rFront: 0.5, rRear: 0.42, segLen: 1.15, finR: 0.34 };  // first taper stage
const TAPER_P = { rFront: 0.42, rRear: 0.34, segLen: 1.15, finR: 0.3 }; // tapers into the tail
const TAIL_P = { coreLen: 1.3, bodyR: 0.34, tipLen: 1.4 };              // bodyR matches the taper's rRear

// THE RIG DEFINITION — every link: a part, the parent slot it bolts to, and
// (for a limb) the pose channels its joint's DOFs listen to. `spine` links get
// their bone rotations solved from the ride curve instead. The limb joints are
// declared on the LINK, not the segment's slot: a flank pad only grows a
// shoulder where a limb actually hangs.
const segment = (name, parent, params = SEG_P, part = "bodySegment") =>
  ({ name, part, params, parent, at: "rear", spine: true });

// one limb: an upper piece on a flank's disc hinge, a lower piece on its hinge.
// `sign` flips the channels on the right flank, `phase` offsets the swim stroke.
const limb = (S, seg, kind, sign, phase) => {
  const up = kind === "arm" ? "upperArm" : "thigh";
  const lo = kind === "arm" ? "forearm" : "shin";
  const joint = kind === "arm" ? DRAGON_JOINTS.shoulder : DRAGON_JOINTS.hip;
  return [
    { name: `${kind}${S}`, part: up, parent: seg, at: `flank${S}`, joint, limb: kind, sign, phase },
    { name: `${lo}${S}`, part: lo, parent: `${kind}${S}`, at: kind === "arm" ? "elbow" : "knee",
      limb: lo, sign, phase },
  ];
};

const DRAGON_DEF = [
  { name: "head", part: "head", pivot: "neck" },                  // root
  { name: "jaw", part: "jaw", parent: "head", at: "jaw", angles: [["jaw", 1]] },
  { name: "seg1", part: "bodySegment", params: SEG_P, parent: "head", at: "neck", spine: true },
  segment("seg2", "seg1"), segment("seg3", "seg2"), segment("seg4", "seg3"),
  segment("seg5", "seg4"), segment("seg6", "seg5"),
  segment("seg7", "seg6", SEG7_P, "bodySegment2"),
  segment("taper1", "seg7", TAPER_P, "bodySegment2"),
  segment("taper2", "taper1", TAPER_P, "bodySegment2"),
  segment("taper3", "taper2", TAPER_P, "bodySegment2"),
  segment("tail", "taper3", TAIL_P, "tail"),
  // limbs: the shoulder / hip disc hinge spends 3 bones (disc spin, pin swing,
  // disc spin) — the stroke rides the first, the other two rest at zero. The
  // right flank seats the SAME joint with its pin reversed (a joint can only be
  // seated by a rotation, never a reflection — see the flank slots), so that
  // side's channels take the opposite `sign` and the pair strokes together.
  ...limb("L", "seg2", "arm", 1, 0), ...limb("R", "seg2", "arm", -1, 0.5),
  ...limb("L", "seg5", "leg", 1, 0.5), ...limb("R", "seg5", "leg", -1, 0),
];

// which slider each limb link's driven bone reads, and where in its joint's DOF
// list that bone sits: an upper limb turns the shoulder/hip DISC (DOF 0), a
// lower limb swings the elbow/knee PIN (its only DOF)
const LIMB = {
  arm: { dof: 0, key: "armSwing", amp: "swing", lag: 0, mirror: true },
  forearm: { dof: 0, key: "elbow", amp: "bend", lag: -Math.PI / 2 },
  leg: { dof: 0, key: "legSwing", amp: "swing", lag: 0, mirror: true },
  shin: { dof: 0, key: "knee", amp: "bend", lag: -Math.PI / 2 },
};

// SWIM STROKE — a second animation layered on the base limb pose, its timeline
// driven by the SAME loop offset: `strokes` paddle cycles per lap, swing/bend =
// oscillation amplitudes (degrees) around the sliders, and bend LAGS swing by a
// quarter cycle so each limb whips like a paddle. Left/right run at OPPOSITE
// phases, and so do front/rear — diagonal pairs stroke together, a trot-like
// paddling gait.
const SWIM = { strokes: 4, swing: 22, bend: 20 };

// closed flight loop the spine rides (roughly a ring, strongly undulating in Y
// — alternating crests and troughs so the dragon visibly swims up and down)
const LOOP_PTS = [
  [7.8, 5.5, 0], [5.5, 2.7, 5.5], [0, 5.2, 7.7], [-5.5, 2.5, 5.5],
  [-7.8, 5.6, 0], [-5.5, 2.6, -5.5], [0, 5.0, -7.7], [5.5, 2.8, -5.5],
];

// buildSpline (math/curve.js) speaks {x,y,z}; the rig speaks [x,y,z] arrays —
// adapt, keeping the { total, posAt, tangentAt } contract (marchBack bisects
// through posAt). curve.tan already returns a unit vector.
function makeLoop(pts) {
  const c = buildSpline(pts.map(([x, y, z]) => ({ x, y, z })));
  return {
    total: c.total,
    posAt: (s) => { const p = c.pos(s); return [p.x, p.y, p.z]; },
    tangentAt: (s) => { const t = c.tan(s); return [t.x, t.y, t.z]; },
  };
}

let _defaultLoop = null;
const defaultLoop = () => (_defaultLoop ??= makeLoop(LOOP_PTS));

// walk BACKWARD along the loop from s until the CHORD to the anchor equals
// dist — chord, not arc, so a rigid part spans its two pivots exactly. Since
// the loop is arc-length parameterised, chord(k) <= k, so the crossing sits at
// k >= dist: bracket from there instead of scanning from zero.
function marchBack(loop, s, dist) {
  if (dist <= 1e-9) return s;
  const anchor = loop.posAt(s);
  const chord = (k) => vLen(vSub(loop.posAt(s - k), anchor));
  let lo = dist;
  if (chord(lo) >= dist - 1e-9) return s - lo;     // straight run: chord == arc
  const cap = loop.total * 0.5;
  let hi = lo, step = Math.max(dist * 0.25, loop.total / 1500);
  while (hi < cap) {
    hi = Math.min(cap, hi + step);
    if (chord(hi) >= dist) break;
    step *= 2;
  }
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (chord(m) < dist) lo = m; else hi = m;
  }
  return s - (lo + hi) / 2;
}

// orthonormal frame with local +Z aligned to z, +Y as up as possible
// (columns X, Y, Z)
function frameFromZ(z) {
  const Z = vNorm(z);
  let X = vCross([0, 1, 0], Z);
  if (vLen(X) < 1e-4) X = vCross([1, 0, 0], Z);   // tangent went vertical
  X = vNorm(X);
  const Y = vCross(Z, X);
  return [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]];
}

export function createDragonRig(seed = 1) {
  const rig = createAssembly({ kit: DRAGON_KIT, links: DRAGON_DEF, seed });
  const bones = rig.bones;

  // the spine chain, and the PITCH of each link — the chord from its parent's
  // ball centre to its own. The assembly already worked that out when it seated
  // the joints: it IS the offset of the link's first bone.
  const spine = rig.links.filter((d) => d.spine);
  for (const d of spine) d.pitch = vLen(bones[d.ids[0]].offset);
  const pitch = spine.reduce((a, d) => a + d.pitch, 0);
  const tailChord = TAIL_P.coreLen;                 // orients the last link
  const rootBone = bones[rig.link("head").ids[0]];

  // `path` (optional) = an external ride curve { total, posAt(s), tangentAt(s) }
  // in RIG SPACE (y-up); defaults to the built-in flight loop. pose.swim (0..1,
  // optional) phases the paddle stroke separately from `offset` — needed when
  // the path is not a closed lap. `opts` goes straight to the assembly's emit,
  // so a build animation can displace groups through it.
  function model(pose = {}, path = null, opts = {}) {
    const o = { ...DRAGON_POSE, ...pose };
    const loop = path ?? defaultLoop();

    // spine pivots, chord-marched backward from the head anchor
    const sList = [(((o.offset % 1) + 1) % 1) * loop.total];
    for (const d of spine) sList.push(marchBack(loop, sList.at(-1), d.pitch));
    const piv = sList.map((s) => loop.posAt(s));
    const qTail = loop.posAt(marchBack(loop, sList.at(-1), tailChord));

    // world frame per chain link: +Z = the forward chord from its own pivot to
    // the NEXT pivot down the chain (piv[i] -> piv[i+1] runs tailward)
    const frames = [frameFromZ(loop.tangentAt(sList[0]))];              // head
    for (let i = 1; i < piv.length - 1; i++) frames.push(frameFromZ(vSub(piv[i], piv[i + 1])));
    frames.push(frameFromZ(vSub(piv.at(-1), qTail)));                   // tail

    // SPINE — one free bone per ball. The curve gives each link's PART frame;
    // the bone it rides is not the same thing (the part is bolted into the ball
    // at an angle — `seatR`), so the frame the bone must reach is
    // frame · seatRᵀ. The bone then takes what is left of it after its parent
    // and its own rest (slot-match) rotation: R = RESTᵀ · parentᵀ · W.
    rootBone.offset = piv[0];
    rootBone.rot = frames[0];                       // the root part sits square on its bone
    let prev = frames[0];
    spine.forEach((d, i) => {
      const W = m3Mul(frames[i + 1], m3T(d.seatR));
      const b = bones[d.ids[0]];
      b.rot = m3Mul(m3T(b.rest), m3Mul(m3T(prev), W));
      prev = W;
    });

    // LIMBS — the sliders, plus the swim stroke layered on top. One driven bone
    // each: the shoulder / hip disc, the elbow / knee pin.
    const swimLap = o.swim ?? o.offset;             // one timeline drives ride and gait
    for (const d of rig.links) {
      if (!d.limb) continue;
      const m = LIMB[d.limb];
      const ph = ((((swimLap % 1) + 1) % 1) * SWIM.strokes + (d.phase || 0)) * 2 * Math.PI;
      // the disc channels read the flank's sign (its pin is reversed); the pin
      // channels (elbow, knee) bend the same way on both sides
      const s = m.mirror ? d.sign : 1;
      bones[d.ids[m.dof]].angle = s * rad(o[m.key] + SWIM[m.amp] * Math.sin(ph + m.lag));
    }
    rig.setPose({ jaw: rad(o.jaw) });               // declarative binding: the jaw hinge

    return rig.emit(opts);
  }

  return { model, pitch, rig };
}

// the compiled rig is cached per seed, so calling dragonModel() every frame
// stays cheap
let _rig = null, _rigSeed = null;
function getRig(seed) {
  if (!_rig || _rigSeed !== seed) { _rig = createDragonRig(seed); _rigSeed = seed; }
  return _rig;
}

export function dragonModel(seed = 1, pose = {}, path = null, opts = {}) {
  return getRig(seed).model(pose, path, opts);
}
