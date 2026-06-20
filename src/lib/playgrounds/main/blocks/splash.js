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
