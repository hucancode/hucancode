// LEGO Classic Bald Eagle (11015) — as an assembly graph.
// parts = the bricks (notation/preset specs, each with a color key).
// connections = how they clutch together (face + offset + twist). Positions and
// heights are derived by the assembly resolver; no hand coordinates.
// +Z = front (head/beak), -Z = back (tail), +X = right wing, Y = up.

export const PALETTE = {
  BR: "#6b3f23", WH: "#ededed", YE: "#f4c020", BK: "#15171c",
};

export const MODEL = {
  parts: {
    base:      { type: "curve", sx: 2, sz: 3, color: "YE" },              // yellow feet/breast
    body_f:    { type: "slope", inverted: true, sx: 2, sz: 3, color: "BR" },
    body_b:    { type: "slope", inverted: true, sx: 2, sz: 3, color: "BR" },
    deck:      { type: "plate", sx: 2, sz: 6, color: "BR" },              // long body spine
    tail:      { type: "wing",  sx: 6, sz: 3, cut: 2, color: "WH" },      // white triangle tail
    headmount: { type: "plate", sx: 2, sz: 2, color: "WH" },
    neck:      { type: "brick", sx: 2, sz: 1, color: "BR" },
    head:      { type: "brick", sx: 2, sz: 1, color: "WH" },
    crown:     { type: "curve", sx: 2, sz: 2, color: "WH" },             // forehead cover
    beak:      { type: "curve", sx: 2, sz: 1, color: "YE" },
    eyeL:      { type: "round", studs: false, radius: 0.26, h: 0.16, color: "BK" },
    eyeR:      { type: "round", studs: false, radius: 0.26, h: 0.16, color: "BK" },
  },
  root: "base",
  baseY: 0,
  connections: [
    // lower body: two inverted slopes clutch onto the yellow base, thick ends in
    { a: "base",      b: "body_f", on: "top", off: [0, 0.5], angle: 0 },
    { a: "base",      b: "body_b", on: "top", off: [0, -0.5], angle: 180 },
    // long brown deck across the body
    { a: "body_f",    b: "deck",   on: "top", off: [0, -1.0] },
    // tail triangle at the back, head stack at the front
    { a: "deck",      b: "tail",   on: "top", off: [0, -2.0], angle: 180 },
    { a: "deck",      b: "headmount", on: "top", off: [0, 2.0] },
    { a: "headmount", b: "neck",   on: "top" },
    { a: "neck",      b: "head",   on: "top" },
    { a: "head",      b: "crown",  on: "top" },
    // beak on the head's front face; eyes on the side faces
    { a: "head",      b: "beak",   on: "front" },
    { a: "head",      b: "eyeL",   on: "left" },
    { a: "head",      b: "eyeR",   on: "right" },
  ],
};

// vertical look-at target + camera distance for framing
export const VIEW = { lookY: 2.4, dist: 17 };
