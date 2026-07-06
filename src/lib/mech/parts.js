// PART CATALOG — mech joints assembled from the primitive engine (primitives.js).
// Every primitive instance is its own draw item with a RANDOM color (seeded, so
// a given seed reproduces the same coloring; bump the seed to reshuffle).
//
// The joints mirror the pieces designed in Blender (robot_dragon.blend):
//   hinge2  two U pieces (narrow nested in wide), arms interleaved with rounded
//           knuckles (half-cylinder ends), one shared pin through all four arms
//   hinge3  clevis + tongue: a two-arm socket U over a rounded tongue whose
//           barrel drops to a pivot flange (the neck-joint combo)
//   pivot1  double pivot: center barrel, flange ring + neck + cap on both ends
//   pivot2  turntable pivot: box base with an inscribed cylinder seat, disc,
//           ball hub — shows the box+cylinder primitive both ways
import {
  box, cylinder, cone, coneCut, sphere, hemisphere, cutHemisphere, halfCylinder,
  halfCylinderBox, boxCylinder, quarterCylinder, rotX, rotY, rotZ, translate, bake,
  meshOf,
} from "./primitives.js";

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

export const JOINT_DEFAULTS = {
  hinge: { gap: 0.24, armT: 0.12, armH: 0.6, depth: 0.55, pinR: 0.14 },
  pivot: { barrelR: 0.3, barrelLen: 0.8, flangeR: 0.44, neckR: 0.17, neckLen: 0.16, capR: 0.32 },
  ball: { ballR: 0.3, socketT: 0.1, cut: 0.75, shaftR: 0.11, shaftLen: 0.3, baseW: 0.95, baseT: 0.14 },
  hinge3: { tongueT: 0.24, armT: 0.13, armLen: 0.42, barrelR: 0.3, barrelLen: 0.5, pinR: 0.14, tongueLen: 0.35 },
};

// ---- editable per-part parameters -------------------------------------------
export const PART_PARAMS = {
  head: { headW: 1.2, snoutLen: 1.1, jawOpen: 16, eyeR: 0.17, hornLen: 0.9 },
  bodySegment: { bodyR: 0.55, segLen: 1.6, discs: 4, finR: 0.45 },
  bodySegment2: { rFront: 0.55, rRear: 0.36, segLen: 1.6, finR: 0.4 },
  arm: { upperLen: 0.45, foreLen: 0.4, elbowBend: 25, clawR: 0.3 },
  leg: { thighLen: 0.5, shinLen: 0.45, kneeBend: 18, footLen: 0.35, clawR: 0.28 },
  tail: { coreLen: 1.4, bodyR: 0.4, tipLen: 1.2 },
  hinge2: { ...JOINT_DEFAULTS.hinge },
  hinge3: { ...JOINT_DEFAULTS.hinge3 },
  pivot1: { ...JOINT_DEFAULTS.pivot },
  hinge1: { ...JOINT_DEFAULTS.hinge },
  ball1: { ...JOINT_DEFAULTS.ball },
};

// ---- derived joint dimensions ------------------------------------------------
// ONE dims function per joint kind, consumed by BOTH the block builder and
// jointMounts, so a mount can never drift from the geometry it seats on.

function hingeDims(p) {
  const clr = 0.03;
  const bridgeT = Math.max(0.12, p.armT * 1.3);
  const tip = Math.min(0.2, p.armH * 0.4);        // square arm reach past the pin
  return {
    ...p, clr, bridgeT, tip,
    gapW: p.gap + 2 * p.armT + 2 * clr,
    knuckleR: p.depth / 2,
    bridgeY: p.armH - tip + bridgeT,              // bridge outer face distance from the pin
  };
}

const HINGE1_BOSS_H = 0.16;                       // hinge1 boss cylinder height

function ballDims(p) {
  const q = { ...JOINT_DEFAULTS.ball, ...p };
  return {
    ...q,
    drop: q.ballR * 0.55,                         // socket base plane below the ball center
    top: q.ballR + q.shaftLen,                    // ball center -> male plate underside
  };
}

function hinge3Dims(p) {
  const q = { ...JOINT_DEFAULTS.hinge3, ...p };
  const clr = 0.03;
  const knuckleR = q.tongueT + 0.06;
  const disc1R = q.barrelR + 0.07;
  return {
    ...q, clr, knuckleR, disc1R,
    gap: q.tongueT + 2 * clr,
    bridgeT: Math.max(0.14, q.barrelR),
    discT: 0.1,                                   // mount-1 disc thickness
    flangeT: 0.09, capT: 0.08,                    // mount-2 pivot flange + end cap
  };
}

