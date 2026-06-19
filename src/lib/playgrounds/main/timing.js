// The scene schedule: every absolute boundary time, in one object, computed once.
//
// The corridor scene is BLOCK-DRIVEN: durations are fixed by config (BLOCK_DUR),
// so the whole schedule is known up front (no dependence on a generated path
// length). Blocks are still wired AFTER this so their branch points are real
// numbers.
//
//   B1 flyin -> B2 roam1 -> B3 approach(glyph) -> B4 enso -> B5 roam2
//   -> B6 crossfade -> B7 loop3 (persistent)
//
// The camera descends through B1-B3 (look-at glides down CORRIDOR_DROP), HOLDS
// during B4 so the enso stays centred while it is traced, then from B5 it stops
// descending and the pitch tilts in.

import { BLOCK_DUR, CROSSFADE, CAM_PITCH_DUR, D3_FADEIN_FRAC, CORRIDOR_TAIL } from "./config.js";

export function computeTiming() {
  const flyinStart = 0;
  const roam1Start = flyinStart + BLOCK_DUR.flyin;        // 2
  const approachStart = roam1Start + BLOCK_DUR.roam1;     // 7  (glyph starts)
  const ensoStart = approachStart + BLOCK_DUR.approach;   // 12
  const ensoExit = ensoStart + BLOCK_DUR.enso;            // 14 (== roam2 start)
  const roam2Start = ensoExit;
  const crossfadeStart = roam2Start + BLOCK_DUR.roam2;    // 16
  const loop3Start = crossfadeStart + BLOCK_DUR.crossfade; // 18

  // camera: descend through B1-B3, hold during B4, pitch from B5 (ensoExit).
  const descentEnd = ensoStart;     // 12 — look-at reaches the enso station, then holds
  const pitchAnchor = ensoExit;     // 14 — descent stopped; tilt begins

  // 2D -> 3D crossfade spans B6 [crossfadeStart, loop3Start].
  const d3Start = crossfadeStart;                          // 16
  const d3Mid = d3Start + CROSSFADE * D3_FADEIN_FRAC;      // 3D faded in
  const d3End = loop3Start;                                // 18 — glyph/enso fades settle
  const branch = loop3Start;        // handoff complete: 2D gone, 3D solo
  const inkGone = loop3Start;

  return {
    flyinStart, roam1Start, approachStart, ensoStart, ensoExit, roam2Start,
    crossfadeStart, loop3Start, descentEnd, pitchAnchor,
    d3Start, d3Mid, d3End, branch, inkGone,
    camPitchDur: CAM_PITCH_DUR,
    splashGrowDur: ensoStart,      // ink wash keeps spreading across the descent, then holds
    timelineEnd: loop3Start + CORRIDOR_TAIL,
  };
}
