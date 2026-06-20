// Procedural-noise wash bleeds in at start, keeps spreading across 2D phase,
// follows glyph trace (reveal-aware in shader). Persistent: holds full under
// 3D dragon.

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
