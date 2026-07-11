// ATLAS PART KIT — a standing humanoid: helmet, torso, pelvis, upper arm,
// forearm, wrist, palm, finger, thigh, shin, foot. Same discipline as the
// dragon kit, on the same joint engine (joints.js).
import {
  box, cylinder, coneCut, halfCylinder, rotX, rotY, rotZ, translate,
} from "../primitives.js";
import { rad } from "../../math/scalar.js";
import {
  HPI, jointMounts, hingeDims, ballDims, hinge2MidY,
  ballBlock, hingeBlock, hinge1Block,
} from "../joints.js";
import { createKit } from "../kit.js";

export const ATLAS_PARAMS = {
  head: { headR: 0.28, headD: 0.56, innerR: 0.24 },
  torso: { chestW: 1.15, chestH: 0.95, chestD: 0.68 },
  pelvis: { hipW: 0.72, hipH: 0.25 },
  upperArm: { len: 0.3, w: 0.3 },
  forearm: { len: 0.24, w: 0.26 },
  wrist: {},
  palm: { w: 0.26, h: 0.26, d: 0.24 },
  finger: { digitLen: 0.16, w: 0.12, curl: 18 },
  thigh: { len: 0.56, w: 0.38 },
  shin: { len: 0.6, w: 0.32 },
  foot: { len: 0.62, w: 0.32, heelD: 0.14, heelCapD: 0.14 },
};

// Humanoid parts, same discipline as the dragon kit: a part embeds the FIXED
// half of every joint it offers to children (ball socket / clevis + pin at its
// distal slots) and the MOVING half of the joint it plugs into its parent with
// (ball stud / clevis tang at its mount slot). The two halves of one joint live
// in two parts but share a JP constant below, so they always align when the rig
// glues the slots; the rig bone at the match point supplies the rotation the
// mechanism absorbs.
//
// Local frame per part: mount slot = the local origin (ball center / pin
// axis), body hanging along -Y, +Z forward — except head and torso, whose
// bodies grow +Y out of their mount ball.

const ATLAS_JP = {
  // short neck: disc flanges on BOTH halves (no square plate under the torso socket)
  neck: { ballR: 0.12, socketT: 0.06, studLen: 0.04, flangeW: 0.34, flangeT: 0.05, base: "disc" },
  // waist = ball (3 DOF, like the neck but heavier): the pelvis holds the
  // socket, the torso brings the ball stud and pivots on it — twist about Y,
  // and bend/tilt about X/Z, which a plain Y pivot could never give it
  waist: { ballR: 0.17, socketT: 0.07, studLen: 0.05, flangeW: 0.44, flangeT: 0.06, base: "disc" },
  // every atlas hinge runs pinOut 0: the pin stops at the outboard lug faces
  // instead of poking out of the clevis (hingeDims still leaves it a hair proud)
  // shoulder / hip = hinge1 block (solid tang + disc flanges, like the dragon
  // limbs): the body part holds the clevis + pin, the limb hangs off the tang's
  // flange disc
  shoulder: { jaw: 0.1, lugT: 0.06, lugL: 0.2, lugD: 0.22, pinR: 0.05, pinOut: 0 },
  hip: { jaw: 0.09, lugT: 0.055, lugL: 0.2, lugD: 0.2, pinR: 0.045, pinOut: 0 },
  // arm joints run a SOLID tang on a tight clearance — the forearm shroud
  // covers them, so the mechanism should read as machined, not loose.
  // wrist = hinge2 (two hinge1 stages in series, pins X then Z); the same
  // params size BOTH stages across forearm / wrist / palm
  wrist: { jaw: 0.1, lugT: 0.05, lugL: 0.2, lugD: 0.2, pinR: 0.04, clr: 0.008, tang: 1, pinOut: 0 },
  // the elbow jaw is sized so the tang — and the forearm box that continues it
  // — is exactly the forearm's width (parts.atlas.forearm.w)
  elbow: { jaw: 0.14, lugT: 0.06, lugL: 0.2, lugD: 0.24, pinR: 0.05, clr: 0.008, tang: 1, pinOut: 0 },
  knee: { jaw: 0.15, lugT: 0.07, lugL: 0.2, lugD: 0.3, pinR: 0.06, tang: 1, pinOut: 0, disc: 1 },
  ankle: { jaw: 0.14, lugT: 0.065, lugL: 0.2, lugD: 0.26, pinR: 0.055, tang: 1, pinOut: 0, disc: 1 },
};

