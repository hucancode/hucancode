// DRAGON RIG — a SKELETON drives the existing part kit. The layering stays
// strict: primitives build joints (parts.js blocks), joints + primitives
// build parts, parts model the dragon, and THIS FILE only instantiates parts
// and connects/drives them — it never re-models geometry.
//
// Skeleton rules (the whole point of the rig):
//   - a bone is ONE rotation about ONE axis. Only joints rotate, so every
//     bone sits on a joint DOF: a ball joint = 3 chained bones (x, y, z),
//     a hinge3 = 3 bones (spinF, swing, spinM), a hinge = 1 bone.
//   - every primitive rides exactly one bone: spine bones place whole
//     segments rigidly (the ball absorbs the relative rotation inside the
//     socket), limb/jaw bones feed the parts' runtime pose channels, which
//     route each primitive through its one rotation chain.
//
// Parts connect by MOUNT SLOT MATCHING: joints define their two mount slots
// (jointMounts), parts re-export them in part space (partSlots), and the RIG
// DEFINITION below just names which slot mates with which — positions
// coincide, normals oppose, and a joint's bones rotate about the match point.
//
// The body chain is posed on a CLOSED CATMULL-ROM LOOP: joint pivots are
// chord-marched along the curve at exact part pitches (so every male ball
// lands exactly in its female socket) and `offset` slides the dragon along.
import { buildPart, partSlots, colorOf, currentJointGroup, resetJointGroups } from "./parts.js";
import { bake, meshOf } from "./primitives.js";

// ---- tiny rigid-transform math: 3x3 row-major rotation + translation ------
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const vAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vScale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vLen = (a) => Math.hypot(a[0], a[1], a[2]);
const vNorm = (a) => vScale(a, 1 / (vLen(a) || 1));
const vCross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function m3Mul(a, b) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}
const m3MulV = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const m3T = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

function m3Rot(axis, t) {
  const c = Math.cos(t), s = Math.sin(t);
  if (axis === "x") return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === "y") return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

// orthonormal frame with local +Z aligned to z (columns X, Y, Z)
function frameFromZ(z, up = [0, 1, 0]) {
  const Z = vNorm(z);
  let X = vCross(up, Z);
  if (vLen(X) < 1e-4) X = vCross([1, 0, 0], Z);   // tangent went vertical
  X = vNorm(X);
  const Y = vCross(Z, X);
  return [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]];
}

// xf = { r: mat3, t: vec3 }; compose applies b in a's frame
const xf = (r, t) => ({ r, t });
const xfCompose = (a, b) => ({ r: m3Mul(a.r, b.r), t: vAdd(a.t, m3MulV(a.r, b.t)) });
const xfT = (t) => ({ r: I3, t });

// ---- mount-slot frames -------------------------------------------------------
// a slot { pos, n, f } forms a full coordinate system: columns [f, n×f, n]
export const slotFrame = (s) => {
  const f = vNorm(s.f), n = vNorm(s.n), b = vCross(n, f);
  return [f[0], b[0], n[0], f[1], b[1], n[1], f[2], b[2], n[2]];
};
// REST rotation seating a child slot against a parent slot: positions
// coincide (handled by the bone offset), forwards ALIGN, normals OPPOSE
export const matchRot = (parentSlot, childSlot) => {
  const f = vNorm(parentSlot.f), n = vScale(vNorm(parentSlot.n), -1);
  const b = vCross(n, f);
  const target = [f[0], b[0], n[0], f[1], b[1], n[1], f[2], b[2], n[2]];
  return m3Mul(target, m3T(slotFrame(childSlot)));
};

