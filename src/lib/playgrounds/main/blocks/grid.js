// Grid block: the ground grid wipes in RADIALLY from the origin right after the
// stroke is traced (the minor grid trails the major by GRID_MINOR_LAG). Persistent
// — holds revealed afterward.

import { clamp } from "$lib/math/scalar.js";
import { GRID_REVEAL_DUR, GRID_MINOR_LAG, GRID_MAX_OPACITY } from "../config.js";

export function createGridBlock() {
  return {
    name: "grid",
    after: { block: "inkDragon", branch: "traced" }, // reveal right after the stroke is traced
    outputs: ["gridStrength", "gridReveal", "gridRevealMinor"],
    defaults(ctx) { ctx.gridStrength = 0; ctx.gridReveal = 0; ctx.gridRevealMinor = 0; },
    update(ctx, local) {
      ctx.gridReveal = clamp(local / GRID_REVEAL_DUR, 0, 1);
      ctx.gridRevealMinor = clamp((local - GRID_MINOR_LAG) / GRID_REVEAL_DUR, 0, 1);
      ctx.gridStrength = ctx.gridReveal > 0 ? GRID_MAX_OPACITY : 0;
    },
  };
}
