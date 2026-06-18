// Ink splash: a procedural-noise wash that bleeds in at the start and keeps
// spreading across the 2D phase, following the glyph trace (reveal-aware in the
// shader). Persistent: once the spread reaches full it holds under the 3D dragon.

import { smooth, clamp } from "$lib/math/scalar.js";
import { SPLASH_FADE_IN } from "../config.js";

export function createSplashBlock({ timing }) {
  return {
    name: "splash",
    at: 0,
    outputs: ["splashAlpha", "splashGrow"],
    defaults(ctx) { ctx.splashAlpha = 0; ctx.splashGrow = 0; },
    update(ctx) {
      ctx.splashAlpha = smooth(clamp(ctx.t / SPLASH_FADE_IN, 0, 1));
      ctx.splashGrow = smooth(clamp(ctx.t / timing.splashGrowDur, 0, 1));
    },
  };
}
