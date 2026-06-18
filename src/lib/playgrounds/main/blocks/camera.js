// Camera block: tilts the pitch from top-down (0) to a 45deg elevation over the
// crossfade as the 2D dragon hands off to the 3D dragon. Persistent — holds the
// full tilt afterward. Yaw stays user-controllable (handled in buildState).

import { clamp, smooth } from "$lib/math/scalar.js";
import { CAM_PITCH_ANGLE } from "../config.js";

export function createCameraBlock({ timing }) {
  return {
    name: "camera",
    after: { block: "inkDragon", branch: "handoff" },
    outputs: ["camPitch"],
    defaults(ctx) { ctx.camPitch = 0; },
    update(ctx, local) {
      ctx.camPitch = smooth(clamp(local / timing.camPitchDur, 0, 1)) * CAM_PITCH_ANGLE;
    },
  };
}