// ball stack extents off ballDims — the single numbers layouts stack with:
// ballTop = ball center -> stud flange outer face, ballSeat = ball center ->
// socket flange outer face
const ballTop = (jp) => ballDims(jp).top + jp.flangeT;
const ballSeat = (jp) => ballDims(jp).drop + jp.flangeT;
const hingeReach = (jp) => hingeDims(jp).reach;   // pin -> flange outer face

// ball socket seated at `pos`; `orient` re-aims the mouth (default opens +Y,
// the child sits above)
function socketAt(add, jp, pos, orient = null) {
  ballBlock((g) => add(translate(orient ? orient(g) : g, pos[0], pos[1], pos[2])),
    () => {}, jp);
}
// ball stud at the part origin; dir = -1 runs the shank down into the part's
// own body (parts hanging below their parent), +1 runs it up
function ballStud(add, jp, dir = -1) {
  ballBlock(() => {}, (g) => add(dir < 0 ? rotX(g, Math.PI) : g), jp);
}
// hinge halves for chained parts: the parent emits clevis + pin at its distal
// slot, the child emits the tang (or nested clevis) at its mount origin.
// `sides` passes through (the wrist's stage-A tang drops its flange — see wrist()).
const clevisAt = (add, jp, y, sides = {}) =>
  hingeBlock((g) => add(translate(g, 0, y, 0)), () => {}, jp, sides);
const tangAt = (add, jp, sides = {}) => hingeBlock(() => {}, add, jp, sides);

// HINGE SHROUD — a hollow box (4 planks, open top and bottom) housing a
// clevis: two planks outside the clevis lugs on the pin axis, two clearing the
// lugs' depth. It runs from `top` down to the PIN PLANE and no further: the
// moving half hangs below its pin and only its knuckle disc (radius knuckleR,
// a body of revolution) reaches above it, so the hinge keeps its full swing
// however far the joint bends.
function hingeShroud(add, jp, pinY, top, t = 0.035) {
  const d = hingeDims(jp);
  const x = d.jawW / 2 + d.lugT + d.clr + t / 2;   // outside the clevis lugs
  const z = d.knuckleR + d.clr + t / 2;            // outside the knuckle sweep
  const h = top - pinY, cy = pinY + h / 2;
  for (const s of [1, -1]) {
    add(translate(box(t, h, 2 * z + t), s * x, cy, 0));       // pin-axis end planks
    add(translate(box(2 * x + t, h, t), 0, cy, s * z));       // front / back planks
  }
}

function torsoLayout(p) {
  const y0 = ballTop(ATLAS_JP.waist);                 // ball center -> stud flange top face
  const taperH = 0.13;                                // waist block: short, no belly
  const chestY = y0 + taperH - 0.04;                  // chest slab base
  const top = chestY + p.chestH;
  const d = hingeDims(ATLAS_JP.shoulder);
  return {
    y0, taperH, chestY, top,
    r: p.chestD / 2,                                  // flank half-cylinder radius = half the chest depth
    neckY: top + ballSeat(ATLAS_JP.neck),             // neck ball center
    // shoulder pins: the clevis flange disc lands on the chest flank
    sx: p.chestW / 2 + jointMounts("hinge1", ATLAS_JP.shoulder).a.pos[0],
    sy: top - 0.3,
    // shoulder shroud: a cut cone flaring out of the chest flank into the
    // hinge's flange disc, so the joint grows out of the torso, not off it
    discR: Math.hypot(d.jawW + 2 * d.lugT, d.lugD) / 2,   // hinge1 clevis flange disc radius
    coneLen: 0.14,
  };
}

function pelvisLayout(p) {
  const discT = 0.14, domeW = p.hipW * 0.6;
  const discY = -ballSeat(ATLAS_JP.waist) - discT;    // disc bottom plane, under the socket
  return {
    discT, domeW, discY,
    discR: p.hipW / 2,
    hipX: domeW / 2 + jointMounts("hinge1", ATLAS_JP.hip).a.pos[0],
    hipY: discY - p.hipH * 0.45,                      // hip shoulder pins
  };
}

function upperArmLayout(p) {
  // the shoulder tang's flange disc drops mount-2 deep into the arm
  const y0 = -jointMounts("hinge1", ATLAS_JP.shoulder).b.pos[2];
  return { y0, elbowY: y0 - p.len - hingeReach(ATLAS_JP.elbow) };
}

