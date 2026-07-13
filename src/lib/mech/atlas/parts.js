// ATLAS PART KIT — a standing humanoid: helmet, torso, pelvis, upper arm, forearm,
// palm, finger digit, thigh, shin, foot.
//
// Same discipline as the dragon kit: a part is a BODY and its SLOTS and models no
// joint — every rotation happens inside a joint assemble puts on the slot offering it.
//
// Local frame: the `mount` slot is the part's bolting face and its ORIGIN, the body
// hangs along -Y from it, +Z forward — except the head and torso, which grow +Y up.
import {
  box, cylinder, coneCut, halfCylinder, rotX, rotY, rotZ, translate,
} from "../primitives.js";
import { HPI, hingeDims, hingeDiscR } from "../joints.js";
import { createKit } from "../kit.js";

export const ATLAS_PARAMS = {
  head: { headR: 0.28, headD: 0.56, innerR: 0.24 },
  torso: { chestW: 1.15, chestH: 0.95, chestD: 0.68 },
  pelvis: { hipW: 0.72, hipH: 0.25 },
  upperArm: { len: 0.3, w: 0.3 },
  forearm: { len: 0.24, w: 0.26 },
  palm: { w: 0.26, h: 0.26, d: 0.24 },
  digit: { len: 0.12, w: 0.1 },
  thigh: { len: 0.56, w: 0.38 },
  shin: { len: 0.6, w: 0.32 },
  foot: { len: 0.62, w: 0.32, heelD: 0.14, heelCapD: 0.14 },
};

// The joints the atlas is bolted together with. Declared once; the assemble
// engine builds the female half on the part that offers the slot and the male
// half on the child, so the two can never drift apart.
export const ATLAS_JOINTS = {
  // short neck: disc flanges on BOTH halves (no square plate under the socket)
  neck: { kind: "ball", p: { ballR: 0.12, socketT: 0.06, studLen: 0.04, flangeW: 0.34, flangeT: 0.05, base: "disc" } },
  // waist = ball (3 DOF): the pelvis holds the socket, the torso brings the stud
  // and pivots on it — twist about Y, bend/tilt about X/Z
  waist: { kind: "ball", p: { ballR: 0.17, socketT: 0.07, studLen: 0.05, flangeW: 0.44, flangeT: 0.06, base: "disc" } },
  // every atlas hinge runs pinOut 0: the pin stops at the outboard lug faces
  // instead of poking out (hingeDims still leaves it a hair proud).
  // shoulder / hip = disc hinge: the body part holds the clevis + pin, the limb
  // hangs off the tang's flange disc
  shoulder: { kind: "discHinge", p: { jaw: 0.1, lugT: 0.06, lugL: 0.2, lugD: 0.22, pinR: 0.05, pinOut: 0 } },
  hip: { kind: "discHinge", p: { jaw: 0.09, lugT: 0.055, lugL: 0.2, lugD: 0.2, pinR: 0.045, pinOut: 0 } },
  // arm joints run a SOLID tang on a tight clearance — the forearm shroud covers
  // them, so the mechanism should read as machined, not loose
  // elbow = hinge + twist: the tang's disc base is a turntable, so the forearm
  // swings on the pin AND rolls about its own axis on that disc
  elbow: { kind: "hingeTwist", p: { jaw: 0.14, lugT: 0.06, lugL: 0.2, lugD: 0.24, pinR: 0.05, clr: 0.008, tang: 1, pinOut: 0 } },
  // wrist = two hinge stages in series (pins X then Z) plus the tang disc's
  // turntable: bend, tilt, twist
  wrist: { kind: "wrist", p: { jaw: 0.1, lugT: 0.05, lugL: 0.2, lugD: 0.2, pinR: 0.04, clr: 0.008, tang: 1, pinOut: 0 } },
  knee: { kind: "hinge", p: { jaw: 0.15, lugT: 0.07, lugL: 0.2, lugD: 0.3, pinR: 0.06, tang: 1, pinOut: 0 }, opts: { discF: 1, discM: 1 } },
  ankle: { kind: "hinge", p: { jaw: 0.14, lugT: 0.065, lugL: 0.2, lugD: 0.26, pinR: 0.055, tang: 1, pinOut: 0 }, opts: { discF: 1, discM: 1 } },
  // finger knuckles: a BARE pin, no clevis — the digit just swings on it. The
  // span is sized off the digit, so the pin is a knuckle, not a crossbar.
  knuckle: { kind: "pin", p: { pinR: 0.035, jaw: 0.06, lugT: 0.01, clr: 0.005, pinOut: 0.01 } },
};

