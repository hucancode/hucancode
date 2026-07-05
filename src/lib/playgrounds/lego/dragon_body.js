// LEGO Dragon BODY SEGMENT — one chainable spine link, assembly tree.
// Spine runs along X (6 studs long). Each end carries a hinge so links snap in
// series and flex up/down: female knuckle at the -X end, male knuckle at +X.
// A back plank (top) and belly plank (bottom) clad the core, both beveled on
// their two long (+-Z) sides. Six dorsal fins ride the back ridge in a
// small-big-small-small-big-small pattern.
// +Z = right flank, -Z = left flank, +X = head end (male), -X = tail end, Y = up.

export const PALETTE = {
  GR: "#3a7d2c", DK: "#1f5d1a", RD: "#c1272d", BK: "#15171c",
};

export const MODEL = {
  parts: {
    // 6x3x3 spine core: female hinge at -X end, male hinge at +X end (pin = Z,
    // so the chain folds vertically). Cell [1,1] = the mid-height center of each
    // end face.
    core: { size: [6, 3, 3], ops: [
      { op: "hinge", face: "x-", pin: "z", kind: "female", shape: "O", at: { cell: [1, 1] } },
      { op: "hinge", face: "x+", pin: "z", kind: "male", shape: "O", at: { cell: [1, 1] } },
    ], color: "GR", round: false },

    // back plank: ridge tile clutched onto the core top. Both long (+-Z) sides are
    // shaved down (dual y+ slopes) leaving the middle Z row intact — that row keeps
    // its studs, the dorsal mount line for the fins.
    backPlank: { size: [6, 2, 3], ops: [
      { op: "slope", face: "y+", dir: 1, length: 1, depth: 1, round: true },
      { op: "slope", face: "y+", dir: -1, length: 1, depth: 1, round: true },
      { op: "studs", face: "y-", kind: "female" },
      { op: "studs", face: "y+", kind: "male" },
    ], color: "DK", round: false },

    // belly plank: same ridge tile flipped under the core, beveled on its +-Z
    // underside. Clutches up onto the core bottom.
    bellyPlank: { size: [6, 2, 3], ops: [
      { op: "slope", face: "y-", dir: 1, length: 1, depth: 1, round: true },
      { op: "slope", face: "y-", dir: -1, length: 1, depth: 1, round: true },
      { op: "studs", face: "y+", kind: "female" },
    ], color: "DK", round: false },

    // flank planks: clad the two +-Z sides so back + belly planks are boxed in by 4
    // planks total. Thin in Z, full length/height; female clutch on both inward
    // faces so one part serves the front (z+) and back (z-) flank.
    sidePlank: { size: [6, 3, 1], ops: [
      { op: "studs", face: "z+", kind: "female" },
      { op: "studs", face: "z-", kind: "female" },
    ], color: "DK", round: false },

    // dorsal fins: vertical sails, curved leading edge (y+ slope to a point),
    // female clutch underneath. Two sizes drive the S-B-S-S-B-S rhythm.
    finS: { size: [1, 2, 2], ops: [
      { op: "slope", face: "y+", dir: 1, length: 2, depth: 2, round: true },
      { op: "studs", face: "y-", kind: "female" },
    ], color: "RD", round: false },
    finB: { size: [1, 4, 2], ops: [
      { op: "slope", face: "y+", dir: 1, length: 2, depth: 4, round: true },
      { op: "studs", face: "y-", kind: "female" },
    ], color: "RD", round: false },
  },
  baseY: 2,
  root: { part: "core", children: [
    { part: "backPlank", on: "top", off: [0, 0], children: [
      // fins twist -90deg about Y so the triangular sail (built in the Z-Y plane)
      // stands in the X-Y plane — broad faces to the flanks, point up the spine.
      { part: "finS", on: "top", off: [-3, 0], rot: [0, -90, 0] },
      { part: "finB", on: "top", off: [-2, 0], rot: [0, -90, 0] },
      { part: "finS", on: "top", off: [-1, 0], rot: [0, -90, 0] },
      { part: "finS", on: "top", off: [0, 0], rot: [0, -90, 0] },
      { part: "finB", on: "top", off: [1, 0], rot: [0, -90, 0] },
      { part: "finS", on: "top", off: [2, 0], rot: [0, -90, 0] },
    ] },
    { part: "bellyPlank", on: "bottom", off: [0, 0] },
    { part: "sidePlank", on: "front", off: [0, 0] },
    { part: "sidePlank", on: "back", off: [0, 0] },
  ] },
};

// vertical look-at target + camera distance for framing
export const VIEW = { lookY: 2.4, dist: 18 };
