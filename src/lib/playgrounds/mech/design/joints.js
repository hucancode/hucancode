// JOINT CATALOG — a reference library of mechanical joints, each built as real
// SDF hardware so its SHAPE reads its motion at a glance:
//   hinge  (1-axis pitch) -> a female U clevis + a male I tongue, pin HORIZONTAL
//   pivot  (1-axis yaw)   -> two rings stacked, a shaft pierced VERTICALLY
//   ball   (3-axis)       -> two perpendicular C-yokes interlocking around a ball
// Each builder takes a param object (see JOINT_PARAMS for editable fields) and
// emits primitives in LOCAL space around [0,0,0]; place() offsets a whole joint
// into the scene. Subtracts stay local to their joint, so laying the joints
// apart keeps the global CSG fold from carving a neighbour.
import { PALETTE } from "./palette.js";

const { steel, dark, brass } = PALETTE;
const ACCENT = PALETTE.accent;
// map a cylinder's local +Y axis onto world +X (Rz = -90): for round pins the
// spin about that axis is irrelevant, so this single rot serves every X pin.
const ROT_X = [0, 0, -90];

const N = (type, pos, dims, o = {}) => ({
  type, pos, dims,
  rot: o.rot, op: o.op, k: o.k,
  round: o.round ?? 0.04, color: o.color ?? steel, stage: o.stage ?? 1,
});

// translate a whole joint's nodes into place (positions only; rots are local)
function place(nodes, origin) {
  return nodes.map((n) => ({ ...n, pos: [n.pos[0] + origin[0], n.pos[1] + origin[1], n.pos[2] + origin[2]] }));
}

// editable per-joint parameters (in r-units). the UI binds to these; the catalog
// merges them over the builder call. fields chosen to be the meaningful knobs.
// `bevel` is a multiplier on every primitive's round (edge softness); the rest
// are joint-specific. all in r-units except the unitless ratios/bevel.
export const JOINT_PARAMS = {
  hinge: { width: 0.36, femaleWidth: 1.0, maleWidth: 1.0, gapWidth: 0.25, depth: 0.36, height: 1.6, tongueLength: 0.4, socketLength: 0.4, socketThickness: 0.2, bevel: 0.2 },
  hingePivot: { width: 0.36, femaleWidth: 1.0, maleWidth: 1.0, gapWidth: 0.25, depth: 0.36, height: 1.6, tongueLength: 0.4, socketLength: 0.4, socketThickness: 0.2, discRadius: 0.62, discThickness: 0.08, bevel: 0.2 },
  pivot: { radius: 0.72, thickness: 0.1, gap: 1.0, height: 1.0, bevel: 0.2 },
  ball: { ballRadius: 0.6, band: 0.2, wrap: 2.0, bevel: 0.2 },
};

// derive every hinge dimension from the params, so hingeJoint and hingePivot
// share the exact socket math (the disc must seat flush on the female top).
function hingeMetrics(p = {}) {
  const { width = 0.36, femaleWidth = 1.0, maleWidth = 1.0, gapWidth = 0.25, height = 1.0, depth = 0.5, tongueLength = 0.4, socketLength = 0.4, socketThickness = 0.2 } = p;
  // X split: normalize the three width weights, split `width` between arm/tongue/gap
  const wf = Math.max(femaleWidth, 0), wm = Math.max(maleWidth, 0), wg = Math.max(gapWidth, 0);
  const xsum = wf + wm + wg || 1;
  const femaleW = width;                // outer half-width (full span of the U block)
  const maleW = (wm / xsum) * width;    // tongue half-width = the male share
  const gap = (wg / xsum) * width;      // slot clearance = the gap share (per side)
  const slotHalf = maleW + gap;         // -> arm = width - slotHalf = the female share
  const pinHalf = femaleW + 0.1;        // pin reaches past the U's outer faces
  const tongueZ = depth * 0.68;         // tongue slab half-depth (= the knuckle radius / arch)
  // Y split: tongue / socket-arm-extension / panel are 0..1 weights, normalized to
  // sum 1, then distributed across `height`.
  const ft = Math.max(tongueLength, 0), fa = Math.max(socketLength, 0), fp = Math.max(socketThickness, 0);
  const ysum = ft + fa + fp || 1;
  const tongueDown = (ft / ysum) * height; // male tongue reach below the pin (base at 0)
  const armExtra = (fa / ysum) * height;   // arm extension DOWN past the arch (0 = fit arch)
  const panelT = (fp / ysum) * height;     // top panel thickness
  const pinY = tongueDown;                 // eye height; tongue base sits at y=0
  const MH = pinY;                          // tongue spans [0, pinY], eye at the top
  const slotTop = pinY + tongueZ;           // arm top / panel bottom (just covers the eye)
  const SH = slotTop + panelT;              // female top
  const armBottom = pinY - tongueZ - armExtra; // arms reach down from the pin; 0 -> arch bottom
  const slotBot = armBottom - 0.2;          // slot opens below the arms (clevis open at bottom)
  return { femaleW, maleW, gap, slotHalf, pinHalf, tongueZ, pinY, MH, panelT, slotTop, armBottom, SH, slotBot, depth, width };
}