// ---- skeleton --------------------------------------------------------------
// bone = one rotation about one axis, seated at `offset` in the parent frame,
// with an optional fixed REST rotation (the slot-match orientation).
// world(bone) = world(parent) ∘ T(offset) ∘ REST ∘ R(axis, angle)
export function createSkeleton() {
  const bones = [];
  return {
    bones,
    add(name, parent = -1, offset = [0, 0, 0], axis = "x", rest = null) {
      bones.push({ name, parent, offset, axis, angle: 0, rest });
      return bones.length - 1;
    },
    resolve() {
      const out = [];
      for (const b of bones) {
        let R = m3Rot(b.axis, b.angle);
        if (b.rest) R = m3Mul(b.rest, R);
        if (b.parent < 0) out.push(xf(R, [...b.offset]));
        else {
          const p = out[b.parent];
          out.push(xf(m3Mul(p.r, R), vAdd(p.t, m3MulV(p.r, b.offset))));
        }
      }
      return out;
    },
  };
}

// a full 3-DOF joint (ball / hinge3) = 3 chained bones, x -> y -> z; the rest
// (slot-match) rotation rides the first bone
export function addBall(sk, name, parent, offset = [0, 0, 0], rest = null) {
  const x = sk.add(`${name}.x`, parent, offset, "x", rest);
  const y = sk.add(`${name}.y`, x, [0, 0, 0], "y");
  const z = sk.add(`${name}.z`, y, [0, 0, 0], "z");
  return [x, y, z];
}

// set the 3 chained bones from a relative rotation matrix (M = Rx·Ry·Rz)
export function setBall(sk, ids, M) {
  const sy = Math.max(-1, Math.min(1, M[2]));
  if (Math.abs(sy) > 0.99999) {                   // gimbal: fold z into x
    sk.bones[ids[0]].angle = (sy > 0 ? 1 : -1) * Math.atan2(M[3], M[4]);
    sk.bones[ids[1]].angle = Math.asin(sy);
    sk.bones[ids[2]].angle = 0;
  } else {
    sk.bones[ids[0]].angle = Math.atan2(-M[5], M[8]);
    sk.bones[ids[1]].angle = Math.asin(sy);
    sk.bones[ids[2]].angle = Math.atan2(-M[1], M[0]);
  }
}

// ---- closed Catmull-Rom loop ------------------------------------------------
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t, o = [0, 0, 0];
  for (let i = 0; i < 3; i++)
    o[i] = 0.5 * (2 * p1[i] + (p2[i] - p0[i]) * t +
      (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
      (3 * p1[i] - p0[i] - 3 * p2[i] + p3[i]) * t3);
  return o;
}

export function makeLoop(pts, per = 48) {
  const n = pts.length, samples = [], cum = [0];
  for (let i = 0; i < n; i++)
    for (let k = 0; k < per; k++)
      samples.push(catmull(pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n], k / per));
  for (let i = 1; i <= samples.length; i++)
    cum.push(cum[i - 1] + vLen(vSub(samples[i % samples.length], samples[i - 1])));
  const total = cum[samples.length];
  const posAt = (s) => {
    let u = ((s % total) + total) % total;
    let lo = 0, hi = samples.length;               // cum[i] <= u < cum[i+1]
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= u) lo = m; else hi = m; }
    const f = (u - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
    const a = samples[lo], b = samples[(lo + 1) % samples.length];
    return vAdd(a, vScale(vSub(b, a), f));
  };
  const tangentAt = (s) => vNorm(vSub(posAt(s + total / 500), posAt(s - total / 500)));
  return { total, posAt, tangentAt };
}

// walk BACKWARD along the loop from s until the CHORD to the anchor equals
// dist — chord, not arc, so a rigid part spans its two pivots exactly
export function marchBack(loop, s, dist) {
  if (dist <= 1e-9) return s;
  const anchor = loop.posAt(s);
  const step = loop.total / 1500;
  let k = step;
  while (k < loop.total * 0.5 && vLen(vSub(loop.posAt(s - k), anchor)) < dist) k += step;
  let lo = k - step, hi = k;                       // bisect the crossing
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (vLen(vSub(loop.posAt(s - m), anchor)) < dist) lo = m; else hi = m;
  }
  return s - (lo + hi) / 2;
}

// ---- the dragon ---------------------------------------------------------------

// runtime rig controls (degrees except offset = 0..1 along the loop)
export const DRAGON_POSE = {
  offset: 0, jaw: 12, armSwing: 30, elbow: 45, legSwing: -25, knee: 35,
};

