// JOINT ENGINE — mech joints assembled from primitives.js. Both rigs (dragon,
// atlas) chain through the SAME blocks — only their part kits and rig data differ.
//
// Nomenclature (standard clevis-and-pin hardware, mirrored from the pieces
// modeled in Blender / robot_dragon.blend):
//   clevis   the forked half: two LUGS (parallel plates, each with a rounded
//            KNUCKLE head bored for the pin) closed by a FLANGE (the mounting
//            plate the parent part bolts to). The space between the lugs is the
//            JAW.
//   tang     the solid blade that fills the jaw (a lug with no fork), pinned in
//            double shear. A hinge's moving half is either a nested inner
//            clevis (default, interleaved lugs) or a single tang.
//   pin      the clevis pin: one bare shaft through every knuckle bore.
//
// The joints:
//   hinge1  clevis-and-pin: inner clevis nested in an outer one, interleaved
//           knuckles, one shared pin, a flange closing each fork. `tang` swaps
//           the inner clevis for a solid tang, discF/discM turn either flange
//           from a plate into a disc, flangeT sizes both
//   hinge2  TWO hinge1 stages in series sharing one middle flange, pins X then
//           Z: a 2-axis universal (Hooke) joint — the atlas wrist. The middle
//           flange is the intermediate yoke; three disc flags, one per flange
//   pivot1  double pivot: center barrel, flange disc + neck + cap on both ends
//   prismatic1  the LINEAR joint: a sleeve housing with a square RAM sliding
//           out of each end (pose = travel distance, not degrees)
//   ball1   ball-and-socket: a ball STUD seated in a cut-hemisphere socket
import {
  box, cylinder, sphere, cutHemisphere, halfCylinderBox,
  rotX, rotY, rotZ, translate,
} from "./primitives.js";
import { rad } from "../math/scalar.js";
import { createKit } from "./kit.js";

export const HPI = Math.PI / 2;

const JOINT_DEFAULTS = {
  // pinOut = how far the pin pokes past the outer clevis's outboard lug faces;
  // 0 keeps it inside the clevis (clamped to PIN_OUT_MIN, not truly flush)
  hinge: { jaw: 0.24, lugT: 0.12, lugL: 0.45, lugD: 0.55, pinR: 0.14, clr: 0.03, pinOut: 0.05 },
  pivot: { barrelR: 0.3, barrelLen: 0.8, flangeR: 0.44, neckR: 0.17, neckLen: 0.16, capR: 0.32 },
  ball: { ballR: 0.3, socketT: 0.1, cut: 0.75, studR: 0.11, studLen: 0.3, flangeW: 0.95, flangeT: 0.14 },
  prismatic: { sleeveW: 0.5, sleeveLen: 0.7, sleeveD: 0.5, ramW: 0.3, ramLen: 0.7 },
};

export const JOINT_PARAMS = {
  hinge1: { ...JOINT_DEFAULTS.hinge, flangeT: 0.16, tang: 0, discF: 0, discM: 0 },
  hinge2: { ...JOINT_DEFAULTS.hinge, flangeT: 0.16, tang: 0, discF: 0, discMid: 0, discM: 0 },
  pivot1: { ...JOINT_DEFAULTS.pivot },
  prismatic1: { ...JOINT_DEFAULTS.prismatic },
  ball1: { ...JOINT_DEFAULTS.ball, disc: 0 },
};

// ONE dims function per joint kind, consumed by BOTH the block builder and
// jointMounts, so a mount can never drift from the geometry it seats on.

const PIN_OUT_MIN = 0.005;   // smallest pin overhang past the outboard lug faces

