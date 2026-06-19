// First-class CAMERA TRACK for the staging framework. The camera is global state
// (read by the view-proj, the grid, every composite layer, and the path
// planners), so making it a block output would force awkward ordering. Instead it
// is its own track, constructed from the resolved schedule and read directly by
// buildState.
//
// Corridor model: the look-at descends in world-Y through the descent window,
// then HOLDS and the pitch tilts in. camY and camPitch live together here so the
// descend->pitch handoff cannot drift: camY holds (C0) and camPitch starts with a
// zero-slope smoothstep at the same instant, so there is no kink.

import { clamp, lerp, smooth, ramp } from "$lib/math/scalar.js";
import { CAM_PITCH_ANGLE } from "../config.js";

// descent: { enabled, yTop, yBottom, startT, endT } describes the world-Y glide of
// the look-at point. pitch: { anchorT, dur } describes when/over-how-long the
// final tilt happens. yaw: { gateStart, gateEnd } gates user yaw in (locked 0
// during the 2D phase, lerps in as the 3D dragon takes over).
export function createCameraTrack({ descent, pitch, yaw }) {
  const d = descent || {};
  const p = pitch || {};
  const y = yaw || {};

  // descending look-at world-Y; held at yBottom outside the window. With descent
  // disabled the camera stays at 0 (reproduces the old stationary scene).
  function camY(t) {
    if (!d.enabled) return 0;
    const k = clamp((t - d.startT) / Math.max(1e-6, d.endT - d.startT), 0, 1);
    return lerp(d.yTop, d.yBottom, k);
  }

  // final tilt: 0 until anchorT, smoothstep to CAM_PITCH_ANGLE over `dur`.
  function camPitch(t) {
    if (p.anchorT == null) return 0;
    return smooth(clamp((t - p.anchorT) / Math.max(1e-6, p.dur), 0, 1)) * CAM_PITCH_ANGLE;
  }

  // user yaw gate: 0 before gateStart, ramps the raw yaw in over [gateStart,gateEnd].
  function yawGate(t, rawYaw) {
    if (y.gateStart == null) return rawYaw || 0;
    if (t < y.gateStart) return 0;
    return ramp(t, y.gateStart, y.gateEnd, 0, rawYaw || 0);
  }

  return { camY, camPitch, yawGate, descent: d, pitch: p, yaw: y };
}