const SEG_P = { bodyR: 0.5, segLen: 1.35, discs: 3, finR: 0.38 };
const TAPER_P = { rFront: 0.5, rRear: 0.34, segLen: 1.15, finR: 0.3 };  // tapers into the tail
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
  { name: "taper", part: "bodySegment2", params: TAPER_P, parent: "seg6", at: "rear", slot: "front", spine: true },
  { name: "tail", part: "tail", params: TAIL_P, parent: "taper", at: "rear", slot: "front", spine: true },
  { name: "armL", part: "arm", parent: "seg1", at: "flankL", slot: "mount", pose: ["armSwing", "elbow"], phase: 0 },
  { name: "armR", part: "arm", parent: "seg1", at: "flankR", slot: "mount", pose: ["armSwing", "elbow"], phase: 0.5, mirror: true },
  { name: "legL", part: "leg", parent: "seg6", at: "flankL", slot: "mount", pose: ["legSwing", "knee"], phase: 0.5 },
  { name: "legR", part: "leg", parent: "seg6", at: "flankR", slot: "mount", pose: ["legSwing", "knee"], phase: 0, mirror: true },
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

const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => ((d || 0) * Math.PI) / 180;
const mirrorSlot = (s) => ({
  pos: [-s.pos[0], s.pos[1], s.pos[2]],
  n: [-s.n[0], s.n[1], s.n[2]],
  f: [-s.f[0], s.f[1], s.f[2]],
});

// total chord length of the spine chain (sum of link pitches) — an external
// caller uses this to scale its path so the dragon covers a chosen arc of it
export function dragonPitch() {
  const slots = {};
  for (const d of DRAGON_DEF) {
    if (!d.spine && d.parent) continue;
    slots[d.name] = partSlots(d.part, d.params);
    slots[d.name].slot0 = slots[d.name][d.spine ? d.slot : (d.pivot ?? d.slot)];
  }
  let sum = 0;
  for (const d of DRAGON_DEF)
    if (d.spine) sum += vLen(vSub(slots[d.parent][d.at].pos, slots[d.parent].slot0.pos));
  return sum;
}

