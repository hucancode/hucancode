// DRAGON PART KIT — head, jaw, body segments, tapering segments, limbs, tail.
//
// A part is a BODY and its SLOTS. It models NO joint: a slot that offers one
// just names the kind and its proportions, and the assemble engine instantiates
// the real hardware there — female half on this part, male half on the child,
// bones on the axis. So the numbers below are body numbers only; nothing here
// stacks up a joint's internal reach.
//
// Slot convention: a slot is the FACE the joint bolts to, `n` pointing out of
// the body, `f` naming the part axis that lands on the joint's pin. A slot
// marked anchor: "axis" instead puts the joint's AXIS on it — used where the
// body is modeled around a bare pin (the jaw).
import {
  box, cylinder, cone, coneCut, sphere, halfCylinder, halfCylinderBox,
  quarterCylinder, rotX, rotY, rotZ, translate,
} from "../primitives.js";
import { HPI } from "../joints.js";
import { createKit } from "../kit.js";

// editable per-part parameters — BODY shape only
export const DRAGON_PARAMS = {
  head: { headW: 1.2, snoutLen: 1.1, eyeR: 0.17, hornLen: 0.9 },
  jaw: { jawW: 0.66, jawLen: 1.55 },
  bodySegment: { bodyR: 0.55, segLen: 1.6, discs: 4, finR: 0.45 },
  bodySegment2: { rFront: 0.55, rRear: 0.36, segLen: 1.6, finR: 0.4 },
  upperArm: { len: 0.45, w: 0.38 },
  forearm: { len: 0.4, clawR: 0.3 },
  thigh: { len: 0.5, w: 0.46 },
  shin: { len: 0.45, footLen: 0.35, clawR: 0.28 },
  tail: { coreLen: 1.4, bodyR: 0.4, tipLen: 1.2 },
};

// The joints the dragon is bolted together with. A part names these on the
// slots it offers; the two halves of one joint therefore come from ONE
// declaration and can never drift apart.
export const DRAGON_JOINTS = {
  spine: { kind: "ball", p: { ballR: 0.26, socketT: 0.09, studLen: 0.14, flangeT: 0.12, flangeW: 0.8, base: "disc" } },
  spine2: { kind: "ball", p: { ballR: 0.24, socketT: 0.08, studLen: 0.13, flangeT: 0.12, flangeW: 0.7, base: "disc" } },
  jaw: { kind: "hinge", p: { jaw: 0.4, lugT: 0.1, lugL: 0.36, lugD: 0.32, pinR: 0.09 } },
  shoulder: { kind: "discHinge", p: { jaw: 0.1, lugT: 0.055, lugL: 0.34, lugD: 0.22, pinR: 0.045 } },
  hip: { kind: "discHinge", p: { jaw: 0.12, lugT: 0.065, lugL: 0.38, lugD: 0.26, pinR: 0.055 } },
  elbow: { kind: "hinge", p: { jaw: 0.14, lugT: 0.07, lugL: 0.3, lugD: 0.28, pinR: 0.06 } },
  knee: { kind: "hinge", p: { jaw: 0.16, lugT: 0.075, lugL: 0.32, lugD: 0.3, pinR: 0.07 } },
};

// head anchors: where the neck boss ends, and the jaw pin the mandible swings on
const HEAD_NECK_Z = -1.18;              // rear face of the neck boss
const HEAD_JAW_PIN = [0, 0.02, -0.12];  // jaw hinge pin (X axis), under the skull