const J = ATLAS_JOINTS;

// ---- TORSO / PELVIS LAYOUT (body numbers only — no joint stacking) ---------

function torsoLayout(p) {
  const taperH = 0.13;                                // waist block: short, no belly
  const chestY = taperH - 0.04;                       // chest slab base
  const top = chestY + p.chestH;
  return {
    taperH, chestY, top,
    r: p.chestD / 2,                                  // flank half-cylinder radius
    neckY: top + 0.1,                                 // neck boss face
    sy: top - 0.3,                                    // shoulder height
    discR: hingeDiscR(J.shoulder.p),                  // the disc the shoulder bolts with
    coneLen: 0.14,
  };
}

const pelvisLayout = (p) => ({
  discT: 0.14,
  domeW: p.hipW * 0.6,
  discR: p.hipW / 2,
  hipY: -0.14 - p.hipH * 0.45,                        // hip height, under the disc
});

// ATLAS HELMET — a FRONT-FACING CYLINDER drum: axis = +Z, the flat disc is the
// face, wearing two concentric proud rings (outer rim + a smaller inner one),
// ear pods on the drum sides. It hangs from the neck ball, so its mount face is
// its underside and the drum grows up out of it.
function helmet(add, p) {
  const R = p.headR;
  add(translate(cylinder(0.14, 0.05, 14), 0, 0, 0));                       // neck boss
  const cy = R + 0.04;                                                     // drum centre
  const fz = p.headD / 2;                                                  // face plane
  add(translate(rotX(cylinder(R, p.headD, 24), HPI), 0, cy, -fz));         // drum, face forward
  add(translate(rotX(cylinder(R + 0.03, 0.06, 24), HPI), 0, cy, fz));      // face rim ring
  add(translate(rotX(cylinder(p.innerR, 0.05, 20), HPI), 0, cy, fz + 0.06)); // inner face ring
  for (const s of [1, -1])                                                 // ear pods
    add(translate(rotZ(cylinder(0.09, 0.06, 14), s * HPI), s * (R + 0.06), cy, 0));
}

// ATLAS TORSO — modeled on the (electric) Atlas robot: a rounded SLAB chest
// (core box + vertical half-cylinder flanks), a thin front panel, and a plain
// waist box below it — NO belly section, the torso sits directly on the pelvis.
// It hangs from the waist ball: its mount face is its underside.
function torso(add, p) {
  const L = torsoLayout(p);
  // waist block: a plain box bridging the mount face up to the chest slab
  add(translate(box(p.chestW * 0.55, L.taperH + 0.06, p.chestD * 0.75), 0, L.taperH / 2, 0));
  // chest slab: core box + rounded vertical flanks, depth = flank diameter
  const cw = p.chestW - 2 * L.r;
  add(translate(box(cw, p.chestH, 2 * L.r), 0, L.chestY + p.chestH / 2, 0));
  for (const s of [1, -1])
    add(translate(rotY(halfCylinder(L.r, p.chestH, 16), s * HPI), s * cw / 2, L.chestY, 0));
  add(translate(box(cw * 0.85, p.chestH * 0.72, 0.06), 0, L.chestY + p.chestH * 0.56, L.r + 0.01));
  add(translate(cylinder(0.17, 0.1, 16), 0, L.top, 0));                    // neck boss
  // shoulder seats: a cut cone flaring out of each chest flank, its rim the
  // face the shoulder's flange disc lands on — so the joint grows out of the
  // torso instead of sitting on it. rotZ turns the cone's +Y axis onto ±X.
  for (const s of [1, -1])
    add(translate(rotZ(coneCut(L.discR + 0.07, L.discR, L.coneLen, 24), -s * HPI),
      s * (p.chestW / 2 - L.coneLen), L.sy, 0));
}

