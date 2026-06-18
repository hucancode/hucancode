// Dragon3d block: fades the 3D dragon in FIRST (over the still-solid, coincident
// 2D ink) then it loops forever; also eases the glyph ink back during the
// transition. Persistent. The mesh draw params are written elsewhere (the dragon3d
// model writes _frame.dragon3d); this block only owns the opacities.

import { ramp } from "$lib/math/scalar.js";
import { GLYPH_FADE_TARGET } from "../config.js";

export function createDragon3dBlock({ timing }) {
  return {
    name: "dragon3d",
    after: { block: "inkDragon", branch: "handoff" },
    outputs: ["d3Alpha"],
    defaults(ctx) { ctx.d3Alpha = 0; },
    update(ctx) {
      ctx.d3Alpha = ramp(ctx.t, timing.d3Start, timing.d3Mid, 0, 1); // fades in, then loops forever
      ctx.glyphAlpha = ramp(ctx.t, timing.d3Start, timing.d3End, 1, GLYPH_FADE_TARGET); // glyph eases back
    },
  };
}
