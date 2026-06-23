// LEGO Shenlong-style Dragon Head — assembly graph with two articulated joints.
// Eastern dragon: long green muzzle, cream underside/jaw, brown swept-back antlers,
// green side frills, red eyes, brown whiskers. The HEAD tilts on the NECK via a
// BALL joint (3-DOF); the lower JAW swings open on a HINGE (1-DOF, pin across X).
// +Z = front (snout/nostrils), -Z = back, +X = right, Y = up.

export const PALETTE = {
  GR: "#3a7d2c", DK: "#1f5d1a", TN: "#d9c7a0", BR: "#5b3a1e",
  RD: "#c1272d", BK: "#15171c", WH: "#ededed",
};
export const MODEL = {
  parts: {
    neck: { size: [3, 4, 2], ops: [{ op: "ball", face: "z-", kind: "male", at: { cell: [1, 0] } }, { op: "push", face: "z+", depth: 1, width: 5, height: 3, at: [0, 0] }], color: "DK", round: false },
    head: { size: [3, 3, 5], ops: [{ op: "ball", face: "y-", kind: "female", at: { cell: [1, 0] } }, { op: "hinge", face: "y-", pin: "x", kind: "female", shape: "O", at: { cell: [1, 2] } }, { op: "slope", face: "y+", dir: 1, length: 2, depth: 1, round: true }, { op: "studs", face: "y+", kind: "male" }], color: "GR" },
    snout: { size: [3, 3, 1], ops: [{ op: "slope", face: "y+", dir: 1, length: 1, depth: 1, round: true }, { op: "studs", face: "z+", kind: "male" }], color: "GR" },
    lipU: { size: [3, 1, 2], ops: [{ op: "studs", face: "y-", kind: "male", at: { row: 1 } }], color: "TN", round: false },
    jaw: { size: [3, 1, 4], ops: [{ op: "hinge", face: "y+", pin: "x", kind: "male", shape: "O", at: { cell: [1, 0] } }, { op: "studs", face: "y+", kind: "male", at: { row: 3 } }, { op: "studs", face: "y+", kind: "male", at: { col: 0 } }, { op: "studs", face: "y+", kind: "male", at: { col: 2 } }], color: "TN", round: false },
    antler: { size: [1, 4, 1], ops: [{ op: "slope", face: "y+", dir: 1, length: 4, depth: 1, round: true }, { op: "studs", face: "y-", kind: "female" }], color: "BR" },
    frill: { size: [1, 1, 3], ops: [{ op: "slope", face: "z+", dir: 1, length: 2, depth: 1, round: true }], color: "DK", round: false },
    eye: { size: [1, 1, 1], ops: [{ op: "studs", face: "y+", kind: "male" }], color: "RD", round: true },
  },
  root: "neck",
  baseY: 0,
  connections: [
    { a: "neck", b: "head", on: "top", attach: "face", off: [0, 1] },
    { a: "head", b: "jaw", on: "bottom", joint: "hinge", jpitch: 30, jyaw: 0 },
    { a: "head", b: "snout", on: "front", off: [0, 0], local: true, rot: [0, 0, 0] },
    { a: "head", b: "lipU", on: "bottom", off: [0, 2], local: true },
    { a: "head", b: "antler", on: "top", off: [-1, -2], rot: [0, 0, 0], local: true },
    { a: "head", b: "antler", on: "top", off: [1, -2], rot: [0, 0, 0], local: true },
    { a: "head", b: "frill", on: "left", off: [-1, 0], rot: [180, 180, 0], local: true },
    { a: "head", b: "frill", on: "right", off: [-1, 0], rot: [0, 0, 0], local: true },
    { a: "head", b: "eye", on: "left", off: [1, 0], rot: [0, 0, 270], local: true },
    { a: "head", b: "eye", on: "right", off: [1, 0], rot: [0, 0, 90], local: true },
  ],
};

// vertical look-at target + camera distance for framing
export const VIEW = { lookY: 3.6, dist: 18 };