// `path` (optional) = external ride curve { total, posAt(s), tangentAt(s) } in
// RIG SPACE (y-up); defaults to the built-in flight loop. pose.swim (0..1,
// optional) drives the paddle stroke phase separately from `offset` — needed
// when the path is not a closed lap so offset alone can't phase the gait.
export function dragonModel(seed = 1, pose = {}, path = null) {
  const o = { ...DRAGON_POSE, ...pose };
  const defs = DRAGON_DEF.map((d) => ({
    ...d,
    slots: d.mirror
      ? Object.fromEntries(Object.entries(partSlots(d.part, d.params)).map(([k, s]) => [k, mirrorSlot(s)]))
      : partSlots(d.part, d.params),
  }));
  const byName = Object.fromEntries(defs.map((d) => [d.name, d]));
  const spine = defs.filter((d) => d.spine);
  // a link's own pivot slot: the slot it mates with (head: its declared pivot)
  for (const d of defs) d.slots.slot0 = d.slots[d.spine ? d.slot : (d.pivot ?? d.slot)];

  // --- spine joint pivots chord-marched backward from the head anchor; each
  // link's pitch = distance between its parent's mating slot and the parent's
  // own pivot slot (all read off the parts, which read off their joints) ---
  const loop = path ?? makeLoop(LOOP_PTS);
  const pitchOf = (d) => {
    const par = byName[d.parent];
    return vLen(vSub(par.slots[d.at].pos, par.slots.slot0.pos));
  };
  const sList = [(((o.offset % 1) + 1) % 1) * loop.total];
  for (const d of spine) sList.push(marchBack(loop, sList.at(-1), pitchOf(d)));
  const piv = sList.map((s) => loop.posAt(s));
  const qTail = loop.posAt(marchBack(loop, sList.at(-1), vLen(byName.tail.slots.front.pos))); // orients the tail

  // --- world frame per chain link: +Z = forward chord from its own pivot to
  // the NEXT pivot down the chain (piv[i] -> piv[i+1] runs tailward) ---
  const frames = [frameFromZ(loop.tangentAt(sList[0]))];              // head
  for (let i = 1; i < piv.length - 1; i++) frames.push(frameFromZ(vSub(piv[i], piv[i + 1])));
  frames.push(frameFromZ(vSub(piv.at(-1), qTail)));                   // tail

  // --- skeleton: every link = a 3-DOF joint = 3 chained bones, seated at the
  // slot-match point. Spine bone ANGLES are solved from the curve frames and
  // FK resolve() rebuilds the worlds — the bones, not the curve, place the
  // parts. Limb/jaw bone angles come straight from the UI pose.
  const sk = createSkeleton();
  const boneOf = {};                                // link name -> z-bone index
  defs.forEach((d) => {
    const par = d.parent ? byName[d.parent] : null;
    const offset = par
      ? vSub(par.slots[d.at].pos, par.slots.slot0.pos)  // match point, in the parent's pivot frame
      : piv[0];
    const rest = par ? matchRot(par.slots[d.at], d.slots[d.slot]) : null;
    const ids = addBall(sk, d.name, par ? boneOf[d.parent] : -1, offset, rest);
    if (d.spine || !par) {
      const si = spine.indexOf(d) + 1;              // head = frames[0]
      // articulation = what's left after the parent frame AND the rest pose
      const M = par
        ? m3Mul(m3T(rest), m3Mul(m3T(frames[si - 1]), frames[si]))
        : frames[0];
      setBall(sk, ids, M);
    } else {
      // swim layer: stroke phase = loop offset (the one timeline drives both
      // the body's ride along the curve and the limb paddling)
      const swimLap = o.swim ?? o.offset;
      const ph = ((((swimLap % 1) + 1) % 1) * SWIM.strokes + (d.phase || 0)) * 2 * Math.PI;
      sk.bones[ids[0]].angle = rad(o[d.pose[0]] + SWIM.swing * Math.sin(ph));  // spinF = fore/aft swing (X)
      d.bendBone = sk.add(`${d.name}.bend`, ids[2], [0, -1, 0], "x");
      sk.bones[d.bendBone].angle = rad(o[d.pose[1]] + SWIM.bend * Math.sin(ph - Math.PI / 2));
    }
    d.ids = ids;
    boneOf[d.name] = ids[2];
  });
  const jawB = sk.add("jaw", boneOf.head, [0, -0.53, 0.88], "x");
  sk.bones[jawB].angle = rad(o.jaw);
  const W = sk.resolve();

  // --- instantiate parts through the bone worlds, seated by their slot:
  // part transform = bone world ∘ T(-slot.pos), so the slot lands on the bone.
  // Primitives are instance HANDLES { key, m, t } — placing a part is pure
  // matrix composition, no vertex work; the renderer instances by key.
  const items = [];
  resetJointGroups();                                // stable group names per build
  const put = (name, linkName, params, ppose, t, mirror = false) => {
    buildPart(name, (g) => {
      const b = bake(g);
      if (mirror) {                                  // X-flip = negate the output x row
        for (let c = 0; c < 3; c++) b.m[c] = -b.m[c];
        b.t[0] = -b.t[0];
      }
      // identical shapes share a color no matter which part emitted them
      items.push({
        key: b.key,
        m: m3Mul(t.r, b.m),
        t: vAdd(m3MulV(t.r, b.t), t.t),
        color: colorOf(b.id, seed),
        // sub-assembly this primitive belongs to: the emitting joint block,
        // or the part body — assembly animations group by this
        group: `${linkName}:${currentJointGroup() ?? "body"}`,
      });
    }, params, ppose);
  };

  for (const d of defs) {
    const t = xfCompose(W[boneOf[d.name]], xfT(vScale(d.slots.slot0.pos, -1)));
    let ppose = null;
    if (d.name === "head") ppose = { jaw: deg(sk.bones[jawB].angle) };
    else if (d.pose)                                 // limb: bones feed the pose channel
      ppose = {
        spinF: deg(sk.bones[d.ids[0]].angle),
        swing: deg(sk.bones[d.ids[1]].angle),
        spinM: deg(sk.bones[d.ids[2]].angle),
        [d.part === "arm" ? "elbow" : "knee"]: deg(sk.bones[d.bendBone].angle),
      };
    put(d.part, d.name, d.params ?? null, ppose, t, !!d.mirror);
  }

  const meshes = {};
  for (const it of items) if (!meshes[it.key]) meshes[it.key] = meshOf(it.key);
  return { items, meshes, name: "dragon", skeleton: sk };
}

