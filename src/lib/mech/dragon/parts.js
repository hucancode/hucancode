// DRAGON PART KIT — head, body segments, tapering segments, limbs, tail.
// A part embeds the FIXED half of every joint it offers to children (female
// ball socket / hinge clevis + pin at its distal slots) and the MOVING half of
// the joint it plugs into its parent with (male ball / male hinge U at its
// mount slot). Both halves come off joints.js, so the mechanism a rig bone
// rotates is real geometry, not a pivot in the air.
import {
  box, cylinder, cone, coneCut, sphere, halfCylinder, halfCylinderBox,
  boxCylinder, quarterCylinder, rotX, rotY, rotZ, translate,
} from "../primitives.js";
import { rad } from "../../math/scalar.js";
import { HPI, jointMounts, ballBlock, hingeBlock, hinge1Block } from "../joints.js";
import { createKit } from "../kit.js";

// editable per-part parameters
export const DRAGON_PARAMS = {
  head: { headW: 1.2, snoutLen: 1.1, jawOpen: 16, eyeR: 0.17, hornLen: 0.9 },
  bodySegment: { bodyR: 0.55, segLen: 1.6, discs: 4, finR: 0.45 },
  bodySegment2: { rFront: 0.55, rRear: 0.36, segLen: 1.6, finR: 0.4 },
  arm: { upperLen: 0.45, foreLen: 0.4, elbowBend: 25, clawR: 0.3 },
  leg: { thighLen: 0.5, shinLen: 0.45, kneeBend: 18, footLen: 0.35, clawR: 0.28 },
  tail: { coreLen: 1.4, bodyR: 0.4, tipLen: 1.2 },
};

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

// PART MOUNT SLOTS — parts expose slots the same way joints do: each slot is
// { pos, n, f } (origin + outward normal + forward tangent = a full coordinate
// system) in the part's LOCAL frame, DERIVED from the mount slots of the
// joints the part is built on (jointMounts), so the sockets and balls line up
// exactly with the emitted geometry. A rig connects two parts by MATCHING a
// slot on each: positions coincide, forwards align, normals oppose.
function dragonSlots(name, p) {
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

export const DRAGON_KIT = createKit({
  params: DRAGON_PARAMS,
  builders: { head, bodySegment, bodySegment2, arm, leg, tail },
  slots: dragonSlots,
});