export function hingeDims(p) {
  const q = { ...JOINT_DEFAULTS.hinge, ...p };
  const clr = q.clr;                              // outer-lug to inner-lug slack, per side
  const flangeT = q.flangeT || Math.max(0.12, q.lugT * 1.3);   // p.flangeT overrides the derived thickness
  const tip = Math.min(0.2, q.lugL * 0.4);        // square lug reach past the pin
  const shank = Math.max(0.05, q.lugL - tip);     // pin -> lug root (where the flange seats)
  const jawW = q.jaw + 2 * q.lugT + 2 * clr;      // the OUTER clevis's jaw: inner clevis + slack
  return {
    ...q, clr, flangeT, tip, shank, jawW,
    knuckleR: q.lugD / 2,
    reach: shank + flangeT,                       // pin -> flange outer face
    // pin half-length: the outboard lug faces, plus the pinOut overhang.
    // clamped to PIN_OUT_MIN so the pin's end cap never lands coplanar with
    // a lug face (z-fighting) even when the joint asks for a flush pin.
    pinHalf: jawW / 2 + q.lugT + Math.max(PIN_OUT_MIN, q.pinOut ?? 0),
  };
}

export function ballDims(p) {
  const q = { ...JOINT_DEFAULTS.ball, ...p };
  return {
    ...q,
    drop: q.ballR * 0.55,                         // socket flange plane below the ball center
    top: q.ballR + q.studLen,                     // ball center -> stud flange underside
  };
}

function pivotDims(p) {
  const q = { ...JOINT_DEFAULTS.pivot, ...p };
  return { ...q, flangeT: 0.1, capT: 0.1 };
}

function prismaticDims(p) {
  const q = { ...JOINT_DEFAULTS.prismatic, ...p };
  const halfL = q.sleeveLen / 2;
  const engage = q.sleeveLen * 0.25;   // ram length that must stay engaged in the sleeve
  // at slide 0 a ram's inner end sits on the sleeve's mid-plane, so the two
  // rams never collide; sliding out is capped by the engagement reserve
  return { ...q, halfL, engage, travel: Math.max(0, halfL - engage) };
}

// LUG — one fork plate: a D-plate (half-cylinder knuckle + square shank) with
// its knuckle circle (the pin bore) centered on the local origin, plate
// thickness along X, shank running -Y (down=false mirrors it: knuckle down,
// shank up). xc = plate center on X.
function lug(knuckleR, shank, thickness, xc, down = false) {
  const g = halfCylinderBox(knuckleR, thickness, shank, 16);
  rotX(g, -HPI);          // axis -> -Z, knuckle bulge -> +Y, shank -> -Y
  rotY(g, HPI);           // axis (thickness) -> -X
  if (down) rotZ(g, Math.PI);
  const off = down ? -thickness / 2 : thickness / 2;
  return translate(g, xc + off, 0, 0);
}

// CLEVIS — two lugs (knuckles on the pin axis) closed by a flange.
// tang = one full-jaw-width plate instead of the two lugs (a solid blade).
// d.disc swaps the flange plate for a Y-axis disc circumscribing the plate
// footprint, so the lugs never poke past the disc rim. d.noFlange emits the
// lugs alone — for a half that SHARES the neighbouring half's flange
// (hinge2's middle plate).
function clevis(add, d, jaw, up, tang = false) {
  const s = up ? 1 : -1;
  const shank = d.shank;
  const w = jaw + 2 * d.lugT;
  if (tang) {
    add(lug(d.knuckleR, shank, w, 0, !up));
  } else {
    const lugX = jaw / 2 + d.lugT / 2;
    add(lug(d.knuckleR, shank, d.lugT, -lugX, !up));
    add(lug(d.knuckleR, shank, d.lugT, lugX, !up));
  }
  if (d.noFlange) return;
  // the lug shanks run away from the knuckle: the flange sits opposite the
  // jaw opening, centered on yc. box is center-anchored, cylinder
  // base-anchored — shift it.
  const yc = -s * (shank + d.flangeT / 2);
  if (d.disc) add(translate(cylinder(Math.hypot(w, d.lugD) / 2, d.flangeT, 24), 0, yc - d.flangeT / 2, 0));
  else add(translate(box(w, d.flangeT, d.lugD), 0, yc, 0));
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
      a: { pos: [0, -(d.drop + d.flangeT), 0], n: [0, -1, 0], f: [0, 0, 1] },  // socket flange underside
      b: { pos: [0, d.top + d.flangeT, 0], n: [0, 1, 0], f: [0, 0, 1] },       // stud flange top
    };
  }
  const d = hingeDims(p);                                                      // kind === "hinge1" (L-seated)
  return {
    a: { pos: [d.reach, 0, 0], n: [1, 0, 0], f: [0, 1, 0] },   // mount-1 clevis disc face, f = pin axis
    b: { pos: [0, 0, d.reach], n: [0, 0, 1], f: [0, 1, 0] },   // mount-2 tang disc face (rest swing), f = pin axis
  };
}

