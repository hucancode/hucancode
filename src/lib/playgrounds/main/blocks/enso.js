// Enso block: during B4 the dragon LEADS the stroke as the enso sweeps in (1.5
// revolutions; ensoSweep drives the shader). Held full after the sweep, then eases
// to ENSO_FADE_TARGET as the 3D dragon takes over. Persistent from ensoStart.

import { track } from "../stage/index.js";
import { clamp } from "$lib/math/scalar.js";
import { ENSO_DUR, ENSO_FADE_TARGET } from "../config.js";
import { ensoHeadProgress } from "../frame-path.js";

export function createEnsoBlock({ timing }) {
  const toCrossfade = timing.crossfadeStart - timing.ensoStart;
  const toLoop3 = timing.loop3Start - timing.ensoStart;
  return {
    name: "enso",
    at: timing.ensoStart,
    outputs: ["ensoAlpha", "ensoSweep"],
    defaults(ctx) { ctx.ensoAlpha = 0; ctx.ensoSweep = 0; },
    tracks: {
      // the head IS the leading edge of the stroke, so the sweep == head progress
      // (same decelerating curve) — the stroke is drawn right up to the dragon.
      ensoSweep: (local) => ensoHeadProgress(clamp(local / ENSO_DUR, 0, 1)),
      ensoAlpha: track.keyframes([
        { at: 0, v: 0 },
        { at: 0.3, v: 1 },
        { at: toCrossfade, v: 1 },
        { at: toLoop3, v: ENSO_FADE_TARGET, ease: "smooth" },
      ]),
    },
  };
}