// DRAGON HEAD — boxes only for the skull (the engine has no boolean cut, so the
// EYE HOLES are real gaps: a roof box, a floor box and a narrow core box leave
// an open rectangular window on each side of the mid-section; the eyeball sits
// on the core inside the window). Slope-top boxes shape the brow and snout.
// +Z = forward (snout), Y up. The jaw is its OWN part, hinged under the skull.
function head(add, p) {
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
  // per-eye brow ridges: small slope blocks jutting past the brow's front edge
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
  // upper fangs: two per side hanging from the snout underside, the rear shorter
  for (const s of [1, -1])
    for (const [i, h] of [0.18, 0.12].entries())
      add(translate(box(0.08, h, 0.08), s * W * 0.22, 0.37 - h / 2, 0.5 + p.snoutLen - 0.1 - i * 0.35));
  // cheek armor: slope plate on each skull flank with three vent slats
  for (const s of [1, -1]) {
    add(translate(box(0.12, 0.52, 0.78, 0.55), s * (W / 2 + 0.06), 0.5, -0.38));
    for (const y of [0.36, 0.5])
      add(translate(box(0.05, 0.07, 0.44), s * (W / 2 + 0.13), y, -0.42));
  }
  // antlers: a root block seated flat on the roof, then a stepped run of
  // axis-aligned boxes hanging off its outer side face, extending BACK along
  // -Z and up (full-wedge tip turned 180deg so the point aims -Z)
  for (const s of [1, -1]) {
    const L = p.hornLen;
    const x = s * W * 0.32;
    add(translate(box(0.3, 0.3, 0.36), x, 1.05, -0.64));                     // root block on the roof
    const ax = x + s * 0.21;                                                 // side plane, 0.04 into the root
    const L1 = L * 0.6, L2 = L * 0.45;
    add(translate(box(0.2, 0.24, L1), ax, 1.05, -0.55 - L1 / 2));            // lower shaft
    const kz = -0.55 - L1;                                                   // step point
    add(translate(box(0.24, 0.36, 0.28), ax, 1.17, kz + 0.05));              // riser
    add(translate(box(0.18, 0.2, L2), ax, 1.25, kz + 0.05 - L2 / 2));        // upper shaft
    add(translate(rotY(box(0.18, 0.2, 0.5, 0.96), Math.PI), ax, 1.25, kz - L2 - 0.13)); // wedge tip
  }
  // crest fin: D-plate on the skull roof, round side up, body sunk into the box
  {
    const g = halfCylinderBox(0.32, 0.09, 0.35, 16);
    rotX(g, -HPI); rotY(g, HPI);
    add(translate(g, 0.045, 0.92, -0.5));
  }
  // neck mount: seat plate + cylinder boss pointing out the back (-Z). The
  // boss's rear FACE is the neck slot — the spine ball bolts straight onto it.
  add(translate(rotX(translate(box(0.5, 0.16, 0.5), 0, -0.08, 0), -HPI), 0, 0.55, -0.9)); // plate, sunk in
  add(translate(rotX(cylinder(0.25, 0.28, 20), -HPI), 0, 0.55, -0.9));       // boss
}

// DRAGON JAW — the mandible: a plate with teeth and slope side walls, modeled
// around the HINGE PIN it swings on (the pin is the local origin, so the bone
// the rig spends on the jaw turns it exactly where the hardware does).
function jaw(add, p) {
  const w = p.jawW, len = p.jawLen;
  add(translate(box(w, 0.22, len), 0, -0.24, len / 2 - 0.15));               // jaw plate
  for (const x of [-w * 0.33, 0, w * 0.33])                                  // teeth
    add(translate(box(0.07, 0.14, 0.07), x, -0.06, len - 0.4));
  for (const s of [1, -1])                                                   // mandible side walls
    add(translate(box(0.08, 0.2, len * 0.6, 0.5), s * (w / 2 + 0.04), -0.2, len * 0.4));
}

// spine fin: QUARTER disc standing on the back at height y — arc rising from
// the front like a lego curved slope, vertical trailing edge at the rear
function spineFin(add, finR, y, z) {
  add(translate(rotZ(quarterCylinder(finR, 0.12, 14), HPI), 0.06, y - 0.05, z));
}

// DRAGON BODY SEGMENT — same construction as the Blender kit piece: solid
// half-cylinder upper back, belly = stacked half-cylinder discs with small
// gaps, D-plate spine fins, side planks. The REAR face carries the spine ball
// the next segment plugs into; the FRONT face is where this one plugs in, so
// copies daisy-chain and the spine bends in any direction.
function bodySegment(add, p) {
  const R = p.bodyR, len = p.segLen, cy = R, plankT = 0.1;
  // upper back: one solid half cylinder, dome up, spanning the segment
  add(translate(rotX(halfCylinder(R, len, 20), -HPI), 0, cy, len));
  // belly: stacked discs, dome down, small gaps between them
  const n = Math.max(1, Math.round(p.discs));
  const pitch = len / n, t = pitch - 0.07;
  for (let i = 0; i < n; i++)
    add(translate(rotX(halfCylinder(R * 0.94, t, 16), HPI), 0, cy, i * pitch + 0.035));
  // side planks slapped on both flanks — the limb mounting pads
  for (const s of [1, -1])
    add(translate(box(plankT, R * 0.95, len * 0.86), s * (R + plankT / 2), cy, len / 2));
  // spine fins riding the back radius
  for (const f of [0.3, 0.7]) spineFin(add, p.finR, cy + R, f * len);
}

