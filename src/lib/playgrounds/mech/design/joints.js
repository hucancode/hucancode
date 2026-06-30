// JOINT CATALOG — a reference library of mechanical joints, each built as real
// SDF hardware so its SHAPE reads its motion at a glance:
//   hinge  (1-axis pitch) -> a female U clevis + a male I tongue, pin HORIZONTAL
//   pivot  (1-axis yaw)   -> two rings stacked, a shaft pierced VERTICALLY
//   ball   (3-axis)       -> two sockets clamping one ball between them
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
  hinge: { ratio: 0.44, gapRatio: 0.25, height: 1.0, bevel: 0.2 },
  pivot: { radius: 0.72, thickness: 0.1, gap: 1.0, height: 1.0, bevel: 0.2 },
  ball: { ballRadius: 0.46, socketRadius: 0.95, gap: 0.04, socketHeight: 0.55, bevel: 0.2 },
};

const HINGE_FEMALE_W = 0.36; // the female U block half-width is fixed; male/gap scale off it

// HINGE — pin axis = X. A female U (solid block carved from below into a clevis)
// receives a male I (a slab with a rounded head on the pin axis). A brass pin
// runs horizontally through both. One axis of rotation, about X. The slot is a
// subtract emitted before the tongue, so the cut shapes only the U.
//   ratio    = male/female width (tongue vs U block)
//   gapRatio = slot clearance as a fraction of the tongue width
//   height   = vertical scale
export function hingeJoint(p = {}) {
  const { r = 0.55, ratio = 0.44, gapRatio = 0.25, height = 1.0 } = p;
  const femaleW = HINGE_FEMALE_W;
  const maleW = femaleW * ratio;       // tongue width derived from the ratio
  const gap = maleW * gapRatio;        // clearance scales with the tongue
  const slotHalf = maleW + gap;        // slot just clears the tongue + clearance
  const pinHalf = femaleW + 0.1;       // pin reaches past the U block's outer faces
  return [
    N("box", [0, r * 0.85 * height, 0], [r * femaleW, r * 0.62 * height, r * 0.5], { color: steel, round: 0.06 }), // U block
    N("box", [0, r * 0.45 * height, 0], [r * slotHalf, r * 0.5 * height, r * 0.7], { op: "subtract", round: 0.04 }), // slot -> clevis
    N("box", [0, -r * 0.2 * height, 0], [r * maleW, r * 0.7 * height, r * 0.34], { color: dark, round: 0.02 }), // I slab
    N("cyl", [0, r * 0.5 * height, 0], [r * 0.34, r * maleW], { rot: ROT_X, color: dark, round: 0.02 }), // rounded head
    N("cyl", [0, r * 0.5 * height, 0], [r * 0.12, r * pinHalf], { rot: ROT_X, color: brass, round: 0.02, stage: 2 }), // pin
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

// BALL — 3-axis. Two identical FEMALE sockets with a single ball clamped between
// them: the lower socket's cup faces UP, the upper socket's cup faces DOWN, and
// one brass ball seats in both, free to swivel. Each socket is a squashed dome =
// a spherical CAP (sphere with a box subtracting the far half; intersect would be
// globally destructive in this running CSG, so caps are cut, not intersected).
// ORDER: both socket bodies union, then the two cap cuts, then ONE cup subtract
// hollows the shared cavity in both domes, then the ball is unioned LAST so the
// cup-cut never carves it.
//   ballRadius = the ball       socketRadius = socket dome sphere radius
//   gap        = ball<->cup clearance   socketHeight = visible dome thickness
export function ballJoint(p = {}) {
  const { r = 0.55, ballRadius = 0.46, socketRadius = 0.95, gap = 0.04, socketHeight = 0.55 } = p;
  const sr = socketRadius, cupR = ballRadius + gap, sh = socketHeight;
  // cut box sized to the sphere: half-height reaches well past the far pole so a
  // big socketRadius never lets the far cap re-emerge; its TOP sits exactly on
  // the keep-plane (±sh), so only the sh-thick near cap survives.
  const boxHy = 2 * sr + 0.5, boxXZ = sr + 0.8, shaftC = sh + 0.45;
  return [
    N("sphere", [0, -r * sr, 0], [r * sr], { color: steel, round: 0 }), // lower socket body (pole at y=0)
    N("sphere", [0, r * sr, 0], [r * sr], { color: steel, round: 0 }),  // upper socket body
    N("box", [0, -r * (sh + boxHy), 0], [r * boxXZ, r * boxHy, r * boxXZ], { op: "subtract" }), // cut lower -> cup faces up
    N("box", [0, r * (sh + boxHy), 0], [r * boxXZ, r * boxHy, r * boxXZ], { op: "subtract" }),  // cut upper -> cup faces down
    N("sphere", [0, 0, 0], [r * cupR], { op: "subtract" }),             // hollow the shared cup in both domes
    N("cyl", [0, -r * shaftC, 0], [r * 0.2, r * 0.5], { color: steel, round: 0.03 }), // lower member shaft
    N("cyl", [0, r * shaftC, 0], [r * 0.2, r * 0.5], { color: steel, round: 0.03 }),  // upper member shaft
    N("sphere", [0, 0, 0], [r * ballRadius], { color: brass, round: 0 }), // the connecting ball
  ];
}

export const JOINT_BUILDERS = { hinge: hingeJoint, pivot: pivotJoint, ball: ballJoint };
export const JOINT_NAMES = ["hinge", "pivot", "ball"];

// lay the three joints in a row for the reference view. returns a render model
// in the same shape rigToPrimitives produces ({ nodes, floorY, midY, dist }).
// style.params = { hinge?, pivot?, ball? } overrides merged over JOINT_PARAMS.
export function jointCatalog(style = {}) {
  const r = style.r ?? 0.6;
  const layoutGap = style.gap ?? 2.8;
  const params = style.params || {};
  const order = JOINT_NAMES;
  const nodes = [];
  order.forEach((name, i) => {
    const x = (i - (order.length - 1) / 2) * layoutGap;
    const bp = { r, accent: style.accent, ...JOINT_PARAMS[name], ...(params[name] || {}) };
    const bevel = bp.bevel ?? 1;
    // scale every edge round by the joint's bevel (softness) before placing
    const built = JOINT_BUILDERS[name](bp).map((n) => ({ ...n, round: (n.round ?? 0) * bevel }));
    nodes.push(...place(built, [x, 0, 0]));
  });
  return { nodes, floorY: -1.6, midY: 0.15, dist: 9.5, name: "joint catalog" };
}
