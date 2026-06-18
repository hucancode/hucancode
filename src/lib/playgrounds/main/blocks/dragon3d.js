// Dragon3d block: fades the 3D dragon in FIRST (over the still-solid, coincident
// 2D ink) then it loops forever; also eases the glyph ink back during the
// transition. Persistent. The mesh draw params are written elsewhere (the dragon3d
// model writes _frame.dragon3d); this block only owns the opacities.

import { ramp } from "$lib/math/scalar.js";
import { GLYPH_FADE_TARGET } from "../config.js";

export function createDragon3dBlock({ timing }) {
  return {
    name: "dragon3d",
    // Active from the START of the crossfade (d3Start), not the handoff point at
    // its END (timing.branch): the fade-in window [d3Start, d3Mid] and the glyph
    // ease-back [d3Start, d3End] both lie BEFORE the branch, so a block that only
    // woke at the branch never ran them — d3Alpha snapped 0 -> 1 instead of fading.
    at: timing.d3Start,
    outputs: ["d3Alpha"],
    defaults(ctx) { ctx.d3Alpha = 0; },
    update(ctx) {
      ctx.d3Alpha = ramp(ctx.t, timing.d3Start, timing.d3Mid, 0, 1); // fades in, then loops forever
      ctx.glyphAlpha = ramp(ctx.t, timing.d3Start, timing.d3End, 1, GLYPH_FADE_TARGET); // glyph eases back
    },
  };
}
