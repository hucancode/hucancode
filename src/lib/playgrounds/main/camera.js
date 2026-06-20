// Orbit camera (perspective; column-major mat4). Yaw user-controllable, pitch
// scripted by camera track. camY slides look-at point down world in +/-Y
// (corridor descent); world translated by -camY so descending camera sees
// corridor scroll upward. Reused scratch -> zero per-frame allocation.

import * as mat4 from "$lib/math/mat4.js";
import { CAM } from "./config.js";

const _vpProj = mat4.create();
const _vpRot = mat4.create();
const _vpTmp = mat4.create();
const _vpResult = mat4.create();

export function sceneViewProj(aspect, yaw, pitch, camY = 0) {
  mat4.perspective(_vpProj, CAM.fov, aspect, 0.1, 60);
  // ground = x/y plane, +z up. yaw spins about z (ground normal); pitch tilts
  // elevation. rotZ first so yaw stays true heading once tilted.
  mat4.rotationZ(_vpRot, yaw);
  mat4.rotationX(_vpTmp, pitch);
  mat4.multiply(_vpRot, _vpTmp, _vpRot);          // rotX(pitch) * rotZ(yaw)
  mat4.translation(_vpTmp, 0, 0, -CAM.dist);
  mat4.multiply(_vpRot, _vpTmp, _vpRot);          // pull camera back along +z
  if (camY) {
    mat4.translation(_vpTmp, 0, -camY, 0);        // pan look-at down corridor
    mat4.multiply(_vpRot, _vpRot, _vpTmp);        // world translate (right side)
  }
  return mat4.multiply(_vpResult, _vpProj, _vpRot);
}
