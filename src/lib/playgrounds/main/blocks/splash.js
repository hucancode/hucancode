// Ink splash: a procedural-noise wash that bleeds in at the start and keeps
// spreading across the 2D phase, following the glyph trace (reveal-aware in the
// shader). Persistent: once the spread reaches full it holds under the 3D dragon.
//
// Starts at scene t=0, so block-local time == scene time; the smooth-eased tweens
// reproduce the old smooth(clamp(t/dur)) ramps.

import { track } from "../stage/index.js";
import { SPLASH_FADE_IN } from "../config.js";

export function createSplashBlock({ timing }) {
  return {
    name: "splash",
    at: 0,
    outputs: ["splashAlpha", "splashGrow"],
    defaults(ctx) { ctx.splashAlpha = 0; ctx.splashGrow = 0; },
    tracks: {
      splashAlpha: track.tween(0, 1, { dur: SPLASH_FADE_IN, ease: "smooth" }),
      splashGrow: track.tween(0, 1, { dur: timing.splashGrowDur, ease: "smooth" }),
    },
  };
}