function pivotDims(p) {
  const q = { ...JOINT_DEFAULTS.pivot, ...p };
  const flangeT = 0.1, capT = 0.1;
  return {
    ...q, flangeT, capT,
    end: q.barrelLen / 2 + flangeT + q.neckLen + capT, // barrel half -> cap outer face
  };
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

// rounded U: two D-plate arms (knuckles on the pin axis) + a bridge box.
function roundedU(add, d, gap, up) {
  const s = up ? 1 : -1;
  const bodyLen = Math.max(0.05, d.armH - d.tip);
  const armX = gap / 2 + d.armT / 2;
  add(roundedArm(d.knuckleR, bodyLen, d.armT, -armX, !up));
  add(roundedArm(d.knuckleR, bodyLen, d.armT, armX, !up));
  // arms' bodies run away from the knuckle: bridge sits opposite the opening
  add(translate(box(gap + 2 * d.armT, d.bridgeT, d.depth), 0, -s * (bodyLen + d.bridgeT / 2), 0));
}

// ---- JOINT BLOCKS — joints are building blocks with the same standing as the
// primitives: parts compose these instead of hand-rolling arms and pins, so any
// improvement to a mechanism here upgrades every part that uses it.

// RUNTIME joint rotations (degrees in the UI) — a separate axis set per joint,
// distinct from the modeling params above. deg -> rad happens in the catalog
// builders; the blocks themselves take radians.
export const JOINT_POSE = {
  hinge1: { swing: 0, twistF: 0, twistM: 0 },
  hinge2: { swing: 0 },
  hinge3: { swing: 0, spinF: 0, spinM: 0 },
  pivot1: { spinA: 0, spinB: 0 },
  ball1: { rx: 0, ry: 0, rz: 0 },
};
const rad = (d) => ((d || 0) * Math.PI) / 180;

// MOUNT SLOTS — every joint declares where consumers attach to it: 2 slots,
// each { pos, n, f } (origin + outward normal + forward tangent, f ⊥ n, so a
// slot forms a full coordinate system) in the joint's LOCAL frame, before any
// consumer transform. Slot `a` rides the fixed/female half, slot
// `b` rides the moving/male half. Parts and the dragon rig snap geometry to
// these instead of re-deriving offsets, so a joint redesign moves every
// consumer automatically.
export function jointMounts(kind, p = {}, sides = {}) {
  switch (kind) {
    case "hinge":
    case "hinge2": {
      const base = { ...JOINT_DEFAULTS.hinge, ...p };
      const dF = hingeDims({ ...base, ...(sides.female || {}) });
      const dM = hingeDims({ ...base, ...(sides.male || {}) });
      return {
        a: { pos: [0, dF.bridgeY, 0], n: [0, 1, 0], f: [0, 0, 1] },      // female bridge top
        b: { pos: [0, -dM.bridgeY, 0], n: [0, -1, 0], f: [0, 0, 1] },    // male bridge bottom
      };
    }
    case "hinge1": {
      const m = jointMounts("hinge", p, sides);                          // boss on both bridges
      return {
        a: { pos: [0, m.a.pos[1] + HINGE1_BOSS_H, 0], n: [0, 1, 0], f: [0, 0, 1] },
        b: { pos: [0, m.b.pos[1] - HINGE1_BOSS_H, 0], n: [0, -1, 0], f: [0, 0, 1] },
      };
    }
    case "ball":
    case "ball1": {
      const d = ballDims(p);
      return {
        a: { pos: [0, -(d.drop + d.baseT), 0], n: [0, -1, 0], f: [0, 0, 1] },  // socket base underside
        b: { pos: [0, d.top + d.baseT, 0], n: [0, 1, 0], f: [0, 0, 1] },       // male plate top
      };
    }
    case "hinge3": {
      const d = hinge3Dims(p);
      return {
        a: { pos: [d.armLen + d.bridgeT + d.discT, 0, 0], n: [1, 0, 0], f: [0, 1, 0] },                       // mount-1 disc face, f = pin axis
        b: { pos: [0, 0, d.tongueLen + d.barrelLen + d.flangeT + d.capT], n: [0, 0, 1], f: [0, 1, 0] },       // mount-2 cap face, f = pin axis
      };
    }
    case "pivot":
    case "pivot1": {
      const d = pivotDims(p);
      return {
        a: { pos: [0, d.end, 0], n: [0, 1, 0], f: [0, 0, 1] },
        b: { pos: [0, -d.end, 0], n: [0, -1, 0], f: [0, 0, 1] },
      };
    }
  }
  return {};
}

// HINGE BLOCK — pin shaft = X axis through the local origin. The female (wide,
// opening down) U and the shared pin emit through the `fixed` channel; the male
// (narrow, opening up) U emits through `moving`, authored around the same
// origin. `sides.female` / `sides.male` override dims for one half only
// (e.g. shorter male arms) without touching the mechanism.
// RUNTIME pose (radians, separate from the modeling params): pose.swing
// rotates the male half about the pin. A consumer with extra geometry riding
// the male half can instead keep articulating the whole `moving` channel.
// ---- joint sub-assembly tagging ---------------------------------------------
// Every joint block brackets its primitive emissions so a consumer (e.g. an
// assembly animation) can group primitives by their owning joint. Nested
// blocks stack (hinge1Block calls hingeBlock); primitives emitted outside any
// block belong to the part body (null).
let _jseq = 0;
const _jstack = [];
const jbegin = () => _jstack.push(`j${++_jseq}`);
const jend = () => _jstack.pop();
export const currentJointGroup = () => _jstack[_jstack.length - 1] ?? null;
export const resetJointGroups = () => { _jseq = 0; };

export function hingeBlock(fixed, moving, p = {}, sides = {}, pose = {}) {
  jbegin();
  const base = { ...JOINT_DEFAULTS.hinge, ...p };
  const dF = hingeDims({ ...base, ...(sides.female || {}) });
  const dM = hingeDims({ ...base, ...(sides.male || {}) });
  const mv = pose.swing ? (g) => moving(rotX(g, pose.swing)) : moving;
  roundedU(fixed, dF, dF.gapW, false);   // female U
  roundedU(mv, dM, dM.gap, true);        // male U, nested
  // pin = bare shaft (no end caps), poking a touch past the female outer faces
  const halfSpan = dF.gapW / 2 + dF.armT + 0.05;
  fixed(translate(rotZ(cylinder(base.pinR, 2 * halfSpan, 20), -HPI), -halfSpan, 0, 0));
  jend();
}

// HINGE1 BLOCK — 2-axis joint: a rounded-U hinge (pin = X, the swing axis)
// with a cylinder boss on BOTH ends (boss axis = Y, the twist axis). The
// female boss stands up from its bridge, the male boss hangs down from its
// bridge; each plugs into a socket and spins about Y, the pin drives the
// swing. fixed = female U + pin + female boss, moving = male U + male boss.
// RUNTIME pose (radians), 3 rotations: pose.swing about the pin (X),
// pose.twistF spins the female half about its boss axis (Y) — the female is
// the PARENT, so twistF carries the whole male chain with it — and
// pose.twistM spins ONLY the male boss disc about its own axis (a turntable
// under the male bridge; the male U itself is rigid with the pin).
export function hinge1Block(fixed, moving, p = {}, sides = {}, pose = {}) {
  jbegin();
  const base = { ...JOINT_DEFAULTS.hinge, ...p };
  const fx = pose.twistF ? (g) => fixed(rotY(g, pose.twistF)) : fixed;
  const mv = (g) => {
    const h = pose.swing ? rotX(g, pose.swing) : g;
    moving(pose.twistF ? rotY(h, pose.twistF) : h);
  };
  const mvBoss = (g) => mv(pose.twistM ? rotY(g, pose.twistM) : g);
  hingeBlock(fx, mv, base, sides);
  const dF = hingeDims({ ...base, ...(sides.female || {}) });
  const dM = hingeDims({ ...base, ...(sides.male || {}) });
  const bossR = (w, depth) => Math.min(w, depth) * 0.45;
  fx(translate(cylinder(bossR(dF.gapW + 2 * dF.armT, dF.depth), HINGE1_BOSS_H, 24), 0, dF.bridgeY, 0));                       // boss up from the female bridge top
  mvBoss(translate(cylinder(bossR(dM.gap + 2 * dM.armT, dM.depth), HINGE1_BOSS_H, 24), 0, -dM.bridgeY - HINGE1_BOSS_H, 0));   // boss down from the male bridge bottom
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
  fixed(translate(box(q.baseW, q.baseT, q.baseW), 0, -q.drop - q.baseT / 2, 0));
  // cutHemisphere wall + cut are fractions of r
  fixed(translate(cutHemisphere(rOut, q.socketT / rOut, q.cut, 28, 8), 0, -q.drop, 0));
  mv(sphere(q.ballR, 20, 14));
  mv(cylinder(q.shaftR, q.top, 18));
  mv(translate(box(q.baseW * 0.75, q.baseT, q.baseW * 0.75), 0, q.top + q.baseT / 2, 0));
  jend();
}

// HINGE3 BLOCK — clevis + tongue, pin = Y axis (vertical shaft through the
// origin), so the halves swing relative to each other in the local XZ plane.
// fixed = clevis: two flat prongs (knuckles stacked on the pin) running +X
// into a THICK bridge block sized to carry base 1, a disc facing the X axis —
// plus the pin. moving = tongue: eye between the prongs running +Z to base 2,
// barrel + pivot flange + end cap discs facing the Z axis.
// RUNTIME pose (radians), 3 rotations: pose.swing about the pin (Y),
// pose.spinF spins the clevis half about the mount-1 disc axis (X) — the
// clevis is the PARENT (it holds the pin), so spinF carries the whole tongue
// chain with it — and pose.spinM spins ONLY the mount-2 barrel stack about
// its own axis (Z); the tongue eye stays rigid with the pin.
export function hinge3Block(fixed, moving, p = {}, pose = {}) {
  jbegin();
  const q = hinge3Dims(p);
  const fx = pose.spinF ? (g) => fixed(rotX(g, pose.spinF)) : fixed;
  const mv = (g) => {
    const h = pose.swing ? rotY(g, pose.swing) : g;
    moving(pose.spinF ? rotX(h, pose.spinF) : h);
  };
  const mvBase = (g) => mv(pose.spinM ? rotZ(g, pose.spinM) : g);
  // clevis prongs: D-plates flat in XZ, knuckles centered on the pin,
  // round end bulging -X, bodies running +X to the bridge
  for (const y of [q.gap / 2, -q.gap / 2 - q.armT])
    fx(translate(rotY(halfCylinderBox(q.knuckleR + 0.04, q.armT, q.armLen, 16), -HPI), 0, y, 0));
  // bridge: thick block joining the prongs, face sized to fit the disc base
  const face = Math.max(2 * (q.knuckleR + 0.04), 2 * q.disc1R + 0.06);
  const bh = Math.max(q.gap + 2 * q.armT, 2 * q.disc1R + 0.06);
  fx(translate(box(q.bridgeT, bh, face), q.armLen + q.bridgeT / 2, 0, 0));
  // base 1: disc on the bridge face, axis = X
  fx(translate(rotZ(cylinder(q.disc1R, q.discT, 24), -HPI), q.armLen + q.bridgeT, 0, 0));
  // pin: bare vertical shaft, poking a touch past the prong faces
  const halfSpan = q.gap / 2 + q.armT + 0.05;
  fx(translate(cylinder(q.pinR, 2 * halfSpan, 20), 0, -halfSpan, 0));
  // tongue: eye between the prongs, body running +Z
  mv(translate(rotY(halfCylinderBox(q.knuckleR, q.tongueT, q.tongueLen, 16), Math.PI), 0, -q.tongueT / 2, 0));
  // base 2: barrel + pivot flange + end cap, axis = Z (spinM turntable)
  mvBase(translate(rotX(cylinder(q.barrelR, q.barrelLen, 24), HPI), 0, 0, q.tongueLen));
  mvBase(translate(rotX(cylinder(q.disc1R, q.flangeT, 24), HPI), 0, 0, q.tongueLen + q.barrelLen));
  mvBase(translate(rotX(cylinder(q.barrelR + 0.02, q.capT, 24), HPI), 0, 0, q.tongueLen + q.barrelLen + q.flangeT));
  jend();
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
    at(cylinder(q.flangeR, q.flangeT, 28), hb);                      // flange ring
    at(cylinder(q.neckR, q.neckLen, 20), hb + q.flangeT);            // neck
    at(cylinder(q.capR, q.capT, 24), hb + q.flangeT + q.neckLen);    // end cap
  }
  jend();
}