// HINGE — pin axis = X. A female U (a block carved from below into a clevis)
// receives a male I (a slab with a rounded head on the pin axis); a brass pin
// runs horizontally through both. One axis of rotation, about X. The slot is a
// subtract emitted before the tongue, so the cut shapes only the U (stays local).
//   width       = overall half-width along the pin axis (the female outer width)
//   femaleWidth/maleWidth/gapWidth = the three pieces the width splits into along
//     the pin axis: the female arm (each side), the male tongue, the slot gap. RAW
//     weights — normalized to sum 1, distributed across `width`.
//   depth       = half-depth along Z (set == width for a square footprint)
//   height      = FULL joint height scale
//   tongueLength/socketLength/socketThickness = 0..1 weights, normalized to sum 1,
//     splitting `height` between: the male tongue reach below the pin, how far the
//     female arms extend DOWN past the arch (0 = fit the arch exactly), and the
//     top panel thickness.
export function hingeJoint(p = {}) {
  const { r = 0.55 } = p;
  const m = hingeMetrics(p);
  return [
    // female U: a block spanning the arms + top panel, then a slot carved up from
    // below -> two prongs + a top panel. slot deeper in z so the clevis is open f/b.
    N("box", [0, r * (m.armBottom + m.SH) / 2, 0], [r * m.femaleW, r * (m.SH - m.armBottom) / 2, r * m.depth], { color: steel, round: 0.06 }),
    N("box", [0, r * (m.slotTop + m.slotBot) / 2, 0], [r * m.slotHalf, r * (m.slotTop - m.slotBot) / 2, r * (m.depth + 0.2)], { op: "subtract", round: 0.04 }),
    // male I tongue: a slab rising from below UP TO the knuckle centre, capped by
    // a cylinder of the same half-depth so its lower half merges into the slab -> a
    // rounded hinge eye, the pin through its centre.
    N("box", [0, r * (m.pinY - m.MH) / 2, 0], [r * m.maleW, r * (m.pinY + m.MH) / 2, r * m.tongueZ], { color: dark, round: 0.02 }),
    N("cyl", [0, r * m.pinY, 0], [r * m.tongueZ, r * m.maleW], { rot: ROT_X, color: dark, round: 0.02 }), // rounded eye
    N("cyl", [0, r * m.pinY, 0], [r * 0.12, r * m.pinHalf], { rot: ROT_X, color: brass, round: 0.02, stage: 2 }), // pin
  ];
}

// HINGE-PIVOT — a hinge with a turntable DISC mounted on TOP of the female,
// axis vertical. Two axes of motion: the hinge gives pitch (about the X pin),
// the disc adds yaw (about Y). All hinge params apply; plus the disc geometry.
//   discRadius    = disc radius (r-units)        discThickness = disc half-height
export function hingePivotJoint(p = {}) {
  const { r = 0.55, discRadius = 0.62, discThickness = 0.08 } = p;
  const base = hingeJoint(p);
  const { SH } = hingeMetrics(p);                  // == full height; disc seats on it
  const top = r * SH;                             // top face of the female U block
  const discY = top + r * discThickness;          // disc seats on the top face
  return [
    ...base,
    N("cyl", [0, discY, 0], [r * discRadius, r * discThickness], { color: steel, round: 0.03 }),                       // turntable disc
    N("cyl", [0, discY + r * discThickness * 0.5, 0], [r * discRadius * 0.6, r * discThickness], { op: "subtract", round: 0.02 }), // dished top face
    N("cyl", [0, discY + r * discThickness, 0], [r * 0.12, r * 0.06], { color: brass, round: 0.02, stage: 2 }),        // hub bolt
    N("box", [0, discY + r * discThickness * 0.5, r * discRadius * 0.7], [r * 0.04, r * discThickness, r * discRadius * 0.3], { color: brass, round: 0.01, stage: 2 }), // index pointer (radial tick)
  ];
}