// ATLAS PELVIS — the rig ROOT. A flat DISC with a HALF-CYLINDER shell (axis X,
// dome down) hanging under it; the waist ball socket bolts to its top face and
// a hip disc hinge to each of the dome's flat end faces.
function pelvis(add, p) {
  const L = pelvisLayout(p);
  add(translate(cylinder(L.discR, L.discT, 28), 0, -L.discT, 0));          // disc, under the waist face
  add(translate(rotY(rotX(halfCylinder(p.hipH, L.domeW, 20), HPI), HPI),
    -L.domeW / 2, -L.discT, 0));                                           // dome shell, flat up
}

// ATLAS UPPER ARM — biceps cylinder with a collar; hangs from the shoulder
// disc hinge, and its bottom face carries the elbow.
function upperArm(add, p) {
  const h = p.len + 0.08;
  add(translate(cylinder(p.w / 2, h, 20), 0, -h + 0.06, 0));
  add(translate(rotZ(cylinder(p.w * 0.4, p.w + 0.14, 14), -HPI), -(p.w + 0.14) / 2, -p.len, 0));
}

// ATLAS FOREARM — ONE big box, hanging off the elbow. It stops flush on its
// mount FACE (y = 0): above that face lives the joint's own hardware — the tang's
// DISC flange (the elbow link asks for discM) and then the tang running up to the
// pin — so the box never climbs into the jaw and the two meet exactly at the face.
function forearm(add, p) {
  const bot = -p.len - 0.02;
  add(translate(box(p.w, -bot, p.w * 0.9), 0, bot / 2, 0));
}

// ATLAS PALM — a GRIPPER hand: a plain BLOCK bolted to the wrist's tang disc.
// No knuckle clevises — the fingers hang off the block's front and back SIDE
// FACES on bare knuckle pins, one behind, two in front: a 3-jaw gripper.
function palm(add, p) {
  add(translate(box(p.w, p.h, p.d), 0, -p.h / 2 + 0.02, 0));
}

// ATLAS DIGIT — one finger bone: a box hanging off the knuckle PIN it swings
// on (the pin is its local origin, so the bone the rig spends on it turns it
// exactly where the hardware does). Three of them chain into a finger.
function digit(add, p) {
  add(translate(box(p.w, p.len + 0.05, p.w), 0, -(p.len + 0.05) / 2 + 0.02, 0));
}

// ATLAS THIGH — thigh box with a knee collar; hangs from the hip disc hinge.
function thigh(add, p) {
  add(translate(box(p.w, p.len + 0.1, p.w + 0.04), 0, -(p.len + 0.1) / 2 + 0.07, 0));
  add(translate(rotZ(cylinder(p.w * 0.38, p.w + 0.16, 14), -HPI), -(p.w + 0.16) / 2, -p.len, 0));
}

// ATLAS SHIN — shin barrel between the knee and the ankle.
function shin(add, p) {
  const h = p.len + 0.06;
  add(translate(cylinder(p.w / 2, h, 20), 0, -h + 0.04, 0));
}

// ATLAS FOOT — built around the ANKLE BASE: a flat box directly under the ankle,
// so the joint always stands on level ground. Everything else hangs off its two
// faces — forward, a slope box tapering into a flat toe box (the toe's height is
// what the slope leaves behind, so they meet flush on one sole plane); rearward,
// the heel: a base box continuing the sole and a slope box tapering down behind
// it. p.len spans the ankle to the toe tip.
const FOOT_SLOPE = 0.55, FOOT_H = 0.2, TOE_D = 0.2, ANKLE_D = 0.24;

function foot(add, p) {
  const soleY = -0.02;                                // foot top plane, at the mount face
  const z0 = ANKLE_D / 2;                             // ankle base front face
  const footD = p.len - z0 - TOE_D;                   // slope run, ankle base -> toe
  const midY = soleY - FOOT_H / 2;                    // sole slab centre
  const toeH = FOOT_H * (1 - FOOT_SLOPE);
  add(translate(box(p.w, FOOT_H, ANKLE_D), 0, midY, 0));
  add(translate(box(p.w, FOOT_H, footD, FOOT_SLOPE), 0, midY, z0 + footD / 2));
  add(translate(box(p.w * 0.92, toeH, TOE_D), 0, soleY - FOOT_H + toeH / 2, z0 + footD + TOE_D / 2));
  add(translate(box(p.w, FOOT_H, p.heelD), 0, midY, -z0 - p.heelD / 2));
  add(translate(rotY(box(p.w, FOOT_H, p.heelCapD, 0.7), Math.PI), 0, midY, -z0 - p.heelD - p.heelCapD / 2));
}