function forearmLayout(p) {
  const d = hingeDims(ATLAS_JP.elbow);
  const y0 = -d.reach;                                // elbow tang flange face
  return {
    y0,
    // the forearm box RUNS UP INTO the elbow clevis and takes the place of the
    // tang's flange: it is narrower than the clevis jaw, so it swings with the
    // tang, and it stops a clearance short of the pin, leaving only the tang's
    // knuckle disc proud of it
    boxTop: -(d.pinR + 2 * d.clr),
    boxBot: y0 - p.len - 0.02,
    wristY: y0 - p.len - hingeReach(ATLAS_JP.wrist),  // hinge2 stage-A pin
  };
}

// hinge2 wrist stacking: the stage-B pin sits two lug shanks + the ONE shared
// middle flange below stage A — the same drop hinge2Block bakes in
const wristMidY = () => hinge2MidY(ATLAS_JP.wrist);

function palmLayout(p) {
  const fw = ATLAS_PARAMS.finger.w;              // fingers hang off the side faces
  const y0 = 0;                                       // origin = the stage-B tang disc face
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
  // the hip tang's flange disc drops mount-2 deep into the thigh
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
// one sole plane); rearward, the heel: a base box continuing the sole and a
// slope box tapering down behind it. p.len spans the ankle pin to the toe tip.
const FOOT_SLOPE = 0.55, FOOT_H = 0.2, TOE_D = 0.2, ANKLE_D = 0.24;

function footLayout(p) {
  const soleY = -hingeReach(ATLAS_JP.ankle) - 0.02;   // foot top plane, at the ankle
  const z0 = ANKLE_D / 2;                             // ankle base front face
  const footD = p.len - z0 - TOE_D;                   // slope run, ankle base -> toe
  return {
    soleY, footD,
    midY: soleY - FOOT_H / 2,                         // sole slab center height
    toeH: FOOT_H * (1 - FOOT_SLOPE),
    footZ: z0 + footD / 2,
    toeZ: z0 + footD + TOE_D / 2,
    heelZ: -z0 - p.heelD / 2,                         // heel base, off the ankle base rear face
    heelCapZ: -z0 - p.heelD - p.heelCapD / 2,
  };
}

// ATLAS HELMET — a FRONT-FACING CYLINDER drum: axis = +Z, the flat disc is
// the face, wearing two concentric proud rings (outer rim + a smaller inner
// one), ear pods on the drum sides. Neck ball STUD below (the torso supplies
// the socket); ball center = origin.
function helmet(add, p) {
  const y0 = ballTop(ATLAS_JP.neck), R = p.headR;
  ballStud(add, ATLAS_JP.neck, +1);                   // shank up into the helmet
  add(translate(cylinder(0.14, 0.05, 14), 0, y0, 0));
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
// waist box below it — NO belly section, the torso sits directly on the pelvis.
// Joints offered: neck socket (up), a seat for each shoulder hinge on the
// flanks, and the waist BALL's STUD below (the pelvis holds the socket; the
// torso twists AND bends on it). Ball center = the local origin.
function torso(add, p) {
  const L = torsoLayout(p);
  ballStud(add, ATLAS_JP.waist, +1);                                          // waist stud, shank up
  // waist block: a plain box bridging the stud's flange up to the chest slab
  add(translate(box(p.chestW * 0.55, L.taperH + 0.06, p.chestD * 0.75), 0, L.y0 + L.taperH / 2, 0));
  // chest slab: core box + rounded vertical flanks, depth = flank diameter
  const cw = p.chestW - 2 * L.r;
  add(translate(box(cw, p.chestH, 2 * L.r), 0, L.chestY + p.chestH / 2, 0));
  for (const s of [1, -1])
    add(translate(rotY(halfCylinder(L.r, p.chestH, 16), s * HPI), s * cw / 2, L.chestY, 0));
  add(translate(box(cw * 0.85, p.chestH * 0.72, 0.06), 0, L.chestY + p.chestH * 0.56, L.r + 0.01));
  add(translate(cylinder(0.17, 0.1, 16), 0, L.top, 0));
  socketAt(add, ATLAS_JP.neck, [0, L.neckY, 0]);      // neck socket, mouth up
  // shoulders: the torso only offers the SEAT — a cut cone flaring out of the
  // flank, its rim the face the arm's clevis flange disc lands on. The whole
  // hinge (both halves) belongs to the upper arm. rotZ turns the cone's +Y axis
  // onto the outward X.
  for (const s of [1, -1])
    add(translate(rotZ(coneCut(L.discR + 0.07, L.discR, L.coneLen, 24), -s * HPI),
      s * (p.chestW / 2 - L.coneLen), L.sy, 0));
}

// ATLAS PELVIS — waist BALL socket on top (3 DOF; the torso brings the stud), a
// flat DISC under it and a HALF-CYLINDER shell (axis X, dome down) as the body,
// a hip clevis + pin on each of the dome's flat end faces. Rig root: the waist
// ball center is the local origin.
function pelvis(add, p) {
  const L = pelvisLayout(p);
  socketAt(add, ATLAS_JP.waist, [0, 0, 0]);                                   // waist socket, mouth up
  add(translate(cylinder(L.discR, L.discT, 28), 0, L.discY, 0));
  add(translate(rotY(rotX(halfCylinder(p.hipH, L.domeW, 20), HPI), HPI), -L.domeW / 2, L.discY, 0)); // dome shell, flat up
  // hips: hinge1 clevis + pin per side, same seat scheme as the shoulders
  for (const s of [1, -1]) {
    const seat = (g) => {
      let h = rotX(g, HPI);
      if (s > 0) h = rotY(h, Math.PI);
      add(translate(h, s * L.hipX, L.hipY, 0));
    };
    hinge1Block(seat, () => {}, ATLAS_JP.hip);
  }
}

// ATLAS UPPER ARM — the shoulder's MOVING half on top (solid tang + flange disc
// seated so the disc drops down into the arm; the torso holds the clevis + pin),
// biceps cylinder, elbow clevis + pin at the bottom.
//
// The arm owns the WHOLE shoulder hinge1 — the torso only offers the cone the
// mount-1 disc seats on. RUNTIME pose (radians): pose.swing rotates the tang
// about the pin, and everything below the shoulder rides that swing.
// The joint's OTHER two DOFs (spinF = the mount-1 clevis disc, spinM = the
// mount-2 turntable) are rigid rotations of the whole part, so the rig hands
// them to the bone that places it rather than to this pose channel.
function upperArm(add, p, pose = {}) {
  const L = upperArmLayout(p);
  const h = p.len + 0.08;
  const sw = pose.swing || 0;
  const seat = (g) => add(rotX(g, HPI));         // joint local -> part frame
  // limb channel: authored in the part frame, routed back through the joint's
  // local frame so it turns about the PIN, exactly like the tang
  const limb = (g) => (sw ? seat(rotY(rotX(g, -HPI), sw)) : add(g));
  hinge1Block(seat, seat, ATLAS_JP.shoulder, { swing: sw });
  limb(translate(cylinder(p.w / 2, h, 20), 0, L.y0 + 0.06 - h, 0));
  limb(translate(rotZ(cylinder(p.w * 0.4, p.w + 0.14, 14), -HPI), -(p.w + 0.14) / 2, L.y0 - p.len, 0));
  clevisAt(limb, ATLAS_JP.elbow, L.elbowY);
}

// ATLAS FOREARM — a box running all the way up into the elbow clevis, where it
// meets the solid tang (whose flange it replaces), and down to the hinge2
// wrist's STAGE-A clevis + pin (pin = X, the bend axis); the wrist link brings
// that stage's tang. A 4-plank shroud sleeves the box down to the wrist pin,
// boxing the clevis lugs in without fouling the swing; it starts SHROUD_DROP
// below the box top, leaving the elbow end bare.
const SHROUD_DROP = 0.1;

function forearm(add, p) {
  const L = forearmLayout(p);
  tangAt(add, ATLAS_JP.elbow, { male: { noFlange: 1 } });   // the box IS the tang's flange
  add(translate(box(p.w, L.boxTop - L.boxBot, p.w * 0.9), 0, (L.boxTop + L.boxBot) / 2, 0));
  hingeShroud(add, ATLAS_JP.wrist, L.wristY, L.boxTop - SHROUD_DROP);
  clevisAt(add, ATLAS_JP.wrist, L.wristY);
}

// ATLAS WRIST — the MIDDLE link (the intermediate yoke) of the hinge2 wrist,
// two hinge1 stages in series: the stage-A tang at the origin plugging the
// forearm's clevis (pin = X, bend), and directly below the WHOLE stage-B hinge
// — clevis + pin turned 90° (pin = Z, tilt) and the tang riding it. Both stages
// SHARE stage B's flange, so the stage-A tang emits none — same scheme as
// hinge2Block. The stage-B tang's flange DISC is what the palm bolts to, and
// the palm's twist is that disc turning — the tang itself never twists.
// RUNTIME pose (radians): pose.tilt swings the stage-B tang about its pin.
function wrist(add, p, pose = {}) {
  tangAt(add, ATLAS_JP.wrist, { male: { noFlange: 1 } });
  // rotY(HPI) turns the authored X pin onto -Z, so the swing is negated to
  // make a positive tilt read as a +Z rotation — same as hinge2Block
  const at = (g) => add(translate(rotY(g, HPI), 0, wristMidY(), 0));
  hingeBlock(at, at, ATLAS_JP.wrist,
    { female: { disc: 1 }, male: { disc: 1 } }, { swing: -(pose.tilt || 0) });
}

// ATLAS PALM — a GRIPPER hand: a plain BLOCK sized to the forearm, bolted to
// the wrist's stage-B tang disc (the origin) — the block twists WITH that
// disc, which is the wrist's third DOF. No knuckle clevises: the fingers hang
// off the block's front and back SIDE FACES, each bringing its own knuckle
// pin — one behind (single finger), two in front (finger pair), pins = X, so
// the prongs curl toward each other.
function palm(add, p) {
  const L = palmLayout(p);
  add(translate(box(p.w, p.h, p.d), 0, L.blockY, 0));
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

// ATLAS THIGH — the hip's MOVING half on top (solid tang + flange disc dropping
// into the thigh; the pelvis holds the clevis + pin), thigh box, knee clevis +
// pin below.
function thigh(add, p) {
  const L = thighLayout(p);
  hinge1Block(() => {}, (g) => add(rotX(g, HPI)), ATLAS_JP.hip);
  add(translate(box(p.w, p.len + 0.1, p.w + 0.04), 0, L.y0 - (p.len + 0.1) / 2 + 0.07, 0));
  add(translate(rotZ(cylinder(p.w * 0.38, p.w + 0.16, 14), -HPI), -(p.w + 0.16) / 2, L.y0 - p.len, 0));
  clevisAt(add, ATLAS_JP.knee, L.kneeY);
}

// ATLAS SHIN — knee tang on top, shin barrel, ankle clevis + pin at the bottom.
function shin(add, p) {
  const L = shinLayout(p);
  const h = p.len + 0.06;
  tangAt(add, ATLAS_JP.knee);
  add(translate(cylinder(p.w / 2, h, 20), 0, L.y0 + 0.04 - h, 0));
  clevisAt(add, ATLAS_JP.ankle, L.ankleY);
}

// ATLAS FOOT — the solid ankle tang standing on the ANKLE BASE box. The foot
// proper (a slope box) and the toes (a flat box) run forward off it; the heel
// (a base box, then a slope box tapering down) runs back off it. Every piece
// shares FOOT_H, so the sole stays one plane from the toe to the heel.
function foot(add, p) {
  const L = footLayout(p);
  tangAt(add, ATLAS_JP.ankle);
  add(translate(box(p.w, FOOT_H, ANKLE_D), 0, L.midY, 0));
  add(translate(box(p.w, FOOT_H, L.footD, FOOT_SLOPE), 0, L.midY, L.footZ));
  add(translate(box(p.w * 0.92, L.toeH, TOE_D), 0, L.soleY - FOOT_H + L.toeH / 2, L.toeZ));
  add(translate(box(p.w, FOOT_H, p.heelD), 0, L.midY, L.heelZ));
  add(translate(rotY(box(p.w, FOOT_H, p.heelCapD, 0.7), Math.PI), 0, L.midY, L.heelCapZ));
}

// PART MOUNT SLOTS (see the dragon kit for the contract): mount = the part's
// own moving joint half (n points at the parent), the rest = fixed halves
// offered to children.
function atlasSlots(name, p) {
  switch (name) {
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
        // shoulder tang eye (the pin bore) = the origin; n points at the torso flank
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
        pin: { pos: [0, wristMidY(), 0], n: [0, -1, 0], f: [0, 0, 1] }, // stage-B pin (Z, tilt)
        // stage-B tang disc face, at rest swing — what the palm bolts to
        out: { pos: [0, wristMidY() - hingeReach(ATLAS_JP.wrist), 0], n: [0, -1, 0], f: [0, 0, 1] },
      };
    case "palm": {
      const L = palmLayout(p);
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [0, 0, 1] },          // on the stage-B tang disc
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
        // hip tang eye (the pin bore) = the origin; n points at the pelvis flank
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
    case "foot":
      return { mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0] } };
  }
  return {};
}

export const ATLAS_KIT = createKit({
  params: ATLAS_PARAMS,
  builders: { head: helmet, torso, pelvis, upperArm, forearm, wrist, palm, finger, thigh, shin, foot },
  slots: atlasSlots,
});
