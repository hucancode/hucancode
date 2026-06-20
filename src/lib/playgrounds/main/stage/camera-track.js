import { clamp, lerp, smooth, ramp } from "$lib/math/scalar.js";
import { CAM_PITCH_ANGLE } from "../config.js";

export function createCameraTrack({ descent, pitch, yaw }) {
  const d = descent || {};
  const p = pitch || {};
  const y = yaw || {};

  // descending look-at world-Y; held at yBottom outside window
  function camY(t) {
    if (!d.enabled) return 0;
    const k = clamp((t - d.startT) / Math.max(1e-6, d.endT - d.startT), 0, 1);
    return lerp(d.yTop, d.yBottom, k);
  }

  // final tilt: 0 until anchorT, smoothstep to CAM_PITCH_ANGLE over `dur`
  function camPitch(t) {
    if (p.anchorT == null) return 0;
    return smooth(clamp((t - p.anchorT) / Math.max(1e-6, p.dur), 0, 1)) * CAM_PITCH_ANGLE;
  }

  // user yaw gate: 0 before gateStart, ramps raw yaw in over [gateStart,gateEnd]
  function yawGate(t, rawYaw) {
    if (y.gateStart == null) return rawYaw || 0;
    if (t < y.gateStart) return 0;
    return ramp(t, y.gateStart, y.gateEnd, 0, rawYaw || 0);
  }

  return { camY, camPitch, yawGate, descent: d, pitch: p, yaw: y };
}
