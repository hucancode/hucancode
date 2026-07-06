// LEGO Bald
// parts = the brick library (notation/preset specs, each with a color key).
// root = the assembly tree; each node clones a brick and stores how it clutches
// onto its parent (face + offset + twist). Positions and heights are derived by
// the assembly resolver; no hand coordinates. A brick reused by several nodes is
// defined once (the two wings/bodies, two eyes share one spec each).
// +Z = front (head/beak), -Z = back (tail), +X = right wing, Y = up.

export const PALETTE = {
  BR: "#6b3f23", WH: "#ededed", YE: "#f4c020", BK: "#15171c",
};

// every part = an op-model brick: integer box `size:[W,H,D]` (studs X, plates Y,
// studs Z) plus an ordered `ops` list (slope / push / studs). studs y+ male up,
// y- female down makes a stackable piece; cuts shape the silhouette.
export const MODEL = {
  parts: {
    base: { size: [2, 3, 3], ops: [{ op: "slope", face: "y+", dir: 1, length: 1, depth: 3, round: true }, { op: "studs", face: "y+", kind: "male" }], color: "YE" },
    body: { size: [2, 3, 3], ops: [{ op: "slope", face: "y+", dir: 1, length: 2, depth: 2, round: false }, { op: "studs", face: "y+", kind: "female" }, { op: "studs", face: "y-", kind: "male" }], color: "BR" },
    deck: { size: [4, 1, 6], ops: [{ op: "studs", face: "y+", kind: "male" }, { op: "studs", face: "y-", kind: "female" }], color: "BR", round: true },
    tail: { size: [6, 1, 3], ops: [{ op: "slope", face: "x-", dir: -1, length: 2, depth: 2, round: false }, { op: "slope", face: "x+", dir: -1, length: 2, depth: 2, round: false }, { op: "studs", face: "y+", kind: "male" }, { op: "studs", face: "y-", kind: "female" }], color: "WH" },
    chest: { size: [2, 1, 2], ops: [{ op: "studs", face: "y+" }, { op: "studs", face: "y-", kind: "female" }], color: "WH" },
    neck: { size: [2, 3, 1], ops: [{ op: "studs", face: "y+" }, { op: "studs", face: "y-", kind: "female" }], color: "BR" },
    head: { size: [2, 3, 2], ops: [{ op: "studs", face: "y+", kind: "male" }, { op: "studs", face: "y-", kind: "female" }, { op: "studs", face: "x+", kind: "female", at: { cell: [1, 0] } }, { op: "studs", face: "x-", kind: "female", at: { cell: [1, 0] } }], color: "WH" },
    crown: { size: [2, 3, 2], ops: [{ op: "slope", face: "y+", dir: 1, length: 2, depth: 2, round: true }, { op: "studs", face: "y-", kind: "female" }], color: "WH" },
    beak: { size: [2, 3, 1], ops: [{ op: "slope", face: "y+", dir: 1, length: 1, depth: 2, round: true }, { op: "studs", face: "z-", kind: "female" }], color: "YE" },
    eye: { size: [1, 1, 1], ops: [{ op: "studs", face: "y+", kind: "male" }], color: "BK", round: true },
    backCover: { size: [4, 3, 3], ops: [{ op: "studs", face: "y-", kind: "female" }, { op: "slope", face: "y+", dir: 1, length: 2, depth: 2, round: true }, { op: "slope", face: "y+", dir: -1, length: 2, depth: 2, round: true }], color: "BR" },
  },
  baseY: 0,
  root: {
    part: "base",
    children: [
      { part: "body", on: "top", off: [0, 1], rot: [0, 0, 180], children: [
        { part: "deck", on: "top", off: [0, -2], children: [
          { part: "tail", on: "top", off: [0, -4], rot: [0, 180, 0] },
          { part: "chest", on: "top", off: [0, 2], children: [
            { part: "neck", on: "top", off: [0, 0], children: [
              { part: "head", on: "top", off: [0, 0], children: [
                { part: "crown", on: "top", off: [0, 0] },
                { part: "beak", on: "front" },
                { part: "eye", on: "left", rot: [0, 0, 270], off: [0, 0] },
                { part: "eye", on: "right", rot: [0, 0, 90] },
              ] },
            ] },
          ] },
          { part: "backCover", on: "top", off: [0, -1], rot: [0, 0, 0] },
        ] },
      ] },
      { part: "body", on: "top", off: [0, -2], rot: [180, 0, 0] },
    ],
  },
};

// vertical look-at target + camera distance for framing
export const VIEW = { lookY: 2.4, dist: 17 };
