// JOINT ENGINE — mech joints assembled from primitives.js. Both rigs (dragon,
// atlas) chain through the SAME blocks — only their part kits and rig data differ.
//
// The joints mirror the pieces designed in Blender (robot_dragon.blend):
//   hinge1  two U pieces (narrow nested in wide), arms interleaved with rounded
//           knuckles, one shared pin, a base plate closing each U. `solid` swaps
//           the male U for an I-shaped tongue, discF/discM swap either base box
//           -> disc, baseH sizes both
//   hinge2  TWO hinge1 stages in series sharing one middle base, pins X then Z:
//           a 2-axis universal joint (the atlas wrist), three disc flags (one per base)
//   pivot1  double pivot: center barrel, flange disc + neck + cap on both ends
//   prismatic1  the LINEAR joint: a cover sleeve with a square mounting shaft
//           sliding out of each end (pose = travel distance, not degrees)
//   pivot2  turntable pivot: box base with an inscribed cylinder seat, disc, ball hub
import {
  box, cylinder, sphere, cutHemisphere, halfCylinderBox,
  rotX, rotY, rotZ, translate,
} from "./primitives.js";
import { rad } from "../math/scalar.js";
import { createKit } from "./kit.js";

export const HPI = Math.PI / 2;

const JOINT_DEFAULTS = {
  // pinOut = how far the pin shaft pokes past the female arms' outer faces;
  // 0 keeps it inside the clevis (clamped to PIN_OUT_MIN, not truly flush)
  hinge: { gap: 0.24, armT: 0.12, armH: 0.45, depth: 0.55, pinR: 0.14, clr: 0.03, pinOut: 0.05 },
  pivot: { barrelR: 0.3, barrelLen: 0.8, flangeR: 0.44, neckR: 0.17, neckLen: 0.16, capR: 0.32 },
  ball: { ballR: 0.3, socketT: 0.1, cut: 0.75, shaftR: 0.11, shaftLen: 0.3, baseW: 0.95, baseT: 0.14 },
  prismatic: { coverW: 0.5, coverLen: 0.7, coverD: 0.5, shaftW: 0.3, shaftLen: 0.7 },
};

export const JOINT_PARAMS = {
  hinge1: { ...JOINT_DEFAULTS.hinge, baseH: 0.16, solid: 0, discF: 0, discM: 0 },
  hinge2: { ...JOINT_DEFAULTS.hinge, baseH: 0.16, solid: 0, discF: 0, discMid: 0, discM: 0 },
  pivot1: { ...JOINT_DEFAULTS.pivot },
  prismatic1: { ...JOINT_DEFAULTS.prismatic },
  ball1: { ...JOINT_DEFAULTS.ball, disc: 0 },
};

// ONE dims function per joint kind, consumed by BOTH the block builder and
// jointMounts, so a mount can never drift from the geometry it seats on.

const PIN_OUT_MIN = 0.005;   // smallest pin overhang past the female arm faces

export function hingeDims(p) {
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

export function ballDims(p) {
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
export function jointMounts(kind, p = {}) {
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

export function hingeBlock(fixed, moving, p = {}, sides = {}, pose = {}) {
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
export function hinge2Block(fixed, moving, p = {}, pose = {}) {
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
export function ballBlock(fixed, moving, p = {}, pose = {}) {
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
export function hinge1Block(fixed, moving, p = {}, pose = {}) {
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
export function pivotBlock(add, p = {}, pose = {}) {
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
export function prismaticBlock(fixed, moving, p = {}, pose = {}) {
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


// the joint catalog is a kit like any other — no slots, since a joint's mount
// slots come off jointMounts(), not the part-slot lookup
export const JOINT_KIT = createKit({
  params: JOINT_PARAMS,
  builders: { hinge1, hinge2, pivot1, prismatic1, ball1 },
});
