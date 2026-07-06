import { ramp } from "$lib/math/scalar.js";
import { BODY_LEN, HEAD_SIZE } from "../config.js";

export function createInkBlock({ timing, bodyCtrl, grow }) {
  const refit = (ctx) => bodyCtrl.reseed(ctx.t, BODY_LEN * grow.len(ctx.t));
  return {
    name: "inkDragon",
    at: 0,
    duration: timing.loop3Start,
    outputs: ["inkAlpha", "headAlpha", "inkWidthScale", "headSize"],
    defaults(ctx) { ctx.inkAlpha = 0; ctx.headAlpha = 1; ctx.inkWidthScale = 1; ctx.headSize = HEAD_SIZE; },
    setup: refit,
    seek: refit,
    update(ctx) {
      const t = ctx.t;
      const inkReveal = ramp(t, timing.flyinStart, timing.flyinStart + 0.4, 0, 1);
      const inkFade = ramp(t, timing.crossfadeStart, timing.loop3Start, 1, 0);
      ctx.inkAlpha = Math.min(inkReveal, inkFade);
      ctx.headAlpha = ramp(t, timing.flyinStart, timing.flyinStart + 0.5, 0, 1);
      const sizeFrac = grow.size(t);
      ctx.inkWidthScale = sizeFrac;
      ctx.headSize = HEAD_SIZE * sizeFrac;
      // body rigidly refits to the motion line every frame (no physics)
      bodyCtrl.reseed(t, BODY_LEN * grow.len(t));
    },
  };
}
