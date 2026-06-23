// LEGO Dragon LEG — thigh, shin and foot strung on BALL joints, the foot a flat
// sole plank splaying three clawed toes. Same bone scheme as the arm: a male ball
// at +X drives the next joint, a female socket at -X seats on the previous one.
// The chain bends back at the knee then forward at the ankle (a digitigrade pose).
// +X = down the limb (toward the foot), Y = up, +Z = right.

export const PALETTE = {
  GR: "#3a7d2c", DK: "#1f5d1a", BR: "#5b3a1e", BK: "#15171c",
};

export const MODEL = {
  parts: {
    // thigh: thick upper bone. Male ball (+X, op 0), female socket (-X, op 1).
    thigh: { size: [4, 4, 4], ops: [
      { op: "ball", face: "x+", kind: "male", at: { cell: [1, 1] } },
      { op: "ball", face: "x-", kind: "female", at: { cell: [1, 1] } },
    ], color: "GR", round: true },

    // shin: slimmer lower bone, same joint layout.
    shin: { size: [4, 3, 3], ops: [
      { op: "ball", face: "x+", kind: "male", at: { cell: [1, 1] } },
      { op: "ball", face: "x-", kind: "female", at: { cell: [1, 1] } },
    ], color: "GR", round: true },

    // sole: flat foot plank. Female socket on -X cups the ankle ball; +X grows
    // studs the toes grip.
    sole: { size: [2, 1, 5], ops: [
      { op: "ball", face: "x-", kind: "female", at: { cell: [2, 0] } },
      { op: "studs", face: "x+", kind: "male" },
    ], color: "DK", round: true },

    // toe: an I-stick claw rod (long axis Z), tapered to a point at end 0. The
    // node twists it 90° about Y so the claw points out +X off the sole.
    toe: { stick: "I", len: 1.0, size: [1, 1, 2], tips: [0], ops: [], color: "BR" },
  },
  baseY: 6,
  root: { part: "thigh", children: [
    { part: "shin", on: "right", joint: "ball", ah: 0, bh: 1, jrot: [0, 0, 40], children: [
      { part: "sole", on: "right", joint: "ball", ah: 0, bh: 0, jrot: [0, 0, -50], children: [
        { part: "toe", on: "right", off: [-2, 0], rot: [0, 90, 0] },
        { part: "toe", on: "right", off: [0, 0], rot: [0, 90, 0] },
        { part: "toe", on: "right", off: [2, 0], rot: [0, 90, 0] },
      ] },
    ] },
  ] },
};

// vertical look-at target + camera distance for framing
export const VIEW = { lookY: 4.0, dist: 22 };
