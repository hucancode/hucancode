// The scene schedule: every absolute boundary time, in one object, computed once.
//
// The static boundaries (lead-in -> glyph -> enso) are fixed by config durations.
// The branch (2D->3D handoff) and everything after it depend on the GENERATED
// roam path length, so they are only known after the path is built — which is
// exactly why blocks must be wired AFTER this runs (no placeholder/patch dance).
//
// `curveDur` = roam duration = (curvePath.total - headStart) / SP2.

import {
  LEADIN_DUR, GLYPH_TRACE_DUR, ENSO_LEADIN_DUR, ENSO_DUR,
  CROSSFADE, CAM_PITCH_DUR, D3_FADEIN_FRAC,
} from "./config.js";

export function computeTiming(curveDur) {
  const dragonStart = 0; // the 2D dragon is the first thing on screen
  const glyphStart = dragonStart + LEADIN_DUR;     // lead-in -> glyph trace
  const glyphEnd = glyphStart + GLYPH_TRACE_DUR;   // glyph trace -> enso branch
  const ensoStart = glyphEnd + ENSO_LEADIN_DUR;    // enso branch -> enso sweep
  const ensoEnd = ensoStart + ENSO_DUR;            // enso -> curve roam
  const headRevealT0 = glyphStart + GLYPH_TRACE_DUR * 0.5; // head fades in here

  const branch = ensoEnd + curveDur;   // 2D head reaches the branch point
  // Crossfade-IN completes at branch (when the circles end). The 3D dragon fades
  // in over [d3Start, d3Mid] while the 2D ink is still solid. The fade-OUT tail
  // (glyph + enso + 2D ink easing back) runs PAST branch until the camera pitch
  // has settled (branch + CAM_PITCH_DUR), so the 2D layers don't vanish before
  // the tilt finishes.
  const d3Start = branch - CROSSFADE;
  const d3Mid = d3Start + CROSSFADE * D3_FADEIN_FRAC;
  const d3End = branch + CAM_PITCH_DUR; // pitch settles here -> glyph/enso fades complete
  const inkGone = branch;               // 2D ink itself fades out quickly, by the handoff

  return {
    dragonStart, glyphStart, glyphEnd, ensoStart, ensoEnd, headRevealT0,
    branch, d3Start, d3Mid, d3End, inkGone,
    camPitchDur: CAM_PITCH_DUR,
    splashGrowDur: branch,      // ink keeps spreading across the 2D phase, then holds
    timelineEnd: branch + 11.0, // leave room to watch the 3D dragon loop on alone
  };
}
