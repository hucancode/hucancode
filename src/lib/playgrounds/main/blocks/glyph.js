// Glyph block: the symbol traces itself in during B3 (approach) while it rises
// from below the screen to mid-screen — the dragon does NOT ride it.
//
// The glyph sits at station Y == ensoCenter.y, BELOW the camera at the start of
// B3, so it is off-screen until the descending camera nears it (it enters the
// bottom of the screen ~GLYPH_RISE_DELAY into the block). The trace is delayed to
// that moment so the user watches the WHOLE reveal on-screen — not a half-drawn
// glyph that pops in. It finishes exactly as the glyph reaches mid-screen (block
// end), then holds and eases back to GLYPH_FADE_TARGET as the 3D dragon takes over.

import { track } from "../stage/index.js";
import { BLOCK_DUR, GLYPH_FADE_TARGET } from "../config.js";

// block-local time the glyph clears the screen bottom (camY ~ stationY + 1). With
// a 5s approach descending CORRIDOR_DROP/descentEnd per second, this is ~half-way.
const GLYPH_RISE_DELAY = BLOCK_DUR.approach * 0.5;

export function createGlyphBlock({ timing, glyph }) {
  // local-time keyframe anchors (relative to approachStart)
  const toCrossfade = timing.crossfadeStart - timing.approachStart;
  const toLoop3 = timing.loop3Start - timing.approachStart;
  const traceDur = BLOCK_DUR.approach - GLYPH_RISE_DELAY; // trace across the visible rise
  return {
    name: "glyph",
    at: timing.approachStart,
    outputs: ["playhead", "glyphAlpha"],
    defaults(ctx) { ctx.playhead = 0; ctx.glyphAlpha = 0; },
    tracks: {
      // hold playhead at 0 until the glyph clears the screen bottom, then trace the
      // full symbol over the visible rise (lead shifts the ramp start later).
      playhead: track.tween(0, glyph.total, { dur: traceDur, lead: -GLYPH_RISE_DELAY }),
      glyphAlpha: track.keyframes([
        { at: GLYPH_RISE_DELAY - 1.0, v: 0 },
        { at: GLYPH_RISE_DELAY, v: 1, ease: "smooth" }, // up as it enters the frame
        { at: toCrossfade, v: 1 },
        { at: toLoop3, v: GLYPH_FADE_TARGET, ease: "smooth" },
      ]),
    },
  };
}
