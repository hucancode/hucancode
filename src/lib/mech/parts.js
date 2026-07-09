// PART CATALOG — mech joints assembled from the primitive engine (primitives.js).
// Every primitive instance is its own draw item with a RANDOM color (seeded, so
// a given seed reproduces the same coloring; bump the seed to reshuffle).
//
// The joints mirror the pieces designed in Blender (robot_dragon.blend):
//   hinge1  two U pieces (narrow nested in wide), arms interleaved with rounded
//           knuckles (half-cylinder ends), one shared pin through all four
//           arms, a base plate closing each U. `solid` swaps the male U for an
//           I-shaped tongue, discF/discM swap either base box -> disc, baseH
//           sizes both. hinge1Block seats it as the generic mount-to-mount
//           joint: solid male + disc bases, L-oriented (female disc -> parent
//           flank, male disc -> child) — dragon/atlas shoulder + hip seats
//   hinge2  TWO hinge1 stages in series sharing one middle base, pins X then
//           Z: a 2-axis universal joint (the atlas wrist). Same settings as
//           hinge1, with three disc flags — one per base
//   pivot1  double pivot: center barrel, flange disc + neck + cap on both ends
//   prismatic1  the LINEAR joint: a cover sleeve with a square mounting shaft
//           sliding out of each end (pose = travel distance, not degrees)
//   pivot2  turntable pivot: box base with an inscribed cylinder seat, disc,
//           ball hub — shows the box+cylinder primitive both ways
import {
  box, cylinder, cone, coneCut, sphere, hemisphere, cutHemisphere, halfCylinder,
  halfCylinderBox, boxCylinder, quarterCylinder, gear, rotX, rotY, rotZ, translate,
  bake, meshOf,
} from "./primitives.js";
import { rad } from "../math/scalar.js";

const HPI = Math.PI / 2;

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// curated mech palette
export const PALETTE = [
  "#c0392b", "#e67e22", "#f1c40f", "#7dcb2f", "#27ae60", "#1abc9c",
  "#3498db", "#2c5aa0", "#8e44ad", "#d354a4", "#c8a165", "#8d6e63",
  "#95a5a6", "#5d6d7e", "#e8e4d8", "#37474f",
].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));