// PIVOT — axis = Y. Two flat collar RINGS stacked (a disc with a bored centre);
// a brass shaft pierced vertically through both bores (shaft radius == bore, no
// gap). Each ring carries an accent band wedge at the front so the spin about Y
// reads. Bolt head on top, nut underneath. Each bore is a subtract emitted right
// after its body so the cut stays local; bands/shaft come after, uncarved.
//   radius = ring outer radius   thickness = ring slab half-height
//   gap    = separation between the two rings   height = shaft overhang scale
export function pivotJoint(p = {}) {
  const { r = 0.55, radius = 0.72, thickness = 0.1, gap = 1.0, height = 1.0, accent = ACCENT } = p;
  const ringH = r * thickness;                 // half-height of the flat ring slab
  const outer = r * radius, bore = r * radius * 0.64;
  const ringY = r * gap * 0.5 + ringH;         // gap is the CLEAR space between ring faces,
                                               // so add ringH -> stays constant as thickness grows
  const shaftHalf = ringY + r * 0.55 * height; // shaft + caps overhang past the rings
  const bandZ = r * radius * 0.82;
  const ring = (y) => [
    N("cyl", [0, y, 0], [outer, ringH], { color: steel, round: 0.03 }),          // ring body (disc)
    N("cyl", [0, y, 0], [bore, ringH * 1.6], { op: "subtract", round: 0.01 }),   // bore -> annulus
  ];
  const band = (y) =>
    N("box", [0, y, bandZ], [r * 0.13, ringH, r * 0.026], { rot: [0, -90, 0], color: accent, round: 0.005, stage: 2 });
  return [
    ...ring(ringY),
    ...ring(-ringY),
    band(ringY),
    band(-ringY),
    N("cyl", [0, 0, 0], [bore, shaftHalf], { color: brass, round: 0.02, stage: 2 }), // shaft fills the bore, no gap
    N("cyl", [0, shaftHalf, 0], [r * 0.34, r * 0.12], { color: dark, round: 0.03, stage: 2 }), // bolt head
    N("cyl", [0, -shaftHalf, 0], [r * 0.34, r * 0.12], { color: dark, round: 0.03, stage: 2 }), // nut
  ];
}

// BALL — 3-axis. One ball cradled by two C-yokes that interlock at 90°, like a
// gimbal: the upper yoke wraps the top hemisphere and rises to the upper member,
// the lower yoke (rotated 90° about Y) wraps the bottom and drops to the lower
// member. Each yoke is one `arc` primitive — a hard-edged curved BAR (rectangular
// cross-section, flat end-caps), NOT a round tube — a self-contained SDF, so it
// can never carve a neighbour or the floor. The ball is a solid sphere seated in
// the crossing of the two C's.
//   ballRadius = the ball     band = yoke bar half-thickness (radial)
//   wrap       = how far each C wraps (radians, ±about its pole; >π/2 grips past
//                the equator and interlocks with its perpendicular partner)
export function ballJoint(p = {}) {
  const { r = 0.55, ballRadius = 0.6, band = 0.2, wrap = 2.0 } = p;
  const radialHalf = band, axialHalf = band * 1.6;   // bar wider across (a plate) than thick
  const ringR = ballRadius + radialHalf;             // inner face of the bar rides on the ball
  const reach = ringR + radialHalf + 0.35;           // where the member shaft meets the yoke pole
  // arc prim wraps +Y; upper yoke uses it as-is, lower yoke flips (Rx 180 ->
  // wraps -Y) and turns 90° (Ry) so the two C's cross perpendicular.
  const yoke = [r * ringR, r * radialHalf, r * axialHalf, wrap];
  return [
    N("arc", [0, 0, 0], yoke, { color: dark, round: 0.02 }),                     // upper C-yoke (wraps +Y)
    N("arc", [0, 0, 0], yoke, { rot: [180, 90, 0], color: dark, round: 0.02 }),  // lower C-yoke (wraps -Y, ⟂)
    N("cyl", [0, r * reach, 0], [r * 0.2, r * 0.5], { color: steel, round: 0.03 }),   // upper member shaft
    N("cyl", [0, -r * reach, 0], [r * 0.2, r * 0.5], { color: steel, round: 0.03 }),  // lower member shaft
    N("sphere", [0, 0, 0], [r * ballRadius], { color: steel, round: 0 }),             // the polished ball
    N("cyl", [0, 0, r * (ballRadius + 0.02)], [r * 0.12, r * 0.05], { rot: [90, 0, 0], color: brass, round: 0.01, stage: 2 }), // hub bolt
  ];
}

export const JOINT_BUILDERS = { hinge: hingeJoint, hingePivot: hingePivotJoint, pivot: pivotJoint, ball: ballJoint };
export const JOINT_NAMES = ["hinge", "hingePivot", "pivot", "ball"];

// build ONE joint, centred, for the reference view. returns a render model in the
// same shape rigToPrimitives produces ({ nodes, floorY, midY, dist }).
//   style.which  = joint name to render (default: first)
//   style.params = { [name]: overrides } merged over JOINT_PARAMS
export function jointCatalog(style = {}) {
  const r = style.r ?? 0.6;
  const params = style.params || {};
  const name = JOINT_BUILDERS[style.which] ? style.which : JOINT_NAMES[0];
  const bp = { r, accent: style.accent, ...JOINT_PARAMS[name], ...(params[name] || {}) };
  const bevel = bp.bevel ?? 1;
  // scale every edge round by the joint's bevel (softness)
  const nodes = JOINT_BUILDERS[name](bp).map((n) => ({ ...n, round: (n.round ?? 0) * bevel }));
  return { nodes, floorY: -1.6, midY: 0.15, dist: 5.5, name };
}