// ---- ASSEMBLY ANIMATION --------------------------------------------------------
// The dragon builds itself in FOUR stages, hierarchically: primitives belong
// to sub-assembly GROUPS (a part body or a joint block — the `group` tag on
// every item), groups belong to the dragon.
//   1. each primitive flies in from a scatter point to a small standoff near
//      its stage-2 target (its seat in the group, which floats offset from
//      the group's final position)
//   2. the primitive SNAPS into its group — once a group's primitives are all
//      seated, the assembled part/joint floats NEAR its final position
//   3. the assembled groups HOVER a little (slow deterministic wobble)
//   4. each group SNAPS into its final position (overshoot ease)
// Each group gets a time offset (chain order, head first), each primitive
// within a group another. All randomness is HASHED off group/item indices so
// scrubbing the clock replays the exact same build. Distances are RIG UNITS,
// stage times are fractions of the whole build (u in 0..1).
export const ASSEMBLY = {
  gSpan: 0.45,             // group start stagger (broad — groups clearly one by one)
  pSpan: 0.08,             // primitive stagger within its group
  pJit: 0.03,              // hashed extra primitive delay
  fly: 0.15,               // stage 1 duration
  snap2: 0.05,             // stage 2 duration
  hoverIn: 0.06,           // hover wobble ramp-in once the group is assembled
  hover: [0.05, 0.10],     // stage 3 duration per group (hashed) — groups are
                           // independent: each snaps as soon as ITS hover ends
  snap4: 0.07,             // stage 4 duration
  fadeIn: 0.15,            // fraction of the flight spent fading a prim in
  scatter: [12, 24],       // prim start distance from its target
  standoff: [0.5, 1.0],    // prim pre-snap standoff distance
  gOff: [1.2, 2.8],        // group near-final offset distance (stages 2-3)
  hoverAmp: 0.25,          // stage 3 wobble amplitude
  hoverFreq: 16,           // stage 3 wobble phase sweep over the whole build
  revs: [0.75, 1.75],      // prim self-spin during flight, revolutions
};

