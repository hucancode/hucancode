// Enso block: the head sweeps the circle (ensoSweep drives the shader stroke);
// held full after the sweep, then fades to ENSO_FADE_TARGET as the 3D dragon
// takes over. Starts after the glyph trace ends.

import { clamp, ramp } from "$lib/math/scalar.js";
import { LEAD_OFFSET, ENSO_DUR, ENSO_FADE_TARGET } from "../config.js";

export function createEnsoBlock({ timing }) {
  return {
    name: "enso",
    after: { block: "glyph", branch: "end" },
    outputs: ["ensoAlpha", "ensoSweep"],
    defaults(ctx) { ctx.ensoAlpha = 0; ctx.ensoSweep = 0; },
    update(ctx) {
      const t = ctx.t;
      ctx.ensoSweep = clamp((t - timing.ensoStart - LEAD_OFFSET) / ENSO_DUR, 0, 1); // trails head by LEAD_OFFSET
      const ensoIn = ramp(t, timing.ensoStart, timing.ensoStart + 0.3, 0, 1);
      const ensoFade = ramp(t, timing.d3Start, timing.d3End, 1, ENSO_FADE_TARGET);
      ctx.ensoAlpha = Math.min(ensoIn, ensoFade);
    },
  };
}