// color = palette[f(shape id, seed)]: identical primitives with the same
// parameters get the SAME color (like lego pieces); bumping the seed remaps
// shapes to other palette entries but keeps the identity property.
export function colorOf(id, seed = 1) {
  const h = (hashStr(id || "anon") ^ Math.imul(seed, 0x9e3779b1)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const JOINT_DEFAULTS = {
  // pinOut = how far the pin shaft pokes past the female arms' outer faces;
  // 0 keeps it inside the clevis (clamped to PIN_OUT_MIN, not truly flush)
  hinge: { gap: 0.24, armT: 0.12, armH: 0.6, depth: 0.55, pinR: 0.14, clr: 0.03, pinOut: 0.05 },
  pivot: { barrelR: 0.3, barrelLen: 0.8, flangeR: 0.44, neckR: 0.17, neckLen: 0.16, capR: 0.32 },
  ball: { ballR: 0.3, socketT: 0.1, cut: 0.75, shaftR: 0.11, shaftLen: 0.3, baseW: 0.95, baseT: 0.14 },
  prismatic: { coverW: 0.5, coverLen: 0.7, coverD: 0.5, shaftW: 0.3, shaftLen: 0.7 },
};

// ---- editable per-part parameters, SCOPED PER KIT ----------------------------
// a part name only has to be unique inside its own kit — the atlas has a
// plain "head" next to the dragon's
export const PART_PARAMS = {
  dragon: {
    head: { headW: 1.2, snoutLen: 1.1, jawOpen: 16, eyeR: 0.17, hornLen: 0.9 },
    bodySegment: { bodyR: 0.55, segLen: 1.6, discs: 4, finR: 0.45 },
    bodySegment2: { rFront: 0.55, rRear: 0.36, segLen: 1.6, finR: 0.4 },
    arm: { upperLen: 0.45, foreLen: 0.4, elbowBend: 25, clawR: 0.3 },
    leg: { thighLen: 0.5, shinLen: 0.45, kneeBend: 18, footLen: 0.35, clawR: 0.28 },
    tail: { coreLen: 1.4, bodyR: 0.4, tipLen: 1.2 },
  },
  atlas: {
    head: { headR: 0.28, headD: 0.56, innerR: 0.17 },
    torso: { chestW: 1.15, chestH: 0.95, chestD: 0.68 },
    pelvis: { hipW: 0.85, hipH: 0.3 },
    upperArm: { len: 0.3, w: 0.3 },
    forearm: { len: 0.24, w: 0.26 },
    wrist: {},
    palm: { w: 0.26, h: 0.26, d: 0.24 },
    finger: { digitLen: 0.16, w: 0.12, curl: 18 },
    thigh: { len: 0.68, w: 0.38 },
    shin: { len: 0.75, w: 0.32 },
    foot: { len: 0.62, w: 0.32 },
    heel: { w: 0.28, h: 0.2, d: 0.14, capD: 0.14 },
  },
  joints: {
    hinge1: { ...JOINT_DEFAULTS.hinge, baseH: 0.16, solid: 0, discF: 0, discM: 0 },
    hinge2: { ...JOINT_DEFAULTS.hinge, baseH: 0.16, solid: 0, discF: 0, discMid: 0, discM: 0 },
    pivot1: { ...JOINT_DEFAULTS.pivot },
    prismatic1: { ...JOINT_DEFAULTS.prismatic },
    ball1: { ...JOINT_DEFAULTS.ball, disc: 0 },
  },
};

// ---- derived joint dimensions ------------------------------------------------
// ONE dims function per joint kind, consumed by BOTH the block builder and
// jointMounts, so a mount can never drift from the geometry it seats on.

const PIN_OUT_MIN = 0.005;   // smallest pin overhang past the female arm faces

function hingeDims(p) {
  const q = { ...JOINT_DEFAULTS.hinge, ...p };
  const clr = q.clr;                              // female-arm to male-arm slack, per side
  const bridgeT = q.baseH || Math.max(0.12, q.armT * 1.3);   // p.baseH overrides the derived bridge height
  const tip = Math.min(0.2, q.armH * 0.4);        // square arm reach past the pin
  const bodyLen = Math.max(0.05, q.armH - tip);   // pin -> arm end (where the base seats)
  const gapW = q.gap + 2 * q.armT + 2 * clr;
  return {
    ...q, clr, bridgeT, tip, bodyLen, gapW,
    knuckleR: q.depth / 2,
    bridgeY: bodyLen + bridgeT,                   // bridge outer face distance from the pin
    // pin half-length: the female arms' outer face, plus the pinOut overhang.
    // clamped to PIN_OUT_MIN so the pin's end cap never lands coplanar with
    // the arm face (z-fighting) even when the joint asks for a flush pin.
    pinHalf: gapW / 2 + q.armT + Math.max(PIN_OUT_MIN, q.pinOut ?? 0),
  };
}

function ballDims(p) {
  const q = { ...JOINT_DEFAULTS.ball, ...p };
  return {
    ...q,
    drop: q.ballR * 0.55,                         // socket base plane below the ball center
    top: q.ballR + q.shaftLen,                    // ball center -> male plate underside
  };
}

function pivotDims(p) {
  const q = { ...JOINT_DEFAULTS.pivot, ...p };
  return { ...q, flangeT: 0.1, capT: 0.1 };
}

function prismaticDims(p) {
  const q = { ...JOINT_DEFAULTS.prismatic, ...p };
  const halfL = q.coverLen / 2;
  const engage = q.coverLen * 0.25;   // shaft length that must stay in the cover
  // at slide 0 a shaft's inner end sits on the cover's mid-plane, so the two
  // shafts never collide; sliding out is capped by the engagement reserve
  return { ...q, halfL, engage, travel: Math.max(0, halfL - engage) };
}

// rounded arm: a D-plate (half-cylinder knuckle + box body) with its knuckle
// circle centered on the local origin, plate thickness along X, body running
// -Y (down=false mirrors it: knuckle down, body up). xc = plate center on X.
function roundedArm(knuckleR, bodyLen, thickness, xc, down = false) {
  const g = halfCylinderBox(knuckleR, thickness, bodyLen, 16);
  rotX(g, -HPI);          // axis -> -Z, knuckle bulge -> +Y, body -> -Y
  rotY(g, HPI);           // axis (thickness) -> -X
  if (down) rotZ(g, Math.PI);
  const off = down ? -thickness / 2 : thickness / 2;
  return translate(g, xc + off, 0, 0);
}

// rounded U: two D-plate arms (knuckles on the pin axis) + a bridge base.
// solid = I shape: one full-width D-plate tongue instead of the two arms.
// d.disc swaps the box base for a Y-axis cylinder circumscribing the box
// footprint, so the arm plates never poke past the disc rim. d.noBase emits
// the arms alone — for a half that SHARES the neighbouring half's base
// (hinge2's middle plate).
function roundedU(add, d, gap, up, solid = false) {
  const s = up ? 1 : -1;
  const bodyLen = d.bodyLen;
  const w = gap + 2 * d.armT;
  if (solid) {
    add(roundedArm(d.knuckleR, bodyLen, w, 0, !up));
  } else {
    const armX = gap / 2 + d.armT / 2;
    add(roundedArm(d.knuckleR, bodyLen, d.armT, -armX, !up));
    add(roundedArm(d.knuckleR, bodyLen, d.armT, armX, !up));
  }
  if (d.noBase) return;
  // arms' bodies run away from the knuckle: base sits opposite the opening,
  // centered on yc. box is center-anchored, cylinder base-anchored — shift it.
  const yc = -s * (bodyLen + d.bridgeT / 2);
  if (d.disc) add(translate(cylinder(Math.hypot(w, d.depth) / 2, d.bridgeT, 24), 0, yc - d.bridgeT / 2, 0));
  else add(translate(box(w, d.bridgeT, d.depth), 0, yc, 0));
}

// ---- JOINT BLOCKS — joints are building blocks with the same standing as the
// primitives: parts compose these instead of hand-rolling arms and pins, so any
// improvement to a mechanism here upgrades every part that uses it.

// RUNTIME joint rotations (degrees in the UI) — a separate axis set per joint,
// distinct from the modeling params above. deg -> rad happens in the catalog
// builders; the blocks themselves take radians. prismatic1 is the one joint
// whose DOFs are LINEAR: its pose is a travel distance in model units, so it
// skips the degree conversion.
export const JOINT_POSE = {
  hinge1: { swing: 0 },
  hinge2: { rx: 0, rz: 0 },
  pivot1: { spinA: 0, spinB: 0 },
  prismatic1: { slideA: 0, slideB: 0 },
  ball1: { rx: 0, ry: 0, rz: 0 },
};

// MOUNT SLOTS — a joint declares where consumers attach to it: 2 slots,
// each { pos, n, f } (origin + outward normal + forward tangent, f ⊥ n, so a
// slot forms a full coordinate system) in the joint's LOCAL frame, before any
// consumer transform. Slot `a` rides the fixed/female half, slot
// `b` rides the moving/male half. Parts and the dragon rig snap geometry to
// these instead of re-deriving offsets, so a joint redesign moves every
// consumer automatically. Only the joints parts actually chain through
// declare mounts: "ball" and "hinge1".
function jointMounts(kind, p = {}) {
  if (kind === "ball") {
    const d = ballDims(p);
    return {
      a: { pos: [0, -(d.drop + d.baseT), 0], n: [0, -1, 0], f: [0, 0, 1] },  // socket base underside
      b: { pos: [0, d.top + d.baseT, 0], n: [0, 1, 0], f: [0, 0, 1] },       // male plate top
    };
  }
  const d = hingeDims(p);                                                    // kind === "hinge1" (L-seated)
  return {
    a: { pos: [d.bridgeY, 0, 0], n: [1, 0, 0], f: [0, 1, 0] },   // mount-1 female disc face, f = pin axis
    b: { pos: [0, 0, d.bridgeY], n: [0, 0, 1], f: [0, 1, 0] },   // mount-2 male disc face (rest swing), f = pin axis
  };
}

// HINGE BLOCK — pin shaft = X axis through the local origin. The female (wide,
// opening down) U and the shared pin emit through the `fixed` channel; the male
// (narrow, opening up) U emits through `moving`, authored around the same
// origin. `sides.female` / `sides.male` override dims for one half only
// (e.g. shorter male arms) without touching the mechanism. p.solid (or
// sides.male.solid) makes the male an I-shaped solid tongue instead of a U.
// RUNTIME pose (radians, separate from the modeling params): pose.swing
// rotates the male half about the pin. A consumer with extra geometry riding
// the male half can instead keep articulating the whole `moving` channel.
// ---- joint sub-assembly tagging ---------------------------------------------
// Every joint block brackets its primitive emissions so a consumer (e.g. an
// assembly animation) can group primitives by their owning joint. Nested
// blocks stack (hinge2Block/hinge1Block call hingeBlock); primitives emitted outside any
// block belong to the part body (null).
let _jseq = 0;
const _jstack = [];
const jbegin = () => _jstack.push(`j${++_jseq}`);
const jend = () => _jstack.pop();
export const currentJointGroup = () => _jstack[_jstack.length - 1] ?? null;
export const resetJointGroups = () => { _jseq = 0; };

function hingeBlock(fixed, moving, p = {}, sides = {}, pose = {}) {
  jbegin();
  const dF = hingeDims({ ...p, ...(sides.female || {}) });
  const dM = hingeDims({ ...p, ...(sides.male || {}) });
  const mv = pose.swing ? (g) => moving(rotX(g, pose.swing)) : moving;
  roundedU(fixed, dF, dF.gapW, false);          // female U
  roundedU(mv, dM, dM.gap, true, !!dM.solid);   // male: nested U, or solid I tongue
  // pin = bare shaft (no end caps); pinOut sets how far it pokes past the
  // female outer faces (0 = as near flush as PIN_OUT_MIN allows)
  const halfSpan = dF.pinHalf;
  fixed(translate(rotZ(cylinder(dF.pinR, 2 * halfSpan, 20), -HPI), -halfSpan, 0, 0));
  jend();
}

// HINGE2 BLOCK — literally TWO hinge1 stages in SERIES sharing ONE base:
// stage A pin = X at the origin, stage B directly below with its pin turned
// to Z, so the output end rotates about X AND Z — a 2-axis universal-style
// joint (the atlas wrist). Stage A's male emits NO base; stage B's female
// base is the single MIDDLE plate both stages bolt to. Every hinge1 setting
// carries over: baseH (all bases), solid (both males), discF / discMid /
// discM pick box or disc per base, top to bottom.
// RUNTIME pose (radians): pose.rx swings stage A about the X pin — the whole
// stage B rides that swing — and pose.rz swings the stage-B male about the
// Z pin. fixed = stage-A female U + pin; everything else emits via `moving`.
function hinge2Block(fixed, moving, p = {}, pose = {}) {
  jbegin();
  const d = hingeDims(p);
  const rx = pose.rx || 0, rz = pose.rz || 0;
  const mid = rx ? (g) => moving(rotX(g, rx)) : moving;   // rides the stage-A swing
  const male = { solid: p.solid };
  hingeBlock(fixed, mid, p, { female: { disc: p.discF }, male: { ...male, noBase: 1 } });
  // stage-B pin: its female arms end exactly where stage A's male arms do, so
  // the one middle base (stage B's) spans the joint
  const y = -(2 * d.bodyLen + d.bridgeT);
  // rotY(HPI) turns the authored X pin onto Z; the male pre-swings about its
  // own (pre-turn) pin, -rz so a positive pose reads as +Z rotation
  hingeBlock(
    (g) => mid(translate(rotY(g, HPI), 0, y, 0)),
    (g) => mid(translate(rotY(rotX(g, -rz), HPI), 0, y, 0)),
    p,
    { female: { disc: p.discMid }, male: { ...male, disc: p.discM } },
  );
  jend();
}

// BALL BLOCK — ball-and-socket, ball center = local origin. Female (fixed) =
// a cut-hemisphere socket cupping the ball, standing on a thin box base; male
// (moving) = the sphere with a shaft growing up out of the socket opening to
// its own thin box base. A consumer articulates by rotating everything routed
// through `moving` about the origin — any axis, that's the point of the ball.
// RUNTIME pose (radians): pose.rx/ry/rz — one full xyz rotation of the male
// half about the ball center.
function ballBlock(fixed, moving, p = {}, pose = {}) {
  jbegin();
  const q = ballDims(p);
  const mv = (g) => {
    let h = g;
    if (pose.rx) h = rotX(h, pose.rx);
    if (pose.ry) h = rotY(h, pose.ry);
    if (pose.rz) h = rotZ(h, pose.rz);
    moving(h);
  };
  const rOut = q.ballR + 0.02 + q.socketT;         // socket outer radius (ball + clearance + wall)
  // base plates: square boxes by default; p.base = "disc" (parts) or the
  // p.disc flag (catalog UI) swaps in cylinders
  const basePlate = (w) => q.base === "disc" || q.disc ? cylinder(w / 2, q.baseT, 24) : box(w, q.baseT, w);
  fixed(translate(basePlate(q.baseW), 0, -q.drop - q.baseT / 2, 0));
  // cutHemisphere wall + cut are fractions of r
  fixed(translate(cutHemisphere(rOut, q.socketT / rOut, q.cut, 28, 8), 0, -q.drop, 0));
  mv(sphere(q.ballR, 20, 14));
  mv(cylinder(q.shaftR, q.top, 18));
  mv(translate(basePlate(q.baseW * 0.75), 0, q.top + q.baseT / 2, 0));
  jend();
}

// HINGE1 BLOCK — the generic mount-to-mount hinge: solid male + disc bases
// on both halves, re-oriented and rest-swung 90° into an L so parts can
// chain through it anywhere a hinge is needed (dragon shoulders/hips, atlas
// shoulder/hip today) — mount 1 (female disc) faces +X into the parent
// flank, the pin runs along Y, mount 2 (male disc) exits +Z into the child
// (see jointMounts "hinge1").
// RUNTIME pose (radians), 3 rotations: pose.swing about the pin (Y),
// pose.spinF spins the whole joint about the mount-1 disc axis (X) — the
// female is the PARENT, so spinF carries the male chain with it — and
// pose.spinM is the mount-2 turntable (Z): the male disc is a body of
// revolution, so the spin only shows through the consumer's limb chain.
function hinge1Block(fixed, moving, p = {}, pose = {}) {
  // hinge local -> mount frame: female base +Y -> +X, pin X -> Y
  const R = (g) => rotY(rotZ(g, HPI), Math.PI);
  const sf = pose.spinF || 0;
  const fx = (g) => { const h = R(g); fixed(sf ? rotX(h, sf) : h); };
  const mv = (g) => { const h = R(g); moving(sf ? rotX(h, sf) : h); };
  // rest swing 90°: the male disc exits perpendicular to the female mount
  hingeBlock(fx, mv, p, { female: { disc: 1 }, male: { disc: 1, solid: 1 } },
    { swing: HPI + (pose.swing || 0) });
}

// PIVOT BLOCK — spin axis = Y through the local origin: symmetric barrel with
// a flange ring, neck and end cap on both ends.
// RUNTIME pose (radians): pose.spinA / pose.spinB spin the top / bottom end
// stacks about the Y axis — 2 rotations. (The stacks are bodies of
// revolution, so the spin only shows once geometry hangs off an end.)
function pivotBlock(add, p = {}, pose = {}) {
  jbegin();
  const q = pivotDims(p);
  const hb = q.barrelLen / 2;
  add(translate(cylinder(q.barrelR, q.barrelLen, 28), 0, -hb, 0));  // barrel
  for (const s of [1, -1]) {
    const spin = s > 0 ? pose.spinA : pose.spinB;
    // mirrored stack: spin about Y, flip the piece for the bottom end, seat at s*y
    const at = (g, y) => add(translate(rotX(spin ? rotY(g, spin) : g, s > 0 ? 0 : Math.PI), 0, s * y, 0));
    at(cylinder(q.flangeR, q.flangeT, 28), hb);                      // flange disc
    at(cylinder(q.neckR, q.neckLen, 20), hb + q.flangeT);            // neck
    at(cylinder(q.capR, q.capT, 24), hb + q.flangeT + q.neckLen);    // end cap
  }
  jend();
}

// PRISMATIC BLOCK — the one LINEAR joint: 3 boxes. A cover box centered on the
// origin, slide axis = Y, and two square mounting shafts running out of its
// ends (+Y = shaft A, -Y = shaft B), each carrying a part. At slide 0 a
// shaft's inner end rests on the cover's mid-plane, so the two never collide;
// sliding out is capped by `travel` so a shaft can't leave the cover.
// fixed = cover + shaft A, moving = shaft B — a consumer holds the cover with
// the parent and lets the child ride the moving channel.
// RUNTIME pose (MODEL UNITS, not radians): pose.slideA / pose.slideB extend
// each shaft out of its end of the cover.
function prismaticBlock(fixed, moving, p = {}, pose = {}) {
  jbegin();
  const q = prismaticDims(p);
  const clamp = (v) => Math.max(0, Math.min(v || 0, q.travel));
  // shaft: inner end on the mid-plane at slide 0, growing out along s
  const shaft = (add, s, slide) =>
    add(translate(box(q.shaftW, q.shaftLen, q.shaftW), 0, s * (clamp(slide) + q.shaftLen / 2), 0));
  fixed(box(q.coverW, q.coverLen, q.coverD));   // cover sleeve
  shaft(fixed, 1, pose.slideA);
  shaft(moving, -1, pose.slideB);
  jend();
}

// ---- the parts ----------------------------------------------------------------

// fixed joint proportions the dragon parts are modeled around — shared with
// chainSpec() below so the rig computes the same mounting numbers the
// builders bake into the geometry.
const SEG_JP = { ballR: 0.26, socketT: 0.09, shaftLen: 0.14, baseT: 0.12, base: "disc" };
const SEG2_JP = { ballR: 0.24, socketT: 0.08, shaftLen: 0.13, baseT: 0.12, base: "disc" };
const TAIL_JP = { ballR: 0.24, socketT: 0.08, shaftLen: 0.13, baseT: 0.12, base: "disc" };
const ARM_JP = { gap: 0.1, armT: 0.055, armH: 0.34, depth: 0.22, pinR: 0.045 };
const LEG_JP = { gap: 0.12, armT: 0.065, armH: 0.38, depth: 0.26, pinR: 0.055 };

// head modeling anchors, shared by the builder, partSlots and (via the jaw
// slot) the rig — the single source for where things mate on the head
const HEAD_NECK = [0, 0.55, -1.0];      // where the mating neck ball CENTER sits, behind the skull
const HEAD_JAW_PIN = [0, 0.02, -0.12];  // jaw hinge pin (X axis) below the skull

// ---- per-part layout ---------------------------------------------------------
// The numbers a part builder bakes into its geometry, computed ONCE per part
// kind and consumed by BOTH the builder and partSlots — slots can never drift
// from the meshes. Chain parts seat a ball joint: z0 = where the body starts
// (clear of the socket base plate), reach = ball center -> male plate top,
// front = the male ball center. Limbs seat an L-seated hinge1 shoulder/hip: the pivot
// height stacks the limb segments plus the joint's mount-2 drop.

function bodySegmentLayout(p) {
  const jp = { ...SEG_JP, baseW: p.bodyR * 1.5 };
  const jm = jointMounts("ball", jp);
  const z0 = -jm.a.pos[1] + 0.04;
  const plankT = 0.1;                              // side plank thickness (flank slot face)
  return {
    jp, jm, cy: p.bodyR, z0, plankT,
    reach: jm.b.pos[1],
    front: z0 + p.segLen + jm.b.pos[1],
    flankX: p.bodyR + plankT,
  };
}

function bodySegment2Layout(p) {
  const jp = { ...SEG2_JP, baseW: p.rRear * 1.6 };
  const jm = jointMounts("ball", jp);
  const z0 = -jm.a.pos[1] + 0.04;
  return { jp, jm, cy: p.rFront, z0, reach: jm.b.pos[1], front: z0 + p.segLen + jm.b.pos[1] };
}

function tailLayout(p) {
  const jp = { ...TAIL_JP, baseW: p.bodyR * 1.4 };
  const jm = jointMounts("ball", jp);
  return { jp, cy: p.bodyR, reach: jm.b.pos[1], front: p.coreLen + jm.b.pos[1] };
}

function armLayout(p) {
  const jm = jointMounts("hinge1", ARM_JP);
  const ey = 0.4 + p.foreLen + 0.48 + p.clawR;     // elbow pin height (palm + fingers stacked under the wrist)
  const sdrop = jm.b.pos[2];                       // mount-2 cap face below the pivot
  return { jp: ARM_JP, jm, ey, sdrop, sy: ey + p.upperLen + sdrop };  // sy = shoulder pin height
}

function legLayout(p) {
  const jm = jointMounts("hinge1", LEG_JP);
  const ky = 0.5 + p.shinLen;                      // knee pin height
  const hdrop = jm.b.pos[2];
  return { jp: LEG_JP, jm, ky, hdrop, hy: ky + p.thighLen + hdrop };  // hy = hip pin height
}

// DRAGON HEAD — boxes only for the skull (the engine has no boolean cut, so the
// EYE HOLES are real gaps: a roof box, a floor box and a narrow core box leave
// an open rectangular window on each side of the mid-section; the eyeball sits
// on the core inside the window). Slope-top boxes shape the brow and snout.
// +Z = forward (snout), Y up. Jaw + teeth rotate open about the rear hinge.
// RUNTIME pose: pose.jaw overrides the jawOpen modeling param
// (degrees, UI slider) so a rig can drive the mouth without touching the
// modeled shape.
function head(add, p, pose = {}) {
  const W = p.headW;
  // cranium: rear skull block, y 0.2..0.9
  add(translate(box(W, 0.7, 1.0), 0, 0.55, -0.4));
  // mid-section z 0.1..0.5 — the eye window lives here
  add(translate(box(W, 0.18, 0.4), 0, 0.81, 0.3));            // roof strip
  add(translate(box(W, 0.18, 0.4), 0, 0.29, 0.3));            // floor strip
  add(translate(box(W * 0.42, 0.34, 0.4), 0, 0.55, 0.3));     // core between the eyes
  // eyes in the window holes: a camera-lens stack along the outward X axis —
  // eyeball, iris ring proud of the ball's surface, pupil boss poking past
  // the front pole
  for (const s of [1, -1]) {
    const R = p.eyeR, xc = s * (W * 0.21 + R * 0.55);
    const lens = (g, off) => add(translate(rotZ(g, s * -HPI), xc + s * off, 0.55, 0.3));
    add(translate(sphere(R, 16, 10), xc, 0.55, 0.3));
    lens(cylinder(R * 0.8, 0.08, 14), R * 0.8);     // iris ring
    lens(cylinder(R * 0.45, 0.07, 12), R * 1.02);   // pupil boss
  }
  // brow: slope box over the window, dropping toward the snout
  add(translate(box(W, 0.26, 0.5, 0.62), 0, 1.03, 0.15));
  // per-eye brow ridges: small slope blocks jutting past the brow's front
  // edge, hooding each eye window
  for (const s of [1, -1])
    add(translate(box(W * 0.3, 0.13, 0.3, 0.55), s * W * 0.32, 0.95, 0.48));
  // snout: slope-top box, nose end lower
  add(translate(box(W * 0.65, 0.5, p.snoutLen, 0.44), 0, 0.62, 0.5 + p.snoutLen / 2));
  // nasal crest: thin slope ridge riding the snout centerline
  add(translate(box(0.12, 0.16, p.snoutLen * 0.65, 0.5), 0, 0.86, 0.5 + p.snoutLen * 0.38));
  // nose tip: small steep slope block
  add(translate(box(W * 0.45, 0.24, 0.18, 0.5), 0, 0.49, 0.5 + p.snoutLen + 0.09));
  // nostrils: short bosses buried in the nose tip, barely proud of its face
  for (const s of [1, -1])
    add(translate(rotX(cylinder(0.06, 0.08, 10), HPI), s * W * 0.12, 0.5, 0.5 + p.snoutLen + 0.12));
  // upper fangs: two per side hanging from the snout underside, the rear one
  // shorter
  for (const s of [1, -1])
    for (const [i, h] of [0.18, 0.12].entries())
      add(translate(box(0.08, h, 0.08), s * W * 0.22, 0.37 - h / 2, 0.5 + p.snoutLen - 0.1 - i * 0.35));
  // cheek armor: slope plate on each skull flank with three vent slats
  for (const s of [1, -1]) {
    add(translate(box(0.12, 0.52, 0.78, 0.55), s * (W / 2 + 0.06), 0.5, -0.38));
    for (const y of [0.36, 0.5])
      add(translate(box(0.05, 0.07, 0.44), s * (W / 2 + 0.13), y, -0.42));
  }

  // JAW HINGE — a real hinge-style joint drives the jaw. Pin axis = X through
  // HEAD_JAW_PIN (below the skull so the knuckles read); every jaw-side piece
  // is authored with the pivot at its local origin and rotated about that
  // exact shaft axis before seating on the pin.
  const [, hy, hz] = HEAD_JAW_PIN;
  const jawRot = pose.jaw ?? rad(p.jawOpen);
  const jawLen = p.snoutLen + 0.45;
  const jw = W * 0.55;                    // jaw plate width
  const armT = 0.1;
  const atPin = (g) => translate(g, 0, hy, hz);           // skull side: just seat
  const jawAt = (g) => translate(rotX(g, jawRot), 0, hy, hz); // jaw side: swing first
  // one hingeBlock drives the jaw: female half + pin fixed to the skull,
  // male half routed through jawAt so it swings with the jaw about the shaft.
  hingeBlock(
    (g) => add(atPin(g)),
    (g) => add(jawAt(g)),
    { gap: jw - 0.26, armT, pinR: 0.09 },
    { female: { armH: 0.5, depth: 0.36 }, male: { armH: 0.3, depth: 0.3 } },
  );
  // jaw plate + teeth hang off the male bridge; all share the same swing
  add(jawAt(translate(box(jw, 0.18, jawLen), 0, -0.21, jawLen / 2 - 0.15)));
  for (const x of [-W * 0.18, 0, W * 0.18])
    add(jawAt(translate(box(0.07, 0.14, 0.07), x, -0.05, jawLen - 0.4)));
  // mandible plates: thin slope walls along the jaw plate sides
  for (const s of [1, -1])
    add(jawAt(translate(box(0.08, 0.2, jawLen * 0.6, 0.5), s * (jw / 2 + 0.04), -0.18, jawLen * 0.4)));

  // antlers: a root block seated flat on the roof, then a stepped run of
  // axis-aligned boxes hanging off its outer side face, extending BACK along
  // -Z and up (full-wedge tip turned 180deg so the point aims -Z).
  for (const s of [1, -1]) {
    const L = p.hornLen;
    const x = s * W * 0.32;
    add(translate(box(0.3, 0.3, 0.36), x, 1.05, -0.64));                     // root block on the roof
    // stepped antler bolted onto the root block's OUTER SIDE face: the whole
    // axis-aligned run lives on that side plane, every joint a flush overlap
    const ax = x + s * 0.21;                                                  // side plane, 0.04 into the root
    const L1 = L * 0.6, L2 = L * 0.45;
    add(translate(box(0.2, 0.24, L1), ax, 1.05, -0.55 - L1 / 2));            // lower shaft, front end inside the root
    const kz = -0.55 - L1;                                                    // step point
    add(translate(box(0.24, 0.36, 0.28), ax, 1.17, kz + 0.05));               // riser, straddles the shaft end
    add(translate(box(0.18, 0.2, L2), ax, 1.25, kz + 0.05 - L2 / 2));        // upper shaft, rear end inside the riser
    add(translate(rotY(box(0.18, 0.2, 0.5, 0.96), Math.PI), ax, 1.25, kz - L2 - 0.13)); // wedge tip, base overlapping the shaft
  }
  // crest fin: D-plate on the skull roof, round side up, body sunk into the box
  {
    const g = halfCylinderBox(0.32, 0.09, 0.35, 16);
    rotX(g, -HPI); rotY(g, HPI);
    add(translate(g, 0.045, 0.92, -0.5));
  }
  // neck mount: box + cylinder boss pointing out the back (-Z); the mating
  // ball center (the neck slot) sits 0.1 behind the boss seat
  add(translate(rotX(boxCylinder(0.5, 0.16, 0.5, 1.75, "in", 20), -HPI), HEAD_NECK[0], HEAD_NECK[1], HEAD_NECK[2] + 0.1));
}

// chain-part ball joint seating, shared by the body segments and the tail:
// female socket at the rear (ball center = part origin, opening -Z so the
// previous segment's shaft exits backward), male ball sticking out past the
// front face. female = false emits the male half only (the mating segment
// supplies the socket).
function chainBall(add, jp, cy, front, female = true) {
  ballBlock(
    female ? (g) => add(translate(rotX(g, -HPI), 0, cy, 0)) : () => {},  // female socket, rear
    (g) => add(translate(rotX(g, -HPI), 0, cy, front)),                  // male ball, front
    jp,
  );
}

// spine fin: QUARTER disc standing on the back at height y — arc rising from
// the front like a lego curved slope, vertical trailing edge at the rear
function spineFin(add, finR, y, z) {
  add(translate(rotZ(quarterCylinder(finR, 0.12, 14), HPI), 0.06, y - 0.05, z));
}

// DRAGON BODY SEGMENT — same construction as the Blender kit piece: solid
// half-cylinder upper back, belly = stacked half-cylinder discs with small
// gaps, D-plate spine fins, side planks. Segments CHAIN through the BALL
// block: female socket at the rear (ball center = part origin, opening -Z so
// the previous segment's shaft exits backward), male ball sticking out past
// the front face, so copies daisy-chain male->female and the chain bends in
// any direction like a spine.
function bodySegment(add, p) {
  const R = p.bodyR, len = p.segLen;
  const { jp, cy, z0, front, plankT } = bodySegmentLayout(p);
  chainBall(add, jp, cy, front);
  // upper back: one solid half cylinder, dome up, spanning the segment
  add(translate(rotX(halfCylinder(R, len, 20), -HPI), 0, cy, z0 + len));
  // belly: stacked discs, dome down, small gaps between them
  const n = Math.max(1, Math.round(p.discs));
  const pitch = len / n, t = pitch - 0.07;
  for (let i = 0; i < n; i++)
    add(translate(rotX(halfCylinder(R * 0.94, t, 16), HPI), 0, cy, z0 + i * pitch + 0.035));
  // side planks slapped on both flanks
  for (const s of [1, -1])
    add(translate(box(plankT, R * 0.95, len * 0.86), s * (R + plankT / 2), cy, z0 + len / 2));
  // spine fins riding the back radius
  for (const f of [0.3, 0.7]) spineFin(add, p.finR, cy + R, z0 + f * len);
}

// DRAGON BODY SEGMENT TYPE 2 — tapered variant: the core is a CUT CONE lying
// along the spine (wide at the front, narrow at the rear), so a chain of them
// forms a shrinking neck or tail run. Same joint scheme as type 1: female
// ball socket at the rear origin, male ball sticking past the front face.
function bodySegment2(add, p) {
  const len = p.segLen, R0 = p.rRear, R1 = p.rFront;
  const { jp, cy, z0, front } = bodySegment2Layout(p);
  chainBall(add, jp, cy, front);
  // core: cut cone along the spine — narrow base at the rear, wide top front
  add(translate(rotX(coneCut(R0, R1, len, 24), HPI), 0, cy, z0));
  // spine fins riding the local cone radius
  for (const f of [0.3, 0.7]) spineFin(add, p.finR, cy + R0 + (R1 - R0) * f, z0 + f * len);
}

// DRAGON ARM — parts chained by joint blocks. At the top the hinge1 block as
// the shoulder: disc base up into the body, pin horizontal, tongue pre-swung
// about the pin so its disc base drops into the upper arm.
// Elbow = hinge block driving the forearm (elbowBend swings it about the
// pin), then wrist barrel and a claw of three quarter-disc talons.
// RUNTIME pose: pose.swing / pose.spinF / pose.spinM drive the
// shoulder hinge1 — the whole limb hangs off mount 2, so it rides the same
// rotation chain as the joint's own moving half (one bone per rotation, every
// primitive follows exactly one bone) — and pose.elbow overrides elbowBend
// (degrees, UI slider).
function arm(add, p, pose = {}) {
  const bend = pose.elbow ?? rad(p.elbowBend);
  const sw = pose.swing || 0, sf = pose.spinF || 0, sm = pose.spinM || 0;
  // shoulder joint, deliberately small next to the limb boxes
  const { jp, ey, sdrop, sy } = armLayout(p);
  // whole joint rotX(HPI): pin -> Z, female base faces +X so mount 1 (disc) points
  // RIGHT into the body flank, mount 2 (male disc base) lands on the limb top
  const seat = (g) => add(translate(rotX(g, HPI), 0, sy, 0));
  // limb channel: everything below the shoulder is authored RELATIVE TO THE
  // SHOULDER PIVOT and follows the joint's full moving chain — spinM (disc-base
  // turntable) -> swing (pin) -> spinF (parent disc) composed in the joint's
  // local frame, then seated exactly like the joint itself
  const limb = (g) => {
    let h = rotX(g, -HPI);            // part frame -> joint local
    if (sm) h = rotZ(h, sm);
    if (sw) h = rotY(h, sw);
    if (sf) h = rotX(h, sf);
    seat(h);
  };
  hinge1Block(seat, seat, jp, { swing: sw, spinF: sf, spinM: sm });
  limb(translate(box(0.38, p.upperLen, 0.42), 0, -sdrop - p.upperLen / 2, 0));  // upper arm
  // upper-arm armor: slope plate riding the front face
  limb(translate(box(0.32, p.upperLen * 0.6, 0.08, 0.5), 0, -sdrop - p.upperLen * 0.4, 0.24));
  // elbow: female + pin fixed to the upper arm, male swings with the forearm
  const rey = ey - sy;                                              // elbow, shoulder-relative
  const at = (g) => limb(translate(g, 0, rey, 0));
  const swing = (g) => limb(translate(rotX(g, -bend), 0, rey, 0));  // bend forward
  hingeBlock(at, swing, { gap: 0.14, armT: 0.07, armH: 0.3, depth: 0.28, pinR: 0.06 });
  // forearm + wrist, authored around the elbow pin, routed through the swing
  swing(translate(box(0.3, p.foreLen, 0.34), 0, -(0.3 + p.foreLen / 2), 0));
  // forearm armor: slope plate on the front face
  swing(translate(box(0.24, p.foreLen * 0.65, 0.08, 0.5), 0, -(0.3 + p.foreLen * 0.45), 0.19));
  const wy = -(0.35 + p.foreLen);
  swing(translate(rotZ(cylinder(0.12, 0.36, 18), -HPI), -0.18, wy, 0));   // wrist barrel
  // palm: block hanging under the wrist barrel, its top burying the barrel
  const py = wy - 0.17;                                                    // palm center
  swing(translate(box(0.34, 0.24, 0.3), 0, py, 0.02));
  // claw: three segmented fingers off the palm underside. Distal digit +
  // quarter-disc talon blade CURL forward about a shared knuckle axis (X,
  // through every proximal digit's lower end) — same authoring scheme as the
  // jaw hinge, just with no visible pin.
  const CURL = 0.45;
  const jy = py - 0.26, jz = 0.06;                    // knuckle axis
  for (const fx of [-0.14, 0, 0.14]) {
    swing(translate(box(0.09, 0.16, 0.11), fx, py - 0.18, jz));               // proximal digit
    const dig = (g) => swing(translate(rotX(g, -CURL), fx, jy, jz));          // distal frame, swung about the pin
    dig(translate(box(0.08, 0.14, 0.1), 0, -0.07, 0));                        // distal digit, top face through the pin center
    // talon blade: corner anchored on the distal digit's rear-bottom corner,
    // straight edges flush with its back face and underside
    dig(translate(rotZ(quarterCylinder(p.clawR, 0.08, 10), -HPI), -0.04, -0.12, -0.05));
  }
  // thumb talon: smaller quarter-disc off the palm's inner side, opposing
  swing(translate(rotZ(quarterCylinder(p.clawR * 0.7, 0.08, 10), -HPI), 0.21, py - 0.08, -0.06));
}

// DRAGON LEG — same principle, chunkier: hinge1 block as the hip (disc base
// up into the body, disc base down into the thigh), hinge block knee
// driving the shin (kneeBend swings it back), ankle barrel, flat foot with
// quarter-disc toe claws.
// RUNTIME pose, same scheme as the arm: pose.swing/spinF/spinM
// drive the hip hinge1 (the limb rides the moving chain), pose.knee
// overrides kneeBend (degrees, UI slider).
function leg(add, p, pose = {}) {
  const bend = pose.knee ?? rad(p.kneeBend);
  const sw = pose.swing || 0, sf = pose.spinF || 0, sm = pose.spinM || 0;
  const { jp, ky, hdrop, hy } = legLayout(p);
  // same orientation as the arm's shoulder: mount 1 (disc) facing right into
  // the body flank, pin along Z, mount 2 (male disc base) onto the thigh top
  const seat = (g) => add(translate(rotX(g, HPI), 0, hy, 0));
  const limb = (g) => {
    let h = rotX(g, -HPI);            // part frame -> joint local (see arm)
    if (sm) h = rotZ(h, sm);
    if (sw) h = rotY(h, sw);
    if (sf) h = rotX(h, sf);
    seat(h);
  };
  hinge1Block(seat, seat, jp, { swing: sw, spinF: sf, spinM: sm });
  limb(translate(box(0.46, p.thighLen, 0.54), 0, -hdrop - p.thighLen / 2, 0));  // thigh
  const rky = ky - hy;                                             // knee, hip-relative
  const at = (g) => limb(translate(g, 0, rky, 0));
  const swing = (g) => limb(translate(rotX(g, bend), 0, rky, 0));  // knee bends back
  hingeBlock(at, swing, { gap: 0.16, armT: 0.075, armH: 0.32, depth: 0.3, pinR: 0.07 });
  swing(translate(box(0.34, p.shinLen, 0.4), 0, -(0.3 + p.shinLen / 2), 0));  // shin
  const ay = -(0.35 + p.shinLen);
  swing(translate(rotZ(cylinder(0.13, 0.4, 18), -HPI), -0.2, ay, 0));     // ankle barrel
  swing(translate(box(0.46, 0.2, p.footLen), 0, ay - 0.05, p.footLen / 2 - 0.12)); // foot
  // toe nails: quarter discs the right way up — flat base on the ground,
  // vertical rear edge against the foot, arc curving over the top to a
  // forward tip at ground level
  for (const x of [-0.18, -0.04, 0.1])
    swing(translate(rotZ(quarterCylinder(p.clawR, 0.08, 10), HPI), x + 0.08, ay - 0.15, p.footLen - 0.15));
}

// DRAGON TAIL — a stack of FULL discs shrinking toward the tip (no shell, no
// fins), a MALE ball at the front (+Z) to plug into a body segment's female
// socket, and a CONE spiking back from the smallest disc as the tail tip.
function tail(add, p) {
  const R = p.bodyR, len = p.coreLen;
  const { jp, cy, front } = tailLayout(p);
  // male half only — the mating body segment supplies the socket
  chainBall(add, jp, cy, front, false);
  // core: full discs on a straight center line, shrinking toward the tip end
  const n = Math.max(3, Math.round(len / 0.28));
  const pitch = len / n, t = pitch - 0.06;
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;                       // 0 = tip end, 1 = front
    add(translate(rotX(cylinder(R * (0.5 + 0.5 * f), t, 20), HPI), 0, cy, i * pitch + 0.03));
  }
  // tail tip: a cone spiking back (-Z), base matching the smallest disc
  add(translate(rotX(cone(R * 0.5, p.tipLen, 20), -HPI), 0, cy, 0.03));
}

// ---- ATLAS part kit ---------------------------------------------------------
// Humanoid parts, same discipline as the dragon kit: a part embeds the FIXED
// half of every joint it offers to children (female ball socket / hinge
// clevis + pin at its distal slots) and the MOVING half of the joint it plugs
// into its parent with (male ball / male hinge U at its mount slot). The two
// halves of one joint live in two parts but share a JP constant below, so
// they always align when the rig glues the slots; the rig bone at the match
// point supplies the rotation the mechanism absorbs.
//
// Local frame per part: mount slot = the local origin (ball center / pin
// axis), body hanging along -Y, +Z forward — except head and torso, whose
// bodies grow +Y out of their mount ball.

const ATLAS_JP = {
  // short neck: disc bases on BOTH halves (no box plate under the torso socket)
  neck: { ballR: 0.12, socketT: 0.06, shaftLen: 0.04, baseW: 0.34, baseT: 0.05, base: "disc" },
  // waist = pivot (Y spin only): the pelvis holds the barrel, the torso
  // brings the flange-disc/neck/cap top stack and twists on it
  waist: { barrelR: 0.2, barrelLen: 0.28, flangeR: 0.28, neckR: 0.11, neckLen: 0.1, capR: 0.22 },
  // every atlas hinge runs pinOut 0: the pin stops at the female arms instead
  // of poking out of the clevis (hingeDims still leaves it a hair proud)
  // shoulder / hip = hinge1 block (solid male + disc bases, like the
  // dragon limbs): the body part holds the female U + pin, the limb hangs
  // off the male tongue's disc base
  shoulder: { gap: 0.1, armT: 0.06, armH: 0.32, depth: 0.22, pinR: 0.05, pinOut: 0 },
  hip: { gap: 0.09, armT: 0.055, armH: 0.28, depth: 0.2, pinR: 0.045, pinOut: 0 },
  // arm joints run a SOLID male tongue on a tight clearance — the forearm
  // shroud covers them, so the mechanism should read as machined, not loose.
  // wrist = hinge2 (two hinge1 stages in series, pins X then Z); the same
  // params size BOTH stages across forearm / wrist / palm
  wrist: { gap: 0.1, armT: 0.05, armH: 0.18, depth: 0.2, pinR: 0.04, clr: 0.008, solid: 1, pinOut: 0 },
  // elbow gap is sized so the solid tongue — and the forearm box that
  // continues it — is exactly the forearm's width (parts.atlas.forearm.w)
  elbow: { gap: 0.14, armT: 0.06, armH: 0.26, depth: 0.24, pinR: 0.05, clr: 0.008, solid: 1, pinOut: 0 },
  knee: { gap: 0.15, armT: 0.07, armH: 0.3, depth: 0.3, pinR: 0.06, solid: 1, pinOut: 0 },
  ankle: { gap: 0.14, armT: 0.065, armH: 0.26, depth: 0.26, pinR: 0.055, solid: 1, pinOut: 0 },
};

// ball stack extents off ballDims — the single numbers layouts stack with:
// ballTop = ball center -> male plate outer face, ballSeat = ball center ->
// socket base outer face
const ballTop = (jp) => ballDims(jp).top + jp.baseT;
const ballSeat = (jp) => ballDims(jp).drop + jp.baseT;
const hingeReach = (jp) => hingeDims(jp).bridgeY;   // pin -> bridge outer face

// female ball socket seated at `pos`; `orient` re-aims the opening (default
// opens +Y, the child sits above)
function socketAt(add, jp, pos, orient = null) {
  ballBlock((g) => add(translate(orient ? orient(g) : g, pos[0], pos[1], pos[2])),
    () => {}, jp);
}
// male ball half at the part origin; dir = -1 runs the shaft down into the
// part's own body (parts hanging below their parent), +1 runs it up
function maleBall(add, jp, dir = -1) {
  ballBlock(() => {}, (g) => add(dir < 0 ? rotX(g, Math.PI) : g), jp);
}
// hinge halves for chained parts: the parent emits clevis + pin at its distal
// slot, the child emits the nested male U at its mount origin. `sides` passes
// through (the wrist's stage-A male drops its base — see wrist()).
const hingeFixedAt = (add, jp, y, sides = {}) =>
  hingeBlock((g) => add(translate(g, 0, y, 0)), () => {}, jp, sides);
const hingeMale = (add, jp, sides = {}) => hingeBlock(() => {}, add, jp, sides);

// HINGE SHROUD — a hollow box (4 planks, open top and bottom) housing a
// clevis: two planks outside the female arms on the pin axis, two clearing
// the arms' depth. It runs from `top` down to the PIN PLANE and no further:
// the male half hangs below its pin and only its knuckle disc (radius
// knuckleR, a body of revolution) reaches above it, so the hinge keeps its
// full swing however far the joint bends.
function hingeShroud(add, jp, pinY, top, t = 0.035) {
  const d = hingeDims(jp);
  const x = d.gapW / 2 + d.armT + d.clr + t / 2;   // outside the female arms
  const z = d.knuckleR + d.clr + t / 2;            // outside the knuckle sweep
  const h = top - pinY, cy = pinY + h / 2;
  for (const s of [1, -1]) {
    add(translate(box(t, h, 2 * z + t), s * x, cy, 0));       // pin-axis end planks
    add(translate(box(2 * x + t, h, t), 0, cy, s * z));       // front / back planks
  }
}

// ---- atlas per-part layouts (builder + partSlots single source) ----------

function torsoLayout(p) {
  const q = pivotDims(ATLAS_JP.waist);
  const y0 = q.flangeT + q.neckLen + q.capT;          // waist pivot top-stack height
  const taperH = 0.24;
  const chestY = y0 + taperH - 0.04;                  // chest slab base
  const top = chestY + p.chestH;
  return {
    y0, taperH, chestY, top,
    r: p.chestD / 2,                                  // flank half-cylinder radius = half the chest depth
    neckY: top + ballSeat(ATLAS_JP.neck),             // neck ball center
    // shoulder pins: the female disc base lands on the chest flank
    sx: p.chestW / 2 + jointMounts("hinge1", ATLAS_JP.shoulder).a.pos[0],
    sy: top - 0.16,
  };
}

function pelvisLayout(p) {
  const q = pivotDims(ATLAS_JP.waist);
  const discT = 0.14, domeW = p.hipW * 0.6;
  const discY = -q.barrelLen - discT;                 // disc bottom plane
  return {
    discT, domeW, discY,
    discR: p.hipW / 2,
    hipX: domeW / 2 + jointMounts("hinge1", ATLAS_JP.hip).a.pos[0],
    hipY: discY - p.hipH * 0.45,                      // hip shoulder pins
  };
}

function upperArmLayout(p) {
  // shoulder tongue disc base drops mount-2 deep into the arm
  const y0 = -jointMounts("hinge1", ATLAS_JP.shoulder).b.pos[2];
  return { y0, elbowY: y0 - p.len - hingeReach(ATLAS_JP.elbow) };
}

function forearmLayout(p) {
  const d = hingeDims(ATLAS_JP.elbow);
  const y0 = -d.bridgeY;                              // elbow male bridge face
  return {
    y0,
    // the forearm box RUNS UP INTO the elbow clevis and takes the place of
    // the tongue's base plate: it is narrower than the female arm gap, so it
    // swings with the tongue, and it stops a clearance short of the pin,
    // leaving only the tongue's knuckle disc proud of it
    boxTop: -(d.pinR + 2 * d.clr),
    boxBot: y0 - p.len - 0.02,
    wristY: y0 - p.len - hingeReach(ATLAS_JP.wrist),  // hinge2 stage-A pin
  };
}

// hinge2 wrist stacking: stage-B pin sits two arm reaches + the ONE shared
// middle base below stage A (stage A's male is base-less, like hinge2Block)
const wristMidY = () => {
  const d = hingeDims(ATLAS_JP.wrist);
  return -(2 * d.bodyLen + d.bridgeT);
};

function palmLayout(p) {
  const fw = PART_PARAMS.atlas.finger.w;              // fingers hang off the side faces
  const y0 = -hingeReach(ATLAS_JP.wrist);             // stage-B male bridge face
  const blockY = y0 - p.h / 2 + 0.02;
  const yb = blockY - p.h / 2;                        // block underside
  return {
    blockY, yb,
    knuckleY: yb + 0.06,                              // knuckle pins, near the lower edge
    fx: p.w * 0.27,                                   // front finger pair spread
    fz: p.d / 2 + fw / 2,                             // pins proud of the front/back faces
  };
}

function thighLayout(p) {
  // hip tongue disc base drops mount-2 deep into the thigh
  const y0 = -jointMounts("hinge1", ATLAS_JP.hip).b.pos[2];
  return { y0, kneeY: y0 - p.len - hingeReach(ATLAS_JP.knee) };
}

function shinLayout(p) {
  const y0 = -hingeReach(ATLAS_JP.knee);
  return { y0, ankleY: y0 - p.len - hingeReach(ATLAS_JP.ankle) };
}

// the foot is built around the ANKLE BASE: a flat box centered under the
// ankle pin, so the joint always stands on level ground. Everything else
// hangs off its two faces — forward, a slope box tapering into a flat toe box
// (the toe's height is what the slope leaves behind, so they meet flush on
// one sole plane); rearward, the heel part, bolted to the base's back face.
// p.len spans the ankle pin to the toe tip.
const FOOT_SLOPE = 0.55, FOOT_H = 0.2, TOE_D = 0.2, ANKLE_D = 0.24;

function footLayout(p) {
  const soleY = -hingeReach(ATLAS_JP.ankle) - 0.02;   // foot top plane, at the ankle
  const z0 = ANKLE_D / 2;                             // ankle base front face
  const footD = p.len - z0 - TOE_D;                   // slope run, ankle base -> toe
  return {
    soleY, footD,
    toeH: FOOT_H * (1 - FOOT_SLOPE),
    footZ: z0 + footD / 2,
    toeZ: z0 + footD + TOE_D / 2,
    heel: [0, soleY - FOOT_H / 2, -z0],               // heel slot: ankle base rear face
  };
}

// ATLAS HELMET — a FRONT-FACING CYLINDER drum: axis = +Z, the flat disc is
// the face, wearing two concentric proud rings (outer rim + a smaller inner
// one), ear pods on the drum sides. Male neck ball below (the torso supplies
// the socket); ball center = origin.
function helmet(add, p) {
  const y0 = ballTop(ATLAS_JP.neck), R = p.headR;
  maleBall(add, ATLAS_JP.neck, +1);                   // shaft up into the helmet
  add(translate(cylinder(0.14, 0.05, 14), 0, y0, 0)); // neck collar
  const cy = y0 + R + 0.04;                          // drum center height
  const fz = p.headD / 2;                            // face plane
  add(translate(rotX(cylinder(R, p.headD, 24), HPI), 0, cy, -fz));      // drum, face forward
  add(translate(rotX(cylinder(R + 0.03, 0.06, 24), HPI), 0, cy, fz));   // face rim ring
  add(translate(rotX(cylinder(p.innerR, 0.05, 20), HPI), 0, cy, fz + 0.06)); // inner face ring
  for (const s of [1, -1])                           // ear pods on the drum sides
    add(translate(rotZ(cylinder(0.09, 0.06, 14), s * HPI), s * (R + 0.06), cy, 0));
}

// ATLAS TORSO — modeled on the (electric) Atlas robot: a rounded SLAB chest
// (core box + vertical half-cylinder flanks), thin front panel, and a plain
// waist box below it — NO belly section, the torso sits
// directly on the pelvis. Joints offered: neck socket (up), 2 shoulder
// shoulder female U + pins on the flanks (disc base against the chest side,
// pin -> Z after the seat rotation), and the waist PIVOT's top stack below
// (flange disc / neck / cap — the pelvis holds the barrel; the torso twists
// about Y on it).
function torso(add, p) {
  const L = torsoLayout(p);
  const q = pivotDims(ATLAS_JP.waist);
  add(translate(cylinder(q.flangeR, q.flangeT, 28), 0, 0, 0));                // waist pivot top stack
  add(translate(cylinder(q.neckR, q.neckLen, 20), 0, q.flangeT, 0));
  add(translate(cylinder(q.capR, q.capT, 24), 0, q.flangeT + q.neckLen, 0));
  // waist block: a plain box bridging the pivot cap up to the chest slab
  add(translate(box(p.chestW * 0.55, L.taperH + 0.06, p.chestD * 0.75), 0, L.y0 + L.taperH / 2, 0));
  // chest slab: core box + rounded vertical flanks, depth = flank diameter
  const cw = p.chestW - 2 * L.r;
  add(translate(box(cw, p.chestH, 2 * L.r), 0, L.chestY + p.chestH / 2, 0));
  for (const s of [1, -1])
    add(translate(rotY(halfCylinder(L.r, p.chestH, 16), s * HPI), s * cw / 2, L.chestY, 0));
  // front panel plate
  add(translate(box(cw * 0.85, p.chestH * 0.72, 0.06), 0, L.chestY + p.chestH * 0.56, L.r + 0.01));
  add(translate(cylinder(0.17, 0.1, 16), 0, L.top, 0));                       // collar
  socketAt(add, ATLAS_JP.neck, [0, L.neckY, 0]);      // neck socket, opening up
  // shoulders: hinge1 female U + pin per flank — rotX(HPI) turns the pin onto
  // Z and drops the tongue exit downward; the right side mirrors with rotY(pi)
  // so both disc plates face the chest
  for (const s of [1, -1]) {
    const seat = (g) => {
      let h = rotX(g, HPI);
      if (s > 0) h = rotY(h, Math.PI);
      add(translate(h, s * L.sx, L.sy, 0));
    };
    hinge1Block(seat, () => {}, ATLAS_JP.shoulder);
  }
}

// ATLAS PELVIS — waist PIVOT barrel on top (Y spin only; the torso brings
// the flange/neck/cap stack), a flat DISC under it and a HALF-CYLINDER shell
// (axis X, dome down) as the body, hip shoulder female Us + pins on the dome's
// flat end faces. Rig root: the pivot's barrel-top face is the local origin.
function pelvis(add, p) {
  const L = pelvisLayout(p);
  const q = pivotDims(ATLAS_JP.waist);
  add(translate(cylinder(q.barrelR, q.barrelLen, 24), 0, -q.barrelLen, 0));   // pivot barrel
  add(translate(cylinder(L.discR, L.discT, 28), 0, L.discY, 0));              // top disc
  add(translate(rotY(rotX(halfCylinder(p.hipH, L.domeW, 20), HPI), HPI), -L.domeW / 2, L.discY, 0)); // dome shell, flat up
  // hips: hinge1 female U + pin per side, same seat scheme as the shoulders
  for (const s of [1, -1]) {
    const seat = (g) => {
      let h = rotX(g, HPI);
      if (s > 0) h = rotY(h, Math.PI);
      add(translate(h, s * L.hipX, L.hipY, 0));
    };
    hinge1Block(seat, () => {}, ATLAS_JP.hip);
  }
}

// ATLAS UPPER ARM — shoulder MOVING half on top (solid tongue + disc base
// seated so the disc base drops down into the arm; the torso holds the
// clevis + pin), biceps cylinder, elbow clevis + pin at the bottom.
function upperArm(add, p) {
  const L = upperArmLayout(p);
  const h = p.len + 0.08;
  hinge1Block(() => {}, (g) => add(rotX(g, HPI)), ATLAS_JP.shoulder);
  add(translate(cylinder(p.w / 2, h, 20), 0, L.y0 + 0.06 - h, 0));           // biceps barrel
  add(translate(rotZ(cylinder(p.w * 0.4, p.w + 0.14, 14), -HPI), -(p.w + 0.14) / 2, L.y0 - p.len, 0)); // elbow housing
  hingeFixedAt(add, ATLAS_JP.elbow, L.elbowY);
}

// ATLAS FOREARM — a box running all the way up into the elbow clevis, where
// it meets the solid male tongue (whose base plate it replaces), and down to
// the hinge2 wrist's STAGE-A clevis + pin (pin = X, the bend axis); the
// wrist link brings the male tongue. A 4-plank shroud skirts the box down to
// the wrist pin, boxing the clevis arms in without fouling the swing.
function forearm(add, p) {
  const L = forearmLayout(p);
  hingeMale(add, ATLAS_JP.elbow, { male: { noBase: 1 } });   // the box IS the tongue's base
  add(translate(box(p.w, L.boxTop - L.boxBot, p.w * 0.9), 0, (L.boxTop + L.boxBot) / 2, 0));
  hingeShroud(add, ATLAS_JP.wrist, L.wristY, L.y0 - p.len + 0.02);
  hingeFixedAt(add, ATLAS_JP.wrist, L.wristY);
}

// ATLAS WRIST — the MIDDLE link of the hinge2 wrist (two hinge1 stages in
// series): stage-A male tongue at the origin plugging the forearm's clevis
// (pin = X, bend), and directly below the stage-B clevis + pin turned 90°
// (pin = Z, tilt) that the palm's male tongue rides. Both stages SHARE stage
// B's base, so the stage-A male emits none — same scheme as hinge2Block.
// That shared base is a DISC: the palm's own disc turns on it, which is what
// gives the wrist its third DOF (twist about the palm normal).
function wrist(add, p) {
  hingeMale(add, ATLAS_JP.wrist, { male: { noBase: 1 } });
  hingeBlock((g) => add(translate(rotY(g, HPI), 0, wristMidY(), 0)), () => {},
    ATLAS_JP.wrist, { female: { disc: 1 } });
}

// ATLAS PALM — a GRIPPER hand: the hinge2 stage-B male tongue on top
// (pre-turned so its pin runs along Z, matching the wrist link's clevis) on a
// DISC base that twists against the wrist link's own disc, over a plain palm
// BLOCK sized to the forearm. No knuckle clevises: the fingers hang off the
// block's front and back SIDE FACES, each bringing its own knuckle pin — one
// behind (single finger), two in front (finger pair), pins = X, so the prongs
// curl toward each other.
function palm(add, p) {
  const L = palmLayout(p);
  hingeBlock(() => {}, (g) => add(rotY(g, HPI)), ATLAS_JP.wrist, { male: { disc: 1 } });
  add(translate(box(p.w, p.h, p.d), 0, L.blockY, 0));               // palm block
}

// ATLAS FINGER — 3 identical BOX digits, square-tipped, strung on bare
// KNUCKLE PINS: no clevis anywhere, each digit just carries a short
// horizontal cylinder (axis X, the bend axis) at its own origin — the first
// of them is the knuckle pin the palm's side face hangs the finger from.
// RUNTIME pose: pose.curl (radians from the rig) overrides the curl modeling
// param (degrees) and bends both inner pins — the knuckle itself is the
// rig's bone.
function finger(add, p, pose = {}) {
  const curl = pose.curl ?? rad(p.curl);
  let at = add;                                      // current digit frame, origin = its pin
  for (let i = 0; i < 3; i++) {
    const w = p.w * (1 - i * 0.12), L = p.digitLen, span = w + 0.02;
    at(translate(rotZ(cylinder(w * 0.45, span, 14), -HPI), -span / 2, 0, 0)); // pin, proud both faces
    at(translate(box(w, L + 0.05, w), 0, -(L + 0.05) / 2 + 0.02, 0));
    if (i === 2) break;
    const cur = at, py = -L;
    // -curl: the digits arch INTO the palm, the way the gripper closes
    at = (g) => cur(translate(rotX(g, -curl), 0, py, 0));
  }
}

// ATLAS THIGH — hip shoulder MOVING half on top (solid tongue + disc base dropping
// into the thigh; the pelvis holds the clevis + pin), thigh box, knee
// clevis + pin below.
function thigh(add, p) {
  const L = thighLayout(p);
  hinge1Block(() => {}, (g) => add(rotX(g, HPI)), ATLAS_JP.hip);
  add(translate(box(p.w, p.len + 0.1, p.w + 0.04), 0, L.y0 - (p.len + 0.1) / 2 + 0.07, 0));
  add(translate(rotZ(cylinder(p.w * 0.38, p.w + 0.16, 14), -HPI), -(p.w + 0.16) / 2, L.y0 - p.len, 0)); // knee housing
  hingeFixedAt(add, ATLAS_JP.knee, L.kneeY);
}

// ATLAS SHIN — male knee U on top, shin box + calf plate, ankle clevis +
// pin at the bottom.
function shin(add, p) {
  const L = shinLayout(p);
  hingeMale(add, ATLAS_JP.knee);
  add(translate(box(p.w, p.len + 0.06, p.w), 0, L.y0 - (p.len + 0.06) / 2 + 0.04, 0));
  add(translate(box(p.w * 0.75, p.len * 0.55, 0.1), 0, L.y0 - p.len * 0.4, -(p.w / 2 + 0.05))); // calf plate
  hingeFixedAt(add, ATLAS_JP.ankle, L.ankleY);
}

// ATLAS FOOT — solid male ankle tongue standing on the ANKLE BASE box, with
// the foot proper (a slope box) and the toes (a flat box) running forward off
// it. The heel part glues onto the base's rear face slot.
function foot(add, p) {
  const L = footLayout(p);
  hingeMale(add, ATLAS_JP.ankle);
  add(translate(box(p.w, FOOT_H, ANKLE_D), 0, L.soleY - FOOT_H / 2, 0));       // ankle base
  add(translate(box(p.w, FOOT_H, L.footD, FOOT_SLOPE), 0, L.soleY - FOOT_H / 2, L.footZ));
  add(translate(box(p.w * 0.92, L.toeH, TOE_D), 0, L.soleY - FOOT_H + L.toeH / 2, L.toeZ));
}

// ATLAS HEEL — TWO boxes running BACK off the foot's rear face (the ankle
// base): a base box continuing the sole, then a slope box tapering down to
// the ground behind it. Both share the foot's height, so the sole stays one
// plane from the toe to the heel taper.
function heel(add, p) {
  add(translate(box(p.w, p.h, p.d), 0, 0, -p.d / 2));                              // heel base
  add(translate(rotY(box(p.w, p.h, p.capD, 0.7), Math.PI), 0, 0, -p.d - p.capD / 2)); // taper, drops rearward
}

// catalog views of the joint blocks — pose sliders (degrees) drive the
// runtime rotations, the modeling params only shape the geometry. degPose
// converts a slider pose to radians along the joint's JOINT_POSE axis set.
function degPose(name, pose) {
  const out = {};
  for (const k of Object.keys(JOINT_POSE[name])) out[k] = rad(pose[k] || 0);
  return out;
}

// discF/discM UI flags land on their half via the sides overrides
const hinge1 = (add, p, pose = {}) =>
  hingeBlock(add, add, p, { female: { disc: p.discF }, male: { disc: p.discM } }, degPose("hinge1", pose));
const ball1 = (add, p, pose = {}) => ballBlock(add, add, p, degPose("ball1", pose));
const hinge2 = (add, p, pose = {}) => hinge2Block(add, add, p, degPose("hinge2", pose));
// pivot1: single-sink block, distinct call shape
const pivot1 = (add, p, pose = {}) => pivotBlock(add, p, degPose("pivot1", pose));
// prismatic1: linear DOFs — the pose is a distance, so no degree conversion
const prismatic1 = (add, p, pose = {}) => prismaticBlock(add, add, p, pose);

// PART REGISTRY, scoped per rig kit: names live in their kit's namespace
// (the atlas "head" is the helmet builder, distinct from the dragon head)
const PART_BUILDERS = {
  dragon: { head, bodySegment, bodySegment2, arm, leg, tail },
  atlas: { head: helmet, torso, pelvis, upperArm, forearm, wrist, palm, finger, thigh, shin, foot, heel },
  joints: { hinge1, hinge2, pivot1, prismatic1, ball1 },
};
export const PART_NAMES = Object.fromEntries(
  Object.entries(PART_BUILDERS).map(([kit, b]) => [kit, Object.keys(b)]));

// ---- primitive reference (view one primitive alone) -------------------------

export const PRIM_PARAMS = {
  cylinder: { r: 0.5, h: 1.2 },
  cone: { r: 0.5, h: 1.2 },
  coneCut: { r0: 0.5, r1: 0.25, h: 1.2 },
  box: { w: 1, h: 1, d: 1, slope: 0, curve: 0 },
  sphere: { r: 0.6 },
  hemisphere: { r: 0.6 },
  cutHemisphere: { r: 0.6, t: 0.25, cut: 0.7 },
  halfCylinder: { r: 0.5, h: 1.2 },
  halfCylinderBox: { r: 0.5, h: 1.2, depth: 0.5 },
  boxCylinder: { w: 1, boxH: 0.5, d: 1, cylH: 0.8, fit: "in" },
  quarterCylinder: { r: 0.5, h: 0.3 },
  gear: { r: 0.6, h: 0.25, teethOut: 12, teethIn: 0 },
};
export const PRIM_NAMES = Object.keys(PRIM_PARAMS);

const PRIM_BUILD = {
  cylinder: (p) => cylinder(p.r, p.h),
  cone: (p) => cone(p.r, p.h),
  coneCut: (p) => coneCut(p.r0, p.r1, p.h),
  box: (p) => box(p.w, p.h, p.d, p.slope, p.curve),
  sphere: (p) => sphere(p.r),
  hemisphere: (p) => hemisphere(p.r),
  cutHemisphere: (p) => cutHemisphere(p.r, p.t, p.cut),
  halfCylinder: (p) => halfCylinder(p.r, p.h),
  halfCylinderBox: (p) => halfCylinderBox(p.r, p.h, p.depth),
  boxCylinder: (p) => boxCylinder(p.w, p.boxH, p.d, p.cylH, p.fit),
  quarterCylinder: (p) => quarterCylinder(p.r, p.h),
  gear: (p) => gear(p.r, p.h, p.teethOut, p.teethIn),
};

// ---- model assembly ----------------------------------------------------------

function collect(builderFn, seed, params, pose) {
  const items = [];
  const add = (g) => {
    const b = bake(g);
    items.push({ ...b, color: colorOf(b.id, seed) });
  };
  builderFn(add, params, pose);
  // unit meshes referenced by the items — the renderer draws one instanced
  // call per key
  const meshes = {};
  for (const it of items) if (!meshes[it.key]) meshes[it.key] = meshOf(it.key);
  return { items, meshes };
}

export function partModel(kit, name, seed = 1, params = null, pose = null) {
  const reg = PART_BUILDERS[kit];
  const key = reg[name] ? name : PART_NAMES[kit][0];
  const p = { ...PART_PARAMS[kit][key], ...(params || {}) };
  return collect(reg[key], seed, p, pose || {});
}

// raw build for external assemblers (the rigs): the caller supplies the
// add() sink and applies its own placement transform — parts stay the single
// source of geometry, a rig never re-models them
export function buildPart(kit, name, add, params = null, pose = null) {
  PART_BUILDERS[kit][name](add, { ...PART_PARAMS[kit][name], ...(params || {}) }, pose || {});
}

// PART MOUNT SLOTS — parts expose slots the same way joints do: each slot is
// { pos, n, f } (origin + outward normal + forward tangent = a full coordinate
// system) in the part's LOCAL frame, DERIVED from the mount slots of the
// joints the part is built on (jointMounts), so the sockets and balls line up
// exactly with the emitted geometry. A rig connects two parts by MATCHING a
// slot on each: positions coincide, forwards align, normals oppose.
export function partSlots(kit, name, params = null) {
  const p = { ...PART_PARAMS[kit][name], ...(params || {}) };
  if (kit === "dragon") switch (name) {
    case "bodySegment": {
      const { cy, z0, front, flankX } = bodySegmentLayout(p);
      return {
        rear: { pos: [0, cy, 0], n: [0, 0, -1], f: [0, 1, 0] },     // female socket, ball center
        front: { pos: [0, cy, front], n: [0, 0, 1], f: [0, 1, 0] }, // male ball center
        flankL: { pos: [-flankX, cy, z0 + p.segLen / 2], n: [-1, 0, 0], f: [0, 0, 1] },
        flankR: { pos: [flankX, cy, z0 + p.segLen / 2], n: [1, 0, 0], f: [0, 0, 1] },
      };
    }
    case "bodySegment2": {
      const { cy, front } = bodySegment2Layout(p);
      return {
        rear: { pos: [0, cy, 0], n: [0, 0, -1], f: [0, 1, 0] },
        front: { pos: [0, cy, front], n: [0, 0, 1], f: [0, 1, 0] },
      };
    }
    case "tail": {
      const { cy, front } = tailLayout(p);
      return { front: { pos: [0, cy, front], n: [0, 0, 1], f: [0, 1, 0] } };
    }
    case "head":
      return {
        neck: { pos: [...HEAD_NECK], n: [0, 0, -1], f: [0, 1, 0] },        // mating neck ball center
        jaw: { pos: [...HEAD_JAW_PIN], n: [0, -1, 0], f: [1, 0, 0] },      // jaw hinge pin, f = pin axis
      };
    case "arm": {
      const { jm, sy } = armLayout(p);
      // the shoulder is seated rotX(HPI): mount-1 disc face keeps pointing +X
      // and the pin axis (the slot forward) maps +Y -> +Z
      return { mount: { pos: [jm.a.pos[0], sy, 0], n: [1, 0, 0], f: [0, 0, 1] } };
    }
    case "leg": {
      const { jm, hy } = legLayout(p);
      return { mount: { pos: [jm.a.pos[0], hy, 0], n: [1, 0, 0], f: [0, 0, 1] } };
    }
  }
  // atlas kit: mount = the part's own moving joint half (n points at the
  // parent), the rest = fixed halves offered to children
  if (kit === "atlas") switch (name) {
    case "head":
      return { mount: { pos: [0, 0, 0], n: [0, -1, 0], f: [0, 0, 1] } };
    case "torso": {
      const L = torsoLayout(p);
      return {
        mount: { pos: [0, 0, 0], n: [0, -1, 0], f: [0, 0, 1] },
        neck: { pos: [0, L.neckY, 0], n: [0, 1, 0], f: [0, 0, 1] },
        // shoulder pin centers, n = outward off the flank; f is
        // shared with the arm's mount so the right side mirrors via rotY(pi)
        shoulderL: { pos: [-L.sx, L.sy, 0], n: [-1, 0, 0], f: [0, 1, 0] },
        shoulderR: { pos: [L.sx, L.sy, 0], n: [1, 0, 0], f: [0, 1, 0] },
      };
    }
    case "pelvis": {
      const L = pelvisLayout(p);
      return {
        waist: { pos: [0, 0, 0], n: [0, 1, 0], f: [0, 0, 1] },   // pivot barrel top
        // hip pin centers; BOTH slots share one frame so the legs
        // seat un-mirrored (rest = identity) and the feet keep facing +Z
        hipL: { pos: [-L.hipX, L.hipY, 0], n: [-1, 0, 0], f: [0, 1, 0] },
        hipR: { pos: [L.hipX, L.hipY, 0], n: [-1, 0, 0], f: [0, 1, 0] },
      };
    }
    case "upperArm": {
      const L = upperArmLayout(p);
      return {
        // shoulder tongue eye = the origin; n points at the torso flank
        mount: { pos: [0, 0, 0], n: [1, 0, 0], f: [0, 1, 0] },
        elbow: { pos: [0, L.elbowY, 0], n: [0, -1, 0], f: [1, 0, 0] },  // f = pin axis
      };
    }
    case "forearm": {
      const L = forearmLayout(p);
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0] },
        wrist: { pos: [0, L.wristY, 0], n: [0, -1, 0], f: [1, 0, 0] },  // hinge2 stage-A pin
      };
    }
    case "wrist":
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0] },          // stage-A pin (X, bend)
        out: { pos: [0, wristMidY(), 0], n: [0, -1, 0], f: [0, 0, 1] }, // stage-B pin (Z, tilt)
      };
    case "palm": {
      const L = palmLayout(p);
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [0, 0, 1] },          // stage-B male, pin = Z
        // prongs: f0 = single back finger (f mirrored so it curls the other
        // way), f1/f2 = the front pair — a 3-jaw gripper
        f0: { pos: [0, L.knuckleY, -L.fz], n: [0, -1, 0], f: [-1, 0, 0] },
        f1: { pos: [-L.fx, L.knuckleY, L.fz], n: [0, -1, 0], f: [1, 0, 0] },
        f2: { pos: [L.fx, L.knuckleY, L.fz], n: [0, -1, 0], f: [1, 0, 0] },
      };
    }
    case "finger":
      return { mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0] } };
    case "thigh": {
      const L = thighLayout(p);
      return {
        // hip tongue eye = the origin; n points at the pelvis flank
        mount: { pos: [0, 0, 0], n: [1, 0, 0], f: [0, 1, 0] },
        knee: { pos: [0, L.kneeY, 0], n: [0, -1, 0], f: [1, 0, 0] },
      };
    }
    case "shin": {
      const L = shinLayout(p);
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0] },
        ankle: { pos: [0, L.ankleY, 0], n: [0, -1, 0], f: [1, 0, 0] },
      };
    }
    case "foot": {
      const L = footLayout(p);
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0] },
        heel: { pos: L.heel, n: [0, 0, -1], f: [0, 1, 0] },
      };
    }
    case "heel":
      return { mount: { pos: [0, 0, 0], n: [0, 0, 1], f: [0, 1, 0] } };
  }
  return {};
}

export function primitiveModel(name, params, seed = 1) {
  const build = PRIM_BUILD[name] || PRIM_BUILD.cylinder;
  const p = { ...PRIM_PARAMS[name], ...(params || {}) };
  return collect((add) => add(build(p)), seed);
}