// DRAGON BODY SEGMENT TYPE 2 — tapered variant: the core is a CUT CONE lying
// along the spine (wide at the front, narrow at the rear), so a chain of them
// forms a shrinking neck or tail run.
function bodySegment2(add, p) {
  const len = p.segLen, R0 = p.rRear, R1 = p.rFront, cy = R1;
  add(translate(rotX(coneCut(R0, R1, len, 24), HPI), 0, cy, 0));   // core cone
  for (const f of [0.3, 0.7]) spineFin(add, p.finR, cy + R0 + (R1 - R0) * f, f * len);
}

// DRAGON UPPER ARM — a box limb hanging off the shoulder's disc hinge, with a
// slope armor plate on its front face. Its bottom face carries the elbow.
function upperArm(add, p) {
  add(translate(box(p.w, p.len, 0.42), 0, -p.len / 2, 0));
  add(translate(box(p.w * 0.84, p.len * 0.6, 0.08, 0.5), 0, -p.len * 0.4, 0.24));
}

// DRAGON FOREARM — forearm box + armor, wrist barrel, palm block, and a claw of
// three segmented fingers with quarter-disc talons. The distal digits and their
// blades are CURLED about a shared knuckle line — a fixed shape, not a joint:
// nothing in the rig drives them.
const CLAW_CURL = 0.45;

function forearm(add, p) {
  const L = p.len;
  add(translate(box(0.3, L, 0.34), 0, -L / 2, 0));
  add(translate(box(0.24, L * 0.65, 0.08, 0.5), 0, -L * 0.45, 0.19));
  const wy = -(L + 0.05);                                    // wrist barrel
  add(translate(rotZ(cylinder(0.12, 0.36, 18), -HPI), -0.18, wy, 0));
  const py = wy - 0.17;                                      // palm block
  add(translate(box(0.34, 0.24, 0.3), 0, py, 0.02));
  const jy = py - 0.26, jz = 0.06;                           // knuckle line
  for (const fx of [-0.14, 0, 0.14]) {
    add(translate(box(0.09, 0.16, 0.11), fx, py - 0.18, jz));               // proximal digit
    const dig = (g) => add(translate(rotX(g, -CLAW_CURL), fx, jy, jz));     // distal, curled
    dig(translate(box(0.08, 0.14, 0.1), 0, -0.07, 0));
    dig(translate(rotZ(quarterCylinder(p.clawR, 0.08, 10), -HPI), -0.04, -0.12, -0.05));
  }
  // thumb talon: smaller quarter disc off the palm's inner side, opposing
  add(translate(rotZ(quarterCylinder(p.clawR * 0.7, 0.08, 10), -HPI), 0.21, py - 0.08, -0.06));
}

// DRAGON THIGH — the chunkier limb box; its bottom face carries the knee.
function thigh(add, p) {
  add(translate(box(p.w, p.len, 0.54), 0, -p.len / 2, 0));
}

// DRAGON SHIN — shin box, ankle barrel, flat foot, quarter-disc toe claws.
function shin(add, p) {
  const L = p.len;
  add(translate(box(0.34, L, 0.4), 0, -L / 2, 0));
  const ay = -(L + 0.05);
  add(translate(rotZ(cylinder(0.13, 0.4, 18), -HPI), -0.2, ay, 0));         // ankle barrel
  add(translate(box(0.46, 0.2, p.footLen), 0, ay - 0.05, p.footLen / 2 - 0.12));
  // toe nails: flat base on the ground, vertical rear edge against the foot,
  // arc curving over the top to a forward tip at ground level
  for (const x of [-0.18, -0.04, 0.1])
    add(translate(rotZ(quarterCylinder(p.clawR, 0.08, 10), HPI), x + 0.08, ay - 0.15, p.footLen - 0.15));
}

