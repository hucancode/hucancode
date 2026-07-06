// Scene schedule: every absolute boundary time, computed once. Block-driven:
// durations fixed by config (BLOCK_DUR) so whole schedule known up front.
//
//   B1 flyin -> B2 roam1 -> B3 approach(glyph) -> B4 enso -> B5 roam2
//   -> B6 crossfade -> B7 loop3 (persistent)
//
// camera descends through B1-B3 (look-at glides down CORRIDOR_DROP), holds during
// B4 so enso stays centred while traced, then from B5 stops descending and pitch
// tilts in.

import { BLOCK_DUR, CROSSFADE, CAM_PITCH_DUR, D3_FADEIN_FRAC, CORRIDOR_TAIL } from "./config.js";

export function computeTiming() {
  const flyinStart = 0;
  const roam1Start = flyinStart + BLOCK_DUR.flyin;        // 2
  const approachStart = roam1Start + BLOCK_DUR.roam1;     // 7  (glyph starts)
  const ensoStart = approachStart + BLOCK_DUR.approach;   // 12
  const ensoExit = ensoStart + BLOCK_DUR.enso;            // 14 (== roam2 start)
  const crossfadeStart = ensoExit + BLOCK_DUR.roam2;      // 16
  const loop3Start = crossfadeStart + BLOCK_DUR.crossfade; // 18

  // camera: descend through B1-B3, hold during B4, pitch from B5 (ensoExit)
  const descentEnd = ensoStart;     // 12 — look-at reaches enso station, then holds
  const pitchAnchor = ensoExit;     // 14 — descent stopped; tilt begins

  // 2D -> 3D crossfade spans B6 [crossfadeStart, loop3Start]
  const d3Start = crossfadeStart;                          // 16
  const d3Mid = d3Start + CROSSFADE * D3_FADEIN_FRAC;      // 3D faded in
  const d3End = loop3Start;                                // 18 — handoff complete: 2D gone, 3D solo

  return {
    flyinStart, roam1Start, approachStart, ensoStart, ensoExit,
    crossfadeStart, loop3Start, descentEnd, pitchAnchor,
    d3Start, d3Mid, d3End,
    camPitchDur: CAM_PITCH_DUR,
    splashGrowDur: ensoStart,      // ink wash keeps spreading across descent, then holds
    timelineEnd: loop3Start + CORRIDOR_TAIL,
  };
}