// HINGE BLOCK — pin = X axis through the local origin. The OUTER clevis (wide
// jaw, opening down) and the shared pin emit through the `fixed` channel; the
// INNER clevis (narrow, opening up) emits through `moving`, authored around
// the same origin. `sides.female` / `sides.male` override dims for one half
// only (e.g. shorter lugs on the moving half) without touching the mechanism.
// p.tang (or sides.male.tang) makes the moving half a solid tang instead of a
// fork.
// RUNTIME pose (radians, separate from the modeling params): pose.swing
// rotates the moving half about the pin. A consumer with extra geometry riding
// the moving half can instead keep articulating the whole `moving` channel.
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
  clevis(fixed, dF, dF.jawW, false);            // outer clevis
  clevis(mv, dM, dM.jaw, true, !!dM.tang);      // moving half: nested clevis, or solid tang
  // pin = bare shaft (no end caps); pinOut sets how far it pokes past the
  // outboard lug faces (0 = as near flush as PIN_OUT_MIN allows)
  const halfSpan = dF.pinHalf;
  fixed(translate(rotZ(cylinder(dF.pinR, 2 * halfSpan, 20), -HPI), -halfSpan, 0, 0));
  jend();
}

// stage-B pin drop of a hinge2: its clevis lugs end exactly where stage A's
// moving lugs do, so the ONE middle flange spans both stages. Exported so a
// consumer that splits a hinge2 across parts (the atlas forearm/wrist/palm)
// stacks the same number the block bakes in.
export const hinge2MidY = (p) => {
  const d = hingeDims(p);
  return -(2 * d.shank + d.flangeT);
};

// HINGE2 BLOCK — literally TWO hinge1 stages in SERIES sharing ONE flange:
// stage A pin = X at the origin, stage B directly below with its pin turned
// to Z, so the output end rotates about X AND Z — a 2-axis universal (Hooke)
// joint, the atlas wrist. Stage A's moving half emits NO flange; stage B's
// clevis flange is the single MIDDLE plate both stages bolt to (the
// intermediate yoke). Every hinge1 setting carries over: flangeT (all
// flanges), tang (both moving halves), discF / discMid / discM pick plate or
// disc per flange, top to bottom.
// RUNTIME pose (radians): pose.rx swings stage A about the X pin — the whole
// stage B rides that swing — and pose.rz swings stage B's moving half about
// the Z pin. fixed = stage-A clevis + pin; everything else emits via `moving`.
export function hinge2Block(fixed, moving, p = {}, pose = {}) {
  jbegin();
  const rx = pose.rx || 0, rz = pose.rz || 0;
  const mid = rx ? (g) => moving(rotX(g, rx)) : moving;   // rides the stage-A swing
  const male = { tang: p.tang };
  hingeBlock(fixed, mid, p, { female: { disc: p.discF }, male: { ...male, noFlange: 1 } });
  const y = hinge2MidY(p);
  // rotY(HPI) turns the authored X pin onto Z; the moving half pre-swings about
  // its own (pre-turn) pin, -rz so a positive pose reads as +Z rotation
  hingeBlock(
    (g) => mid(translate(rotY(g, HPI), 0, y, 0)),
    (g) => mid(translate(rotY(rotX(g, -rz), HPI), 0, y, 0)),
    p,
    { female: { disc: p.discMid }, male: { ...male, disc: p.discM } },
  );
  jend();
}

