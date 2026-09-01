// SCULPT REFERENCE — the "sculpt" playground view: one sculpted primitive on
// its own with its surface controls exposed. Purely a viewer; the geometry
// lives in sculpt.js.
import { sculptBox, sculptCylinder, sculptSphere } from "./sculpt.js";
import { bake, modelOf } from "./primitives.js";
import { colorOf } from "./color.js";

export const SHAPE_PARAMS = {
  box: { w: 1.6, h: 1.6, d: 1.6 },
  cylinder: { r: 0.8, h: 2 },
  sphere: { r: 1 },
};
export const SHAPE_NAMES = Object.keys(SHAPE_PARAMS);

const SHAPE_BUILD = {
  box: (p, sc) => sculptBox(p.w, p.h, p.d, sc),
  cylinder: (p, sc) => sculptCylinder(p.r, p.h, sc),
  sphere: (p, sc) => sculptSphere(p.r, sc),
};

// Deliberately NOT kit.js's collect(): that colors by shape id, and a sculpted
// shape's id carries its sculpt params, so every slider nudge would repaint the
// model. Coloring by shape NAME instead keeps the color still while sculpting —
// the seed only moves when the user asks for a new color.
export function sculptModel(name, params, sc, seed = 1) {
  const key = SHAPE_BUILD[name] ? name : SHAPE_NAMES[0];
  const p = { ...SHAPE_PARAMS[key], ...(params || {}) };
  const b = bake(SHAPE_BUILD[key](p, sc));
  return modelOf([{ ...b, color: colorOf(key, seed) }]);
}
