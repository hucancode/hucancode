// Glyph block: drives the symbol's reveal playhead. Persistent (at 0 through the
// lead-in, traces while the head rides it, then holds the symbol). The reveal
// trails the head by LEAD_OFFSET so the dragon LEADS the fill; after the head
// peels onto the enso it keeps drawing the rest at the same speed.

import { clamp } from "$lib/math/scalar.js";
import { GLYPH_TRACE_DUR, LEAD_OFFSET } from "../config.js";

export function createGlyphBlock({ timing, glyph }) {
  return {
    name: "glyph",
    at: 0,
    branches: { end: timing.glyphEnd },
    outputs: ["playhead", "glyphAlpha"],
    defaults(ctx) { ctx.playhead = glyph.total; ctx.glyphAlpha = 1.0; }, // glyphAlpha eased by dragon3d
    update(ctx) {
      const speed = glyph.exitPh / GLYPH_TRACE_DUR; // playhead units / sec
      ctx.playhead = clamp((ctx.t - timing.glyphStart - LEAD_OFFSET) * speed, 0, glyph.total);
    },
  };
}