// PART SLOTS — `mount` is the face the part hangs from (its parent's joint puts
// the male half there); every other slot OFFERS a joint to a child. `f` names
// the part axis that ends up along the joint's pin: shoulders and hips take it
// along Z (front-back), so the pin swings the limb OUT to the side and the disc
// spins it fore/aft.
function atlasSlots(name, p) {
  switch (name) {
    case "head":
      return { mount: { pos: [0, 0, 0], n: [0, -1, 0], f: [0, 0, 1] } };
    case "torso": {
      const L = torsoLayout(p);
      return {
        mount: { pos: [0, 0, 0], n: [0, -1, 0], f: [0, 0, 1] },
        neck: { pos: [0, L.neckY, 0], n: [0, 1, 0], f: [0, 0, 1], joint: J.neck },
        // the two flanks are MIRROR IMAGES, and a joint can only be SEATED by a
        // rotation, never by a reflection. So the right slot reverses the pin
        // direction (f) instead — the same hardware, turned around, which is
        // exactly what a mirrored clevis is. Per-side signs in the rig then make
        // the two arms move together.
        shoulderL: { pos: [-p.chestW / 2, L.sy, 0], n: [-1, 0, 0], f: [0, 0, 1], joint: J.shoulder },
        shoulderR: { pos: [p.chestW / 2, L.sy, 0], n: [1, 0, 0], f: [0, 0, -1], joint: J.shoulder },
      };
    }
    case "pelvis": {
      const L = pelvisLayout(p);
      const hx = L.domeW / 2;
      return {
        // the rig root: the waist face is the pelvis's own origin, and it offers
        // the waist ball to the torso
        waist: { pos: [0, 0, 0], n: [0, 1, 0], f: [0, 0, 1], joint: J.waist },
        hipL: { pos: [-hx, L.hipY, 0], n: [-1, 0, 0], f: [0, 0, 1], joint: J.hip },
        hipR: { pos: [hx, L.hipY, 0], n: [1, 0, 0], f: [0, 0, -1], joint: J.hip },   // pin reversed: see shoulderR
      };
    }
    case "upperArm":
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [0, 0, 1] },
        elbow: { pos: [0, -p.len, 0], n: [0, -1, 0], f: [1, 0, 0], joint: J.elbow },
      };
    case "forearm":
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0] },
        // the forearm box IS the elbow tang's flange, so the joint leaves the
        // male base off (baseM) — see the elbow link in the rig
        wrist: { pos: [0, -p.len - 0.02, 0], n: [0, -1, 0], f: [1, 0, 0], joint: J.wrist },
      };
    case "palm": {
      const fw = ATLAS_PARAMS.digit.w;
      const ky = -p.h + 0.08;                          // knuckle pins, near the lower edge
      const fz = p.d / 2 + fw / 2;                     // pins proud of the front / back faces
      const fx = p.w * 0.27;                           // front pair spread
      const knuck = (pos, f) => ({ pos, n: [0, -1, 0], f, anchor: "axis", joint: J.knuckle });
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [0, 0, 1] },
        // f0 = the single back finger (f mirrored so it curls the other way),
        // f1 / f2 = the front pair
        f0: knuck([0, ky, -fz], [-1, 0, 0]),
        f1: knuck([-fx, ky, fz], [1, 0, 0]),
        f2: knuck([fx, ky, fz], [1, 0, 0]),
      };
    }
    case "digit":
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0], anchor: "axis" },
        tip: { pos: [0, -p.len, 0], n: [0, -1, 0], f: [1, 0, 0], anchor: "axis", joint: J.knuckle },
      };
    case "thigh":
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [0, 0, 1] },
        knee: { pos: [0, -p.len, 0], n: [0, -1, 0], f: [1, 0, 0], joint: J.knee },
      };
    case "shin":
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0] },
        ankle: { pos: [0, -p.len, 0], n: [0, -1, 0], f: [1, 0, 0], joint: J.ankle },
      };
    case "foot":
      return { mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0] } };
  }
  return {};
}

export const ATLAS_KIT = createKit({
  params: ATLAS_PARAMS,
  builders: { head: helmet, torso, pelvis, upperArm, forearm, palm, digit, thigh, shin, foot },
  slots: atlasSlots,
});
