// Ink-dragon block: the 2D dragon LEADS every phase, then fades under the 3D
// dragon. Owns its alpha / head fade / size ramp and drives the body controller
// (refit on a non-continuous phase boundary or when physics is off; otherwise
// step the verlet chain). Branches: traced / handoff / gone.

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
    at: 0, // the 2D dragon is the first thing on screen (lead-in straight stroke)
    duration: timing.d3End,
    branches: {
      traced: timing.glyphEnd, // head finished tracing the glyph
      handoff: timing.branch,  // branch onto loop3 (3D handoff)
      gone: timing.inkGone,    // 2D ink fully faded
    },
    outputs: ["inkAlpha", "headAlpha", "inkWidthScale", "headSize"],
    defaults(ctx) { ctx.inkAlpha = 0; ctx.headAlpha = 1; ctx.inkWidthScale = 1; ctx.headSize = HEAD_SIZE; },
    // entering, or seeking in/within: refit the body on-path (no physics history,
    // no straight teleport) so a scrub lands on a valid on-curve pose.
    setup: refit,
    seek: refit,
    update(ctx) {
      const t = ctx.t;
      const inkReveal = ramp(t, timing.dragonStart, timing.dragonStart + 0.4, 0, 1);
      const inkFade = ramp(t, timing.d3Mid, timing.inkGone, 1, 0); // holds full until the 3D dragon is in, then fades quickly by the handoff
      ctx.inkAlpha = Math.min(inkReveal, inkFade);
      // head hidden through the lead-in + first half of the glyph trace, then fades in
      ctx.headAlpha = ramp(t, timing.headRevealT0, timing.glyphEnd, 0, 1);
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
