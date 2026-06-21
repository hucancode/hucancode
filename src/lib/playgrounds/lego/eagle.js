// LEGO Classic Bald Eagle (11015) — as an assembly graph.
// parts = the bricks (notation/preset specs, each with a color key).
// connections = how they clutch together (face + offset + twist). Positions and
// heights are derived by the assembly resolver; no hand coordinates.
// +Z = front (head/beak), -Z = back (tail), +X = right wing, Y = up.

export const PALETTE = {
  BR: "#6b3f23", WH: "#ededed", YE: "#f4c020", BK: "#15171c",
};

// every part = an op-model brick: integer box `size:[W,H,D]` (studs X, plates Y,
// studs Z) plus an ordered `ops` list (slope / push / studs). studs y+ male up,
// y- female down makes a stackable piece; cuts shape the silhouette.

export const MODEL = {
  parts: {
    // yellow curved breast/feet
    base: { size: [2, 3, 3], ops: [{ op: "slope", face: "y+", dir: 1, length: 1, depth: 3, round: true }, { op: "studs", face: "y+", kind: "male" }], color: "YE", round: false },
    // two brown slopes form the lower body
    body_f: { size: [2, 3, 3], ops: [{ op: "slope", face: "y+", dir: 1, length: 2, depth: 2, round: false }, { op: "studs", face: "y+", kind: "male" }], color: "BR" },
    body_b: { size: [2, 3, 3], ops: [{ op: "slope", face: "y+", dir: 1, length: 2, depth: 2, round: false }, { op: "studs", face: "y+", kind: "male" }], color: "BR" },
    deck: { size: [2, 1, 6], ops: [{ op: "studs", face: "y+" }, { op: "studs", face: "y-", kind: "female" }], color: "BR" },              // long body spine
    tail: { size: [6, 1, 3], ops: [{ op: "slope", face: "x-", dir: -1, length: 2, depth: 2, round: false }, { op: "slope", face: "x+", dir: -1, length: 2, depth: 2, round: false }, { op: "studs", face: "y+", kind: "male" }], color: "WH", round: false, cornerR: 0.5 },
    headmount: { size: [2, 1, 2], ops: [{ op: "studs", face: "y+" }, { op: "studs", face: "y-", kind: "female" }], color: "WH" },
    neck: { size: [2, 3, 1], ops: [{ op: "studs", face: "y+" }, { op: "studs", face: "y-", kind: "female" }], color: "BR" },
    head: { size: [2, 3, 2], ops: [{ op: "studs", face: "y+", kind: "male" }, { op: "studs", face: "y-", kind: "female" }], color: "WH" },
    crown: { size: [2, 3, 2], ops: [{ op: "slope", face: "y+", dir: 1, length: 2, depth: 2, round: true }, { op: "studs", face: "y+", at: { row: 0 } }], color: "WH" }, // forehead
    beak: { size: [2, 3, 1], ops: [{ op: "slope", face: "y+", dir: 1, length: 1, depth: 2, round: true }, { op: "studs", face: "y+", at: { row: 0 } }], color: "YE" },
    eyeL: { size: [1, 1, 1], ops: [], color: "BK", round: true },
    eyeR: { size: [1, 1, 1], ops: [], color: "BK", round: true },
  },
  root: "base",
  baseY: 0,
  connections: [
    // lower body: two inverted slopes clutch onto the yellow base, thick ends in
    { a: "base", b: "body_f", on: "top", off: [0, 1], rot: [0, 0, 180] },
    { a: "base", b: "body_b", on: "top", off: [0, -2], rot: [180, 0, 0] },
    // long brown deck spanning the two body slopes (world-axis mount: the bodies'
    // flip stays local, so the deck and head stack ride upright on top)
    { a: "body_f", b: "deck", on: "top", off: [0, -2] },
    // tail triangle at the back, head stack at the front
    { a: "deck", b: "tail", on: "top", off: [0, -4], rot: [0, 180, 0] },
    { a: "deck", b: "headmount", on: "top", off: [0, 2] },
    { a: "headmount", b: "neck", on: "top", off: [0, 0] },
    { a: "neck", b: "head", on: "top", off: [0, 0] },
    { a: "head", b: "crown", on: "top", off: [0, 0] },
    // beak on the head's front face; eyes on the side faces
    { a: "head", b: "beak", on: "front" },
    { a: "head", b: "eyeL", on: "left", rot: [0, 0, 90], off: [0, 0] },
    { a: "head", b: "eyeR", on: "right", rot: [0, 0, 90] },
  ],
};

// vertical look-at target + camera distance for framing
export const VIEW = { lookY: 2.4, dist: 17 };
