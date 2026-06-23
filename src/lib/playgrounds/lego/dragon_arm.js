// LEGO Dragon ARM — two segments strung on BALL joints (3-DOF each), ending in
// a flat hand plank that splays three fingers. The arm runs along X: each segment
// carries a male ball at its +X end and a female socket at its -X end, so segment
// N's socket cups segment N-1's ball. `joint:"ball"` + `jrot` poses every joint.
// +X = outward (toward the hand), Y = up, +Z = right.

export const PALETTE = {
  GR: "#3a7d2c", DK: "#1f5d1a", TN: "#d9c7a0", BK: "#15171c",
};

export const MODEL = {
  parts: {
    bone: { size: [4, 3, 3], ops: [{ op: "ball", face: "x+", kind: "male", at: { cell: [1, 1] } }, { op: "ball", face: "x-", kind: "female", at: { cell: [1, 1] } }], color: "GR", round: true },
    hand: { size: [2, 1, 3], ops: [{ op: "ball", face: "x-", kind: "female", at: { cell: [1, 0] } }, { op: "studs", face: "x+", kind: "male" }], color: "DK", round: true },
    finger_tip: { stick: "I", len: 0.4, size: [1, 1, 1], tips: [0], ops: [{ op: "ball", end: 1, kind: "female" }], color: "TN" },
    finger: { stick: "I", len: 0.1, size: [1, 1, 1], ops: [{ op: "studs", end: 1, kind: "female" }, { op: "ball", end: 0, kind: "male" }], color: "GR" },
  },
  baseY: 5,
  root: { part: "bone", children: [
    { part: "bone", on: "right", joint: "ball", ah: 0, bh: 1, jrot: [0, 0, -30], children: [
      { part: "hand", on: "right", joint: "ball", ah: 0, bh: 0, jrot: [0, 0, -20], children: [
        { part: "finger", on: "right", off: [-1, 0], rot: [0, 90, 0], children: [
          { part: "finger_tip", on: "right", off: [0, 0], rot: [0, 90, 0] }
        ] },
        { part: "finger", on: "right", off: [0, 0], rot: [0, 90, 0], children: [
          { part: "finger_tip", on: "right", off: [0, 0], rot: [0, 90, 0] }
        ] },
        { part: "finger", on: "right", off: [1, 0], rot: [0, 90, 0], children: [
          { part: "finger_tip", on: "right", off: [0, 0], rot: [0, 90, 0] }
        ] }
      ] }
    ] }
  ] },
};

// vertical look-at target + camera distance for framing
export const VIEW = { lookY: 3.5, dist: 20 };
