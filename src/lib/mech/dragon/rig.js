// DRAGON RIG — a SKELETON drives the dragon part kit. The layering stays
// strict: primitives build joints (joints.js), joints + primitives build parts
// (dragon/parts.js), and THIS FILE only instantiates parts and connects/drives
// them — it never re-models geometry.
//
// The body chain is posed on a CLOSED CATMULL-ROM LOOP: joint pivots are
// chord-marched along the curve at exact part pitches (so every ball stud
// lands exactly in its socket) and `offset` slides the dragon along.
//
// BUILD/FRAME SPLIT: createDragonRig() compiles everything pose-independent
// ONCE — part slots, link pitches, the skeleton (offsets + rest rotations),
// and the emitted geometry of every pose-less part (spine segments, tail).
// rig.model(pose, path) only updates bone angles, re-marches the pivots and
// re-emits items; only posed parts (head jaw, limbs) rebuild geometry.
import { DRAGON_KIT } from "./parts.js";
import { currentJointGroup, resetJointGroups } from "../joints.js";
import { colorMemo } from "../color.js";
import { bake } from "../primitives.js";
import {
  createSkeleton, addBall, setBall, matchRot, frameFromZ, mirrorSlot,
  createMeshCache, xfCompose, xfT,
} from "../skeleton.js";
import { buildSpline } from "../../math/curve.js";
import { rad } from "../../math/scalar.js";
import { vAdd, vSub, vScale, vLen, vNorm, m3Mul, m3MulV, m3T } from "../../math/mat3.js";

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

// walk BACKWARD along the loop from s until the CHORD to the anchor equals
// dist — chord, not arc, so a rigid part spans its two pivots exactly.
// Since the loop is arc-length parameterised, chord(k) <= k, so the crossing
// sits at k >= dist: bracket from there instead of scanning from zero.
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

// runtime rig controls (degrees except offset = 0..1 along the loop)
export const DRAGON_POSE = {
  offset: 0, jaw: 12, armSwing: 30, elbow: 45, legSwing: -25, knee: 35,
};

const SEG_P = { bodyR: 0.5, segLen: 1.35, discs: 3, finR: 0.38 };
const SEG7_P = { rFront: 0.5, rRear: 0.42, segLen: 1.15, finR: 0.34 };  // first taper stage
const TAPER_P = { rFront: 0.42, rRear: 0.34, segLen: 1.15, finR: 0.3 }; // tapers into the tail
const TAIL_P = { coreLen: 1.3, bodyR: 0.34, tipLen: 1.4 };              // bodyR matches the taper's rRear

// THE RIG DEFINITION — the dragon as slot matches. `parent.at` names the slot
// on the parent part, `slot` the slot on this part; the two are glued
// (positions coincide, normals oppose — `mirror` X-flips the part so the
// normals work out on the other flank). SPINE links ride the loop curve
// (their ball-bone angles are solved from it); LIMB links take their bone
// angles from the UI pose and feed them into the part's runtime pose channel.
const DRAGON_DEF = [
  { name: "head", part: "head", pivot: "neck" },   // root: pivot slot anchors on the curve
  { name: "seg1", part: "bodySegment", params: SEG_P, parent: "head", at: "neck", slot: "front", spine: true },
  { name: "seg2", part: "bodySegment", params: SEG_P, parent: "seg1", at: "rear", slot: "front", spine: true },
  { name: "seg3", part: "bodySegment", params: SEG_P, parent: "seg2", at: "rear", slot: "front", spine: true },
  { name: "seg4", part: "bodySegment", params: SEG_P, parent: "seg3", at: "rear", slot: "front", spine: true },
  { name: "seg5", part: "bodySegment", params: SEG_P, parent: "seg4", at: "rear", slot: "front", spine: true },
  { name: "seg6", part: "bodySegment", params: SEG_P, parent: "seg5", at: "rear", slot: "front", spine: true },
  { name: "seg7", part: "bodySegment2", params: SEG7_P, parent: "seg6", at: "rear", slot: "front", spine: true },
  { name: "taper1", part: "bodySegment2", params: TAPER_P, parent: "seg7", at: "rear", slot: "front", spine: true },
  { name: "taper2", part: "bodySegment2", params: TAPER_P, parent: "taper1", at: "rear", slot: "front", spine: true },
  { name: "taper3", part: "bodySegment2", params: TAPER_P, parent: "taper2", at: "rear", slot: "front", spine: true },
  { name: "tail", part: "tail", params: TAIL_P, parent: "taper3", at: "rear", slot: "front", spine: true },
  { name: "armL", part: "arm", parent: "seg2", at: "flankL", slot: "mount", pose: ["armSwing", "elbow"], phase: 0 },
  { name: "armR", part: "arm", parent: "seg2", at: "flankR", slot: "mount", pose: ["armSwing", "elbow"], phase: 0.5, mirror: true },
  { name: "legL", part: "leg", parent: "seg5", at: "flankL", slot: "mount", pose: ["legSwing", "knee"], phase: 0.5 },
  { name: "legR", part: "leg", parent: "seg5", at: "flankR", slot: "mount", pose: ["legSwing", "knee"], phase: 0, mirror: true },
];