// BALL BLOCK — ball-and-socket, ball center = local origin. Fixed half = a
// cut-hemisphere socket cupping the ball, standing on a thin flange; moving
// half = the ball STUD, i.e. the sphere with a shank growing up out of the
// socket mouth to its own thin flange. A consumer articulates by rotating
// everything routed through `moving` about the origin — any axis, that's the
// point of the ball.
// RUNTIME pose (radians): pose.rx/ry/rz — one full xyz rotation of the stud
// about the ball center.
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
  // flanges: square plates by default; p.base = "disc" (parts) or the p.disc
  // flag (catalog UI) swaps in discs
  const flange = (w) => q.base === "disc" || q.disc ? cylinder(w / 2, q.flangeT, 24) : box(w, q.flangeT, w);
  fixed(translate(flange(q.flangeW), 0, -q.drop - q.flangeT / 2, 0));
  // cutHemisphere wall + cut are fractions of r
  fixed(translate(cutHemisphere(rOut, q.socketT / rOut, q.cut, 28, 8), 0, -q.drop, 0));
  mv(sphere(q.ballR, 20, 14));
  mv(cylinder(q.studR, q.top, 18));                // stud shank
  mv(translate(flange(q.flangeW * 0.75), 0, q.top + q.flangeT / 2, 0));
  jend();
}

// HINGE1 BLOCK — the generic mount-to-mount clevis-and-pin hinge: solid tang +
// disc flanges on both halves, re-oriented and rest-swung 90° into an L so
// parts can chain through it anywhere a hinge is needed (dragon shoulders/hips,
// atlas shoulder/hip today) — mount 1 (the clevis disc) faces +X into the
// parent flank, the pin runs along Y, mount 2 (the tang disc) exits +Z into the
// child (see jointMounts "hinge1").
// RUNTIME pose (radians), 3 rotations: pose.swing about the pin (Y),
// pose.spinF spins the whole joint about the mount-1 disc axis (X) — the
// clevis is the PARENT, so spinF carries the tang chain with it — and
// pose.spinM is the mount-2 turntable (Z): the tang's disc is a body of
// revolution, so the spin only shows through the consumer's limb chain.
export function hinge1Block(fixed, moving, p = {}, pose = {}) {
  // hinge local -> mount frame: clevis flange +Y -> +X, pin X -> Y
  const R = (g) => rotY(rotZ(g, HPI), Math.PI);
  const sf = pose.spinF || 0;
  const fx = (g) => { const h = R(g); fixed(sf ? rotX(h, sf) : h); };
  const mv = (g) => { const h = R(g); moving(sf ? rotX(h, sf) : h); };
  // rest swing 90°: the tang disc exits perpendicular to the clevis mount
  hingeBlock(fx, mv, p, { female: { disc: 1 }, male: { disc: 1, tang: 1 } },
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

// PRISMATIC BLOCK — the one LINEAR joint: 3 boxes. A sleeve housing centered on
// the origin, slide axis = Y, and two square RAMS running out of its ends
// (+Y = ram A, -Y = ram B), each carrying a part. At slide 0 a ram's inner end
// rests on the sleeve's mid-plane, so the two never collide; travel is capped
// by the engagement reserve so a ram can't leave the sleeve.
// fixed = sleeve + ram A, moving = ram B — a consumer holds the sleeve with
// the parent and lets the child ride the moving channel.
// RUNTIME pose (MODEL UNITS, not radians): pose.slideA / pose.slideB extend
// each ram out of its end of the sleeve.
export function prismaticBlock(fixed, moving, p = {}, pose = {}) {
  jbegin();
  const q = prismaticDims(p);
  const clamp = (v) => Math.max(0, Math.min(v || 0, q.travel));
  // ram: inner end on the mid-plane at slide 0, growing out along s
  const ram = (add, s, slide) =>
    add(translate(box(q.ramW, q.ramLen, q.ramW), 0, s * (clamp(slide) + q.ramLen / 2), 0));
  fixed(box(q.sleeveW, q.sleeveLen, q.sleeveD));   // sleeve housing
  ram(fixed, 1, pose.slideA);
  ram(moving, -1, pose.slideB);
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
