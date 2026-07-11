// PRIMITIVE REFERENCE — the "blocks" catalog view: one primitive on its own,
// with its parameters exposed. Purely a viewer; the geometry lives in
// primitives.js and every kit builds out of the same functions.
import {
  box, cylinder, cone, coneCut, sphere, hemisphere, cutHemisphere, halfCylinder,
  halfCylinderBox, quarterCylinder, gear,
} from "./primitives.js";
import { collect } from "./kit.js";

export const PRIM_PARAMS = {
  cylinder: { r: 0.5, h: 1.2 },
  cone: { r: 0.5, h: 1.2 },
  coneCut: { r0: 0.5, r1: 0.25, h: 1.2 },
  box: { w: 1, h: 1, d: 1, slope: 0, curve: 0 },
  sphere: { r: 0.6 },
  hemisphere: { r: 0.6 },
  cutHemisphere: { r: 0.6, t: 0.25, cut: 0.7 },
  halfCylinder: { r: 0.5, h: 1.2 },
  halfCylinderBox: { r: 0.5, h: 1.2, depth: 0.5 },
  quarterCylinder: { r: 0.5, h: 0.3 },
  gear: { r: 0.6, h: 0.25, teethOut: 12, teethIn: 0 },
};
export const PRIM_NAMES = Object.keys(PRIM_PARAMS);

const PRIM_BUILD = {
  cylinder: (p) => cylinder(p.r, p.h),
  cone: (p) => cone(p.r, p.h),
  coneCut: (p) => coneCut(p.r0, p.r1, p.h),
  box: (p) => box(p.w, p.h, p.d, p.slope, p.curve),
  sphere: (p) => sphere(p.r),
  hemisphere: (p) => hemisphere(p.r),
  cutHemisphere: (p) => cutHemisphere(p.r, p.t, p.cut),
  halfCylinder: (p) => halfCylinder(p.r, p.h),
  halfCylinderBox: (p) => halfCylinderBox(p.r, p.h, p.depth),
  quarterCylinder: (p) => quarterCylinder(p.r, p.h),
  gear: (p) => gear(p.r, p.h, p.teethOut, p.teethIn),
};

export function primitiveModel(name, params, seed = 1) {
  const build = PRIM_BUILD[name] || PRIM_BUILD.cylinder;
  const p = { ...PRIM_PARAMS[name], ...(params || {}) };
  return collect((add) => add(build(p)), seed);
}