// ---- the parts ----------------------------------------------------------------

// fixed joint proportions the dragon parts are modeled around — shared with
// chainSpec() below so the rig computes the same mounting numbers the
// builders bake into the geometry.
const SEG_JP = { ballR: 0.26, socketT: 0.09, shaftLen: 0.14, baseT: 0.12 };
const SEG2_JP = { ballR: 0.24, socketT: 0.08, shaftLen: 0.13, baseT: 0.12 };
const TAIL_JP = { ballR: 0.24, socketT: 0.08, shaftLen: 0.13, baseT: 0.12 };
const ARM_JP = { tongueT: 0.09, armT: 0.055, armLen: 0.2, barrelR: 0.1, barrelLen: 0.16, pinR: 0.045, tongueLen: 0.2 };
const LEG_JP = { tongueT: 0.11, armT: 0.065, armLen: 0.24, barrelR: 0.12, barrelLen: 0.18, pinR: 0.055, tongueLen: 0.22 };

// head modeling anchors, shared by the builder, partSlots and (via the jaw
// slot) the rig — the single source for where things mate on the head
const HEAD_NECK = [0, 0.55, -1.0];      // where the mating neck ball CENTER sits, behind the skull
const HEAD_JAW_PIN = [0, 0.02, -0.12];  // jaw hinge pin (X axis) below the skull

