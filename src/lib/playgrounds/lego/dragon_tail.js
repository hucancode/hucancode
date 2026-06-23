// LEGO Dragon TAIL — a tapering chain of segments strung on BALL joints, curling
// to a barbed tip. Same bone scheme as the limbs: each segment carries a male
// ball at +X and a female socket at -X, so segment N seats on segment N-1.
// Lengths shrink down the chain; the tip ramps to a spike. `jrot` curls it.
// +X = down the tail (toward the tip), Y = up, +Z = right.

export const PALETTE = {
  GR: "#3a7d2c", DK: "#1f5d1a", RD: "#c1272d", BK: "#15171c",
};

export const MODEL = {
  parts: {
    tailA: { size: [5, 3, 3], ops: [
      { op: "ball", face: "x+", kind: "male", at: { cell: [1, 1] } },
      { op: "ball", face: "x-", kind: "female", at: { cell: [1, 1] } },
    ], color: "GR", round: true },
    tailB: { size: [4, 3, 3], ops: [
      { op: "ball", face: "x+", kind: "male", at: { cell: [1, 1] } },
      { op: "ball", face: "x-", kind: "female", at: { cell: [1, 1] } },
    ], color: "GR", round: true },
    tailC: { size: [3, 3, 3], ops: [
      { op: "ball", face: "x+", kind: "male", at: { cell: [1, 1] } },
      { op: "ball", face: "x-", kind: "female", at: { cell: [1, 1] } },
    ], color: "DK", round: true },
    // barbed tip: ramps to a point along +X (the slope drops the body to nothing at
    // the tail end), female socket on -X to seat on the last ball.
    tailTip: { size: [4, 3, 3], ops: [
      { op: "ball", face: "x-", kind: "female", at: { cell: [1, 1] } },
      { op: "slope", face: "y+", dir: 1, length: 4, depth: 3, round: true },
      { op: "slope", face: "y-", dir: 1, length: 4, depth: 0, round: true },
    ], color: "RD", round: true },
  },
  baseY: 4,
  root: { part: "tailA", children: [
    { part: "tailB", on: "right", joint: "ball", ah: 0, bh: 1, jrot: [0, 0, -18], children: [
      { part: "tailC", on: "right", joint: "ball", ah: 0, bh: 1, jrot: [0, 0, -24], children: [
        { part: "tailTip", on: "right", joint: "ball", ah: 0, bh: 0, jrot: [0, 0, -30] },
      ] },
    ] },
  ] },
};

// vertical look-at target + camera distance for framing
export const VIEW = { lookY: 3.0, dist: 24 };
