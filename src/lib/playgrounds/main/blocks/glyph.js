import { track } from "../stage/index.js";
import { BLOCK_DUR, GLYPH_FADE_TARGET } from "../config.js";

// local time glyph clears screen bottom (camY ~ stationY + 1). 5s approach
// descending CORRIDOR_DROP/descentEnd per sec -> ~half-way.
const GLYPH_RISE_DELAY = BLOCK_DUR.approach * 0.5;

export function createGlyphBlock({ timing, glyph }) {
  const toCrossfade = timing.crossfadeStart - timing.approachStart;
  const toLoop3 = timing.loop3Start - timing.approachStart;
  const traceDur = BLOCK_DUR.approach - GLYPH_RISE_DELAY; // trace across visible rise
  return {
    name: "glyph",
    at: timing.approachStart,
    outputs: ["playhead", "glyphAlpha"],
    defaults(ctx) { ctx.playhead = 0; ctx.glyphAlpha = 0; },
    tracks: {
      playhead: track.tween(0, glyph.total, { dur: traceDur, lead: -GLYPH_RISE_DELAY }),
      glyphAlpha: track.keyframes([
        { at: GLYPH_RISE_DELAY - 1.0, v: 0 },
        { at: GLYPH_RISE_DELAY, v: 1, ease: "smooth" },
        { at: toCrossfade, v: 1 },
        { at: toLoop3, v: GLYPH_FADE_TARGET, ease: "smooth" },
      ]),
    },
  };
}