// SWIM STROKE — a second animation layered on the base limb pose, its
// timeline driven by the SAME loop offset: `strokes` paddle cycles per lap,
// swing/bend = oscillation amplitudes (degrees) around the pose sliders, and
// bend LAGS swing by a quarter cycle so each limb whips like a paddle.
// Left/right run at OPPOSITE phases, and so do front/rear — diagonal pairs
// stroke together (armL+legR, then armR+legL), a trot-like paddling gait.
const SWIM = { strokes: 4, swing: 22, bend: 20 };

// closed flight loop the spine rides (roughly a ring, strongly undulating in Y
// — alternating crests and troughs so the dragon visibly swims up and down)
const LOOP_PTS = [
  [7.8, 5.5, 0], [5.5, 2.7, 5.5], [0, 5.2, 7.7], [-5.5, 2.5, 5.5],
  [-7.8, 5.6, 0], [-5.5, 2.6, -5.5], [0, 5.0, -7.7], [5.5, 2.8, -5.5],
];

let _defaultLoop = null;
const defaultLoop = () => (_defaultLoop ??= makeLoop(LOOP_PTS));

// COMPILED RIG: everything pose-independent happens here, once. `model(pose,
// path)` is the per-frame entry — it never touches partSlots, never rebuilds
// the skeleton, and only re-emits geometry for parts with live pose channels.
export function createDragonRig(seed = 1) {
  const defs = DRAGON_DEF.map((d) => ({
    ...d,
    slots: d.mirror
      ? Object.fromEntries(Object.entries(DRAGON_KIT.partSlots(d.part, d.params)).map(([k, s]) => [k, mirrorSlot(s)]))
      : DRAGON_KIT.partSlots(d.part, d.params),
  }));
  const byName = Object.fromEntries(defs.map((d) => [d.name, d]));
  const spine = defs.filter((d) => d.spine);
  // a link's own pivot slot: the slot it mates with (head: its declared pivot)
  for (const d of defs) d.slots.slot0 = d.slots[d.spine ? d.slot : (d.pivot ?? d.slot)];

  // --- link pitches: each spine link's pitch = distance between its parent's
  // mating slot and the parent's own pivot slot (all read off the parts,
  // which read off their joints) ---
  const pitchOf = (d) => {
    const par = byName[d.parent];
    return vLen(vSub(par.slots[d.at].pos, par.slots.slot0.pos));
  };
  for (const d of spine) d.pitch = pitchOf(d);
  const tailChord = vLen(byName.tail.slots.front.pos);   // orients the tail
  const pitch = spine.reduce((a, d) => a + d.pitch, 0);

  // --- skeleton, built ONCE: every link = a 3-DOF joint = 3 chained bones,
  // seated at the slot-match point with the slot-match REST rotation. Only
  // ANGLES (and the root offset) change per frame ---
  const sk = createSkeleton();
  const boneOf = {}, depthOf = {};
  defs.forEach((d) => {
    const par = d.parent ? byName[d.parent] : null;
    const offset = par
      ? vSub(par.slots[d.at].pos, par.slots.slot0.pos)  // match point, in the parent's pivot frame
      : [0, 0, 0];                                      // root: set to the curve anchor per frame
    const rest = par ? matchRot(par.slots[d.at], d.slots[d.slot]) : null;
    d.rest = rest;
    d.ids = addBall(sk, d.name, par ? boneOf[d.parent] : -1, offset, rest);
    if (!d.spine && par)
      d.bendBone = sk.add(`${d.name}.bend`, d.ids[2], [0, -1, 0], "x");
    boneOf[d.name] = d.ids[2];
    depthOf[d.name] = par ? depthOf[d.parent] + 1 : 0;
  });
  const rootBone = sk.bones[byName.head.ids[0]];
  // jaw pin position comes off the head's jaw slot, relative to its pivot slot
  const jawB = sk.add("jaw", boneOf.head,
    vSub(byName.head.slots.jaw.pos, byName.head.slots.slot0.pos), "x");

  // --- static geometry templates: pose-less parts (spine segments, tail)
  // emit the same primitives every frame, so capture them once. Posed parts
  // (head jaw, limbs) rebuild per frame through the same capture sink ---
  const colorFor = colorMemo(seed);
  const capture = (d, ppose, out) => {
    DRAGON_KIT.buildPart(d.part, (g) => {
      const b = bake(g);
      if (d.mirror) {                                // X-flip = negate the output x row
        for (let c = 0; c < 3; c++) b.m[c] = -b.m[c];
        b.t[0] = -b.t[0];
      }
      out.push({
        key: b.key,
        m: b.m,
        t: b.t,
        // identical shapes share a color no matter which part emitted them
        color: colorFor(b.id),
        // sub-assembly this primitive belongs to: the emitting joint block,
        // or the part body — assembly animations group by this
        group: `${d.name}:${currentJointGroup() ?? "body"}`,
      });
    }, d.params ?? null, ppose);
    return out;
  };
  resetJointGroups();
  for (const d of defs) if (d.spine && !d.pose) d.tpl = capture(d, null, []);

  const meshCache = createMeshCache();

  // --- per-frame: solve bones from the ride curve + pose, FK, emit items.
  // `path` (optional) = external ride curve { total, posAt(s), tangentAt(s) }
  // in RIG SPACE (y-up); defaults to the built-in flight loop. pose.swim
  // (0..1, optional) drives the paddle stroke phase separately from `offset`
  // — needed when the path is not a closed lap so offset alone can't phase
  // the gait ---
  function model(pose = {}, path = null) {
    const o = { ...DRAGON_POSE, ...pose };
    const loop = path ?? defaultLoop();

    // spine joint pivots chord-marched backward from the head anchor
    const sList = [(((o.offset % 1) + 1) % 1) * loop.total];
    for (const d of spine) sList.push(marchBack(loop, sList.at(-1), d.pitch));
    const piv = sList.map((s) => loop.posAt(s));
    const qTail = loop.posAt(marchBack(loop, sList.at(-1), tailChord));

    // world frame per chain link: +Z = forward chord from its own pivot to
    // the NEXT pivot down the chain (piv[i] -> piv[i+1] runs tailward)
    const frames = [frameFromZ(loop.tangentAt(sList[0]))];              // head
    for (let i = 1; i < piv.length - 1; i++) frames.push(frameFromZ(vSub(piv[i], piv[i + 1])));
    frames.push(frameFromZ(vSub(piv.at(-1), qTail)));                   // tail

    // spine bone ANGLES are solved from the curve frames and FK resolve()
    // rebuilds the worlds — the bones, not the curve, place the parts.
    // Limb/jaw bone angles come straight from the UI pose.
    rootBone.offset = piv[0];
    for (const d of defs) {
      if (d.spine || !d.parent) {
        const si = spine.indexOf(d) + 1;              // head = frames[0]
        // articulation = what's left after the parent frame AND the rest pose
        const M = d.parent
          ? m3Mul(m3T(d.rest), m3Mul(m3T(frames[si - 1]), frames[si]))
          : frames[0];
        setBall(sk, d.ids, M);
      } else {
        // swim layer: stroke phase = loop offset (the one timeline drives both
        // the body's ride along the curve and the limb paddling)
        const swimLap = o.swim ?? o.offset;
        const ph = ((((swimLap % 1) + 1) % 1) * SWIM.strokes + (d.phase || 0)) * 2 * Math.PI;
        sk.bones[d.ids[0]].angle = rad(o[d.pose[0]] + SWIM.swing * Math.sin(ph));  // spinF = fore/aft swing (X)
        sk.bones[d.bendBone].angle = rad(o[d.pose[1]] + SWIM.bend * Math.sin(ph - Math.PI / 2));
      }
    }
    sk.bones[jawB].angle = rad(o.jaw);
    const W = sk.resolve();

    // instantiate parts through the bone worlds, seated by their slot:
    // part transform = bone world ∘ T(-slot.pos), so the slot lands on the
    // bone. Primitives are instance HANDLES { key, m, t } — placing a part is
    // pure matrix composition, no vertex work; the renderer instances by key.
    const items = [];
    resetJointGroups();                                // stable group names per frame
    for (const d of defs) {
      const t = xfCompose(W[boneOf[d.name]], xfT(vScale(d.slots.slot0.pos, -1)));
      // world assembly normal: the link's mating slot normal points at the
      // parent, so the approach side (where the group floats pre-snap) is -n
      const an = vNorm(vScale(m3MulV(t.r, d.slots.slot0.n), -1));
      const depth = depthOf[d.name];
      let ppose = null;
      if (d.name === "head") ppose = { jaw: sk.bones[jawB].angle };
      else if (d.pose)                                 // limb: bones feed the pose channel
        ppose = {
          spinF: sk.bones[d.ids[0]].angle,
          swing: sk.bones[d.ids[1]].angle,
          spinM: sk.bones[d.ids[2]].angle,
          [d.part === "arm" ? "elbow" : "knee"]: sk.bones[d.bendBone].angle,
        };
      // static part: compose cached prims; posed part: rebuild through the sink
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

  return { model, pitch };
}

// the compiled rig is cached per seed, so calling dragonModel() every frame
// stays cheap
let _rig = null, _rigSeed = null;
function getRig(seed) {
  if (!_rig || _rigSeed !== seed) { _rig = createDragonRig(seed); _rigSeed = seed; }
  return _rig;
}

export function dragonModel(seed = 1, pose = {}, path = null) {
  return getRig(seed).model(pose, path);
}
