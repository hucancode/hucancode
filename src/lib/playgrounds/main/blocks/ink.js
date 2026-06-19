// Ink-dragon block: the 2D dragon reveals (B1), leads through the corridor, then
// fades under the 3D dragon (B6). Owns its alpha / head fade / size ramp and drives
// the body controller (refit on a non-continuous phase boundary or when physics is
// off; otherwise step the verlet chain). Body has history, so this stays imperative.

import { ramp } from "$lib/math/scalar.js";
import { BODY_LEN, HEAD_SIZE, ENABLE_PHYSICS } from "../config.js";

export function createInkBlock({ timing, bodyCtrl, headPath, grow }) {
  let lastInkPhase = -1; // path phase the body was last fitted in (refit on change)
  const refit = (ctx) => {
    bodyCtrl.reseed(ctx.t, BODY_LEN * grow.len(ctx.t));
    lastInkPhase = headPath.phaseOf(ctx.t);
  };
  return {
    name: "inkDragon",
    at: 0,                          // the 2D dragon reveals first (top-middle)
    duration: timing.loop3Start,    // persists through the crossfade, gone by loop3
    outputs: ["inkAlpha", "headAlpha", "inkWidthScale", "headSize"],
    defaults(ctx) { ctx.inkAlpha = 0; ctx.headAlpha = 1; ctx.inkWidthScale = 1; ctx.headSize = HEAD_SIZE; },
    // entering, or seeking in/within: refit the body on-path so a scrub lands on a
    // valid on-curve pose (no physics history, no straight teleport).
    setup: refit,
    seek: refit,
    update(ctx) {
      const t = ctx.t;
      // reveal from opacity 0 over B1; fade out over the crossfade (B6).
      const inkReveal = ramp(t, timing.flyinStart, timing.flyinStart + 0.4, 0, 1);
      const inkFade = ramp(t, timing.crossfadeStart, timing.loop3Start, 1, 0);
      ctx.inkAlpha = Math.min(inkReveal, inkFade);
      ctx.headAlpha = ramp(t, timing.flyinStart, timing.flyinStart + 0.5, 0, 1);
      const sizeFrac = grow.size(t);
      ctx.inkWidthScale = sizeFrac;
      ctx.headSize = HEAD_SIZE * sizeFrac;
      const growLen = BODY_LEN * grow.len(t);
      // Refit when crossing into a non-continuous phase (those don't share an arc
      // param, so stepping would snap the body straight); otherwise step the chain.
      const ph = headPath.phaseOf(t);
      if (!ENABLE_PHYSICS || bodyCtrl.body.length < 2 || (ph !== lastInkPhase && !headPath.PHASES[ph].continuous)) {
        bodyCtrl.reseed(t, growLen);
      } else {
        bodyCtrl.step(headPath.tipAt(t), growLen);
      }
      lastInkPhase = ph;
    },
  };
}