// deterministic per-index random in [0,1)
function hash01(i, salt) {
  let h = (Math.imul(i, 374761393) + Math.imul(salt, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

function m3AxisAngle(ax, ay, az, t) {
  const c = Math.cos(t), s = Math.sin(t), k = 1 - c;
  return [
    ax * ax * k + c, ax * ay * k - az * s, ax * az * k + ay * s,
    ay * ax * k + az * s, ay * ay * k + c, ay * az * k - ax * s,
    az * ax * k - ay * s, az * ay * k + ax * s, az * az * k + c,
  ];
}

// Animate a dragonModel() item list at build progress u (0 = nothing placed,
// 1 = fully assembled). Returns a NEW item list: items not yet spawned are
// dropped, flying/hovering items get displaced m/t and an alpha `a`.
export function assembleModel(items, u) {
  if (u >= 1) return items;
  if (u <= 0) return [];
  const A = ASSEMBLY;
  // group registry: first-seen order (stable per build, chain order)
  const reg = new Map();
  const gOf = new Int32Array(items.length), pOf = new Int32Array(items.length);
  const counts = [];
  items.forEach((it, i) => {
    let gi = reg.get(it.group);
    if (gi === undefined) { gi = reg.size; reg.set(it.group, gi); counts.push(0); }
    gOf[i] = gi; pOf[i] = counts[gi]++;
  });
  const nG = reg.size;

  const out = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const gi = gOf[i];
    const gFrac = nG > 1 ? gi / (nG - 1) : 0;
    const gd = gFrac * A.gSpan;
    const cnt = counts[gi];
    const pFrac = cnt > 1 ? pOf[i] / (cnt - 1) : 0;
    const pt = u - gd - pFrac * A.pSpan - hash01(i, 1) * A.pJit;
    if (pt <= 0) continue;                           // not spawned yet

    // ---- group offset (stages 2-4): near-final float + hover, snapped away
    const gaz = Math.PI * 2 * hash01(gi, 20);
    const gz = 0.1 + 0.6 * hash01(gi, 21);
    const gs = Math.sqrt(Math.max(0, 1 - gz * gz));
    const gLen = A.gOff[0] + (A.gOff[1] - A.gOff[0]) * hash01(gi, 22);
    const gDone = gd + A.pSpan + A.pJit + A.fly + A.snap2;  // group fully seated
    const hw = A.hoverAmp * Math.max(0, Math.min(1, (u - gDone) / A.hoverIn));
    const hx = hw * Math.sin(u * A.hoverFreq * (0.8 + 0.4 * hash01(gi, 23)) + hash01(gi, 24) * 7);
    const hy = hw * Math.sin(u * A.hoverFreq * (0.9 + 0.4 * hash01(gi, 25)) + hash01(gi, 26) * 7);
    const hz = hw * Math.sin(u * A.hoverFreq * (0.7 + 0.4 * hash01(gi, 27)) + hash01(gi, 28) * 7);
    // stage 4 rides this group's OWN clock: assembled -> hover -> snap
    const hoverDur = A.hover[0] + (A.hover[1] - A.hover[0]) * hash01(gi, 29);
    const s4p = Math.max(0, Math.min(1, (u - gDone - A.hoverIn - hoverDur) / A.snap4));
    const seat = 1 - (s4p > 0 ? easeOutBack(s4p) : 0);
    const ox = (Math.cos(gaz) * gs * gLen + hx) * seat;
    const oy = (Math.sin(gaz) * gs * gLen + hy) * seat;
    const oz = (gz * gLen + hz) * seat;

    // ---- primitive offset (stages 1-2): scatter -> standoff -> seated
    let m = it.m, a = 1, dist = 0;
    if (pt < A.fly) {                                // stage 1: fly in
      const fp = easeInOutCubic(pt / A.fly);
      const r0 = A.scatter[0] + (A.scatter[1] - A.scatter[0]) * hash01(i, 4);
      const off = A.standoff[0] + (A.standoff[1] - A.standoff[0]) * hash01(i, 5);
      dist = off + (r0 - off) * (1 - fp);
      // self-spin unwinds to 0 exactly when the flight ends
      const revs = (hash01(i, 6) < 0.5 ? -1 : 1) *
        (A.revs[0] + (A.revs[1] - A.revs[0]) * hash01(i, 7));
      const ang = revs * 2 * Math.PI * (1 - fp);
      const axY = 2 * hash01(i, 8) - 1, axS = Math.sqrt(Math.max(0, 1 - axY * axY));
      const axA = Math.PI * 2 * hash01(i, 9);
      m = m3Mul(m3AxisAngle(Math.cos(axA) * axS, axY, Math.sin(axA) * axS, ang), m);
      a = Math.min(1, pt / (A.fly * A.fadeIn));
    } else if (pt < A.fly + A.snap2) {               // stage 2: snap into the group
      const off = A.standoff[0] + (A.standoff[1] - A.standoff[0]) * hash01(i, 5);
      dist = off * (1 - easeOutBack((pt - A.fly) / A.snap2));
    }
    const tr = [it.t[0] + ox, it.t[1] + oy, it.t[2] + oz];
    if (dist !== 0) {
      // scatter direction: deterministic, mostly from above (rig is y-up)
      const az = Math.PI * 2 * hash01(i, 2);
      const dy = 0.25 + 0.7 * hash01(i, 3);
      const s = Math.sqrt(Math.max(0, 1 - dy * dy));
      tr[0] += Math.cos(az) * s * dist;
      tr[1] += dy * dist;
      tr[2] += Math.sin(az) * s * dist;
    }
    out.push({ ...it, m, t: tr, a });
  }
  return out;
}