// ---- per-part layout ---------------------------------------------------------
// The numbers a part builder bakes into its geometry, computed ONCE per part
// kind and consumed by BOTH the builder and partSlots — slots can never drift
// from the meshes. Chain parts seat a ball joint: z0 = where the body starts
// (clear of the socket base plate), reach = ball center -> male plate top,
// front = the male ball center. Limbs seat a hinge3 shoulder/hip: the pivot
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
  const jm = jointMounts("hinge3", ARM_JP);
  const ey = 0.4 + p.foreLen + p.clawR;            // elbow pin height
  const sdrop = jm.b.pos[2];                       // mount-2 cap face below the pivot
  return { jp: ARM_JP, jm, ey, sdrop, sy: ey + p.upperLen + sdrop };  // sy = shoulder pin height
}

function legLayout(p) {
  const jm = jointMounts("hinge3", LEG_JP);
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
  for (const s of [1, -1])                                     // eyeballs in the holes
    add(translate(sphere(p.eyeR, 16, 10), s * (W * 0.21 + p.eyeR * 0.55), 0.55, 0.3));
  // brow: slope box over the window, dropping toward the snout
  add(translate(box(W, 0.26, 0.5, 0.62), 0, 1.03, 0.15));
  // snout: slope-top box, nose end lower
  add(translate(box(W * 0.65, 0.5, p.snoutLen, 0.44), 0, 0.62, 0.5 + p.snoutLen / 2));
  // nose tip: small steep slope block
  add(translate(box(W * 0.45, 0.24, 0.18, 0.5), 0, 0.49, 0.5 + p.snoutLen + 0.09));
  // upper fangs: hang from the snout underside near the tip
  for (const x of [-W * 0.22, W * 0.22])
    add(translate(box(0.08, 0.16, 0.08), x, 0.31, 0.5 + p.snoutLen - 0.1));

  // JAW HINGE — a real hinge2-style joint drives the jaw. Pin axis = X through
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

  // antlers: three axis-aligned segments per side, extending BACK along -Z:
  // a base mount seated flat on the roof, a long box flush against its rear
  // face, and a full-wedge pointy tip (exact 180deg turn so the point aims -Z).
  for (const s of [1, -1]) {
    const L = p.hornLen;
    const x = s * W * 0.32;
    add(translate(box(0.3, 0.3, 0.36), x, 1.05, -0.64));                     // base mount on the roof
    add(translate(box(0.2, 0.24, L), x, 1.1, -0.82 - L / 2));                // long shaft along -Z
    add(translate(rotY(box(0.2, 0.24, 0.55, 0.96), Math.PI), x, 1.1, -0.82 - L - 0.275)); // pointy tip
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
  ballBlock(
    (g) => add(translate(rotX(g, -HPI), 0, cy, 0)),      // female socket, rear
    (g) => add(translate(rotX(g, -HPI), 0, cy, front)),  // male ball, front
    jp,
  );
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
  // spine fins: QUARTER discs standing on the back — arc rising from the
  // front like a lego curved slope, vertical trailing edge at the rear
  for (const fz of [len * 0.3, len * 0.7]) {
    const g = rotZ(quarterCylinder(p.finR, 0.12, 14), HPI);
    add(translate(g, 0.06, cy + R - 0.05, z0 + fz));
  }
}

// DRAGON BODY SEGMENT TYPE 2 — tapered variant: the core is a CUT CONE lying
// along the spine (wide at the front, narrow at the rear), so a chain of them
// forms a shrinking neck or tail run. Same joint scheme as type 1: female
// ball socket at the rear origin, male ball sticking past the front face.
function bodySegment2(add, p) {
  const len = p.segLen, R0 = p.rRear, R1 = p.rFront;
  const { jp, cy, z0, front } = bodySegment2Layout(p);
  ballBlock(
    (g) => add(translate(rotX(g, -HPI), 0, cy, 0)),      // female socket, rear
    (g) => add(translate(rotX(g, -HPI), 0, cy, front)),  // male ball, front
    jp,
  );
  // core: cut cone along the spine — narrow base at the rear, wide top front
  add(translate(rotX(coneCut(R0, R1, len, 24), HPI), 0, cy, z0));
  // spine fins: QUARTER discs riding the local cone radius — arc rising from
  // the front, vertical trailing edge at the rear
  for (const f of [0.3, 0.7]) {
    const rl = R0 + (R1 - R0) * f;
    const g = rotZ(quarterCylinder(p.finR, 0.12, 14), HPI);
    add(translate(g, 0.06, cy + rl - 0.05, z0 + f * len));
  }
}

// DRAGON ARM — parts chained by joint blocks. At the top the hinge3 block as
// the shoulder: disc base up into the body, pin horizontal, tongue pre-swung
// about the pin so its barrel base drops into the upper arm.
// Elbow = hinge block driving the forearm (elbowBend swings it about the
// pin), then wrist barrel and a claw of three quarter-disc talons.
// RUNTIME pose: pose.swing / pose.spinF / pose.spinM drive the
// shoulder hinge3 — the whole limb hangs off mount 2, so it rides the same
// rotation chain as the joint's own moving half (one bone per rotation, every
// primitive follows exactly one bone) — and pose.elbow overrides elbowBend
// (degrees, UI slider).
function arm(add, p, pose = {}) {
  const bend = pose.elbow ?? rad(p.elbowBend);
  const sw = pose.swing || 0, sf = pose.spinF || 0, sm = pose.spinM || 0;
  // shoulder joint, deliberately small next to the limb boxes
  const { jp, ey, sdrop, sy } = armLayout(p);
  // whole joint rotX(HPI): pin -> Z, clevis runs +X so mount 1 (disc) faces
  // RIGHT into the body flank, mount 2 (barrel + discs) lands on the limb top
  const seat = (g) => add(translate(rotX(g, HPI), 0, sy, 0));
  // limb channel: everything below the shoulder is authored RELATIVE TO THE
  // SHOULDER PIVOT and follows the joint's full moving chain — spinM (barrel
  // turntable) -> swing (pin) -> spinF (parent disc) composed in the joint's
  // local frame, then seated exactly like the joint itself
  const limb = (g) => {
    let h = rotX(g, -HPI);            // part frame -> joint local
    if (sm) h = rotZ(h, sm);
    if (sw) h = rotY(h, sw);
    if (sf) h = rotX(h, sf);
    seat(h);
  };
  hinge3Block(seat, seat, jp, { swing: sw, spinF: sf, spinM: sm });
  limb(translate(box(0.38, p.upperLen, 0.42), 0, -sdrop - p.upperLen / 2, 0));  // upper arm
  // elbow: female + pin fixed to the upper arm, male swings with the forearm
  const rey = ey - sy;                                              // elbow, shoulder-relative
  const at = (g) => limb(translate(g, 0, rey, 0));
  const swing = (g) => limb(translate(rotX(g, -bend), 0, rey, 0));  // bend forward
  hingeBlock(at, swing, { gap: 0.14, armT: 0.07, armH: 0.3, depth: 0.28, pinR: 0.06 });
  // forearm + wrist, authored around the elbow pin, routed through the swing
  swing(translate(box(0.3, p.foreLen, 0.34), 0, -(0.3 + p.foreLen / 2), 0));
  const wy = -(0.35 + p.foreLen);
  swing(translate(rotZ(cylinder(0.12, 0.36, 18), -HPI), -0.18, wy, 0));   // wrist barrel
  // claw: quarter-disc talons — straight edges down + forward, arc = the blade
  for (const x of [-0.14, 0, 0.14])
    swing(translate(rotZ(quarterCylinder(p.clawR, 0.08, 10), -HPI), x - 0.04, wy, 0.05));
}

// DRAGON LEG — same principle, chunkier: hinge3 block as the hip (disc base
// up into the body, barrel base down into the thigh), hinge block knee
// driving the shin (kneeBend swings it back), ankle barrel, flat foot with
// quarter-disc toe claws.
// RUNTIME pose, same scheme as the arm: pose.swing/spinF/spinM
// drive the hip hinge3 (the limb rides the moving chain), pose.knee
// overrides kneeBend (degrees, UI slider).
function leg(add, p, pose = {}) {
  const bend = pose.knee ?? rad(p.kneeBend);
  const sw = pose.swing || 0, sf = pose.spinF || 0, sm = pose.spinM || 0;
  const { jp, ky, hdrop, hy } = legLayout(p);
  // same orientation as the arm's shoulder: mount 1 (disc) facing right into
  // the body flank, pin along Z, mount 2 (barrel + discs) onto the thigh top
  const seat = (g) => add(translate(rotX(g, HPI), 0, hy, 0));
  const limb = (g) => {
    let h = rotX(g, -HPI);            // part frame -> joint local (see arm)
    if (sm) h = rotZ(h, sm);
    if (sw) h = rotY(h, sw);
    if (sf) h = rotX(h, sf);
    seat(h);
  };
  hinge3Block(seat, seat, jp, { swing: sw, spinF: sf, spinM: sm });
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
  ballBlock(() => {}, (g) => add(translate(rotX(g, -HPI), 0, cy, front)), jp);
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

// catalog views of the joint blocks — pose sliders (degrees) drive the
// runtime rotations, the modeling params only shape the geometry
function hinge2(add, p, pose = {}) {
  hingeBlock(add, add, p, {}, { swing: rad(pose.swing) });
}

function hinge1(add, p, pose = {}) {
  hinge1Block(add, add, p, {}, { swing: rad(pose.swing), twistF: rad(pose.twistF), twistM: rad(pose.twistM) });
}

function ball1(add, p, pose = {}) {
  ballBlock(add, add, p, { rx: rad(pose.rx), ry: rad(pose.ry), rz: rad(pose.rz) });
}

function hinge3(add, p, pose = {}) {
  hinge3Block(add, add, p, { swing: rad(pose.swing), spinF: rad(pose.spinF), spinM: rad(pose.spinM) });
}

function pivot1(add, p, pose = {}) {
  pivotBlock(add, p, { spinA: rad(pose.spinA), spinB: rad(pose.spinB) });
}

export const PART_BUILDERS = { head, bodySegment, bodySegment2, arm, leg, tail, hinge1, hinge2, hinge3, pivot1, ball1 };
export const PART_NAMES = Object.keys(PART_BUILDERS);

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

export function partModel(name, seed = 1, params = null, pose = null) {
  const key = PART_BUILDERS[name] ? name : PART_NAMES[0];
  const b = PART_BUILDERS[key];
  const p = { ...PART_PARAMS[key], ...(params || {}) };
  return { ...collect(b, seed, p, pose || {}), name };
}

// raw build for external assemblers (the dragon rig): the caller supplies the
// add() sink and applies its own placement transform — parts stay the single
// source of geometry, the rig never re-models them
export function buildPart(name, add, params = null, pose = null) {
  PART_BUILDERS[name](add, { ...PART_PARAMS[name], ...(params || {}) }, pose || {});
}

// PART MOUNT SLOTS — parts expose slots the same way joints do: each slot is
// { pos, n, f } (origin + outward normal + forward tangent = a full coordinate
// system) in the part's LOCAL frame, DERIVED from the mount slots of the
// joints the part is built on (jointMounts), so the sockets and balls line up
// exactly with the emitted geometry. A rig connects two parts by MATCHING a
// slot on each: positions coincide, forwards align, normals oppose.
export function partSlots(name, params = null) {
  const p = { ...PART_PARAMS[name], ...(params || {}) };
  switch (name) {
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
  return {};
}

export function primitiveModel(name, params, seed = 1) {
  const build = PRIM_BUILD[name] || PRIM_BUILD.cylinder;
  const p = { ...PRIM_PARAMS[name], ...(params || {}) };
  return { ...collect((add) => add(build(p)), seed), name };
}
