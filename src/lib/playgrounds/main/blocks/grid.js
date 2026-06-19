// Grid block: the ground grid wipes in RADIALLY from the origin starting at the
// fly-in (B1), revealing slowly over GRID_REVEAL_DUR (spans past the fly-in into
// the roam). The minor grid trails the major by GRID_MINOR_LAG. Persistent —
// holds revealed afterward.
//
// Declarative `tracks`: each output is a pure function of block-local time.

import { track } from "../stage/index.js";
import { GRID_MAX_OPACITY, GRID_REVEAL_DUR, GRID_MINOR_LAG } from "../config.js";

export function createGridBlock() {
  const dur = GRID_REVEAL_DUR;
  return {
    name: "grid",
    at: 0,
    outputs: ["gridStrength", "gridReveal", "gridRevealMinor"],
    defaults(ctx) { ctx.gridStrength = 0; ctx.gridReveal = 0; ctx.gridRevealMinor = 0; },
    tracks: {
      gridReveal: track.tween(0, 1, { dur }),
      gridRevealMinor: track.tween(0, 1, { dur, lead: -GRID_MINOR_LAG }), // minor trails the major
      gridStrength: (local, ctx) => (ctx.gridReveal > 0 ? GRID_MAX_OPACITY : 0),
    },
  };
}