// DRAGON TAIL — a stack of FULL discs shrinking toward the tip (no shell, no
// fins) and a CONE spiking back from the smallest disc as the tip. A leaf: it
// only brings a mount face.
function tail(add, p) {
  const R = p.bodyR, len = p.coreLen, cy = R;
  const n = Math.max(3, Math.round(len / 0.28));
  const pitch = len / n, t = pitch - 0.06;
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;                       // 0 = tip end, 1 = front
    add(translate(rotX(cylinder(R * (0.5 + 0.5 * f), t, 20), HPI), 0, cy, i * pitch + 0.03));
  }
  add(translate(rotX(cone(R * 0.5, p.tipLen, 20), -HPI), 0, cy, 0.03));     // tip spike
}

// PART SLOTS — the faces this part bolts through. `mount` is where the part
// itself hangs from its parent (its male half lands there); every other slot
// OFFERS a joint to a child, and the part owns that joint's female half.
//
// f = the part axis that ends up along the joint's pin. Spine balls spin freely,
// so their f only sets the roll; the limb pads put the shoulder pin along the
// body axis (Z), which leaves the disc turning fore/aft — the swim stroke.
const J = DRAGON_JOINTS;

function dragonSlots(name, p) {
  switch (name) {
    case "head":
      return {
        // the head is the chain root: it hangs from nothing, and its neck boss
        // face carries the spine ball the first segment plugs into
        neck: { pos: [0, 0.55, HEAD_NECK_Z], n: [0, 0, -1], f: [0, 1, 0], joint: J.spine },
        jaw: { pos: [...HEAD_JAW_PIN], n: [0, -1, 0], f: [1, 0, 0], anchor: "axis", joint: J.jaw },
      };
    case "jaw":
      return { mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0], anchor: "axis" } };
    case "bodySegment": {
      const cy = p.bodyR, x = p.bodyR + 0.1;
      return {
        mount: { pos: [0, cy, p.segLen], n: [0, 0, 1], f: [0, 1, 0] },       // front face
        rear: { pos: [0, cy, 0], n: [0, 0, -1], f: [0, 1, 0], joint: J.spine },
        // limb pads on the side planks: bare unless a link bolts a joint on.
        // The flanks are MIRROR IMAGES, and a joint can only be SEATED by a
        // rotation, never a reflection — so the right pad reverses the pin
        // direction (f) instead, which is what a mirrored clevis IS. The rig's
        // per-side signs then swim the two limbs together.
        flankL: { pos: [-x, cy, p.segLen / 2], n: [-1, 0, 0], f: [0, 0, 1] },
        flankR: { pos: [x, cy, p.segLen / 2], n: [1, 0, 0], f: [0, 0, -1] },
      };
    }
    case "bodySegment2": {
      const cy = p.rFront;
      return {
        mount: { pos: [0, cy, p.segLen], n: [0, 0, 1], f: [0, 1, 0] },
        rear: { pos: [0, cy, 0], n: [0, 0, -1], f: [0, 1, 0], joint: J.spine2 },
      };
    }
    case "tail":
      return { mount: { pos: [0, p.bodyR, p.coreLen], n: [0, 0, 1], f: [0, 1, 0] } };
    case "upperArm":
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [0, 0, 1] },
        elbow: { pos: [0, -p.len, 0], n: [0, -1, 0], f: [1, 0, 0], joint: J.elbow },
      };
    case "forearm":
      return { mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0] } };
    case "thigh":
      return {
        mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [0, 0, 1] },
        knee: { pos: [0, -p.len, 0], n: [0, -1, 0], f: [1, 0, 0], joint: J.knee },
      };
    case "shin":
      return { mount: { pos: [0, 0, 0], n: [0, 1, 0], f: [1, 0, 0] } };
  }
  return {};
}

export const DRAGON_KIT = createKit({
  params: DRAGON_PARAMS,
  builders: { head, jaw, bodySegment, bodySegment2, upperArm, forearm, thigh, shin, tail },
  slots: dragonSlots,
});
