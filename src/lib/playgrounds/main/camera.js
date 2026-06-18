// Orbit camera (perspective; column-major mat4). Yaw is user-controllable, pitch
// is scripted by the camera block. Reused scratch -> zero per-frame allocation;
// the returned matrix is fully consumed (uploaded) by the renderer each frame.

import * as mat4 from "$lib/math/mat4.js";
import { CAM } from "./config.js";

const _vpProj = mat4.create();
const _vpRot = mat4.create();
const _vpTmp = mat4.create();
const _vpResult = mat4.create();

export function sceneViewProj(aspect, yaw, pitch) {
  mat4.perspective(_vpProj, CAM.fov, aspect, 0.1, 60);
  // ground is the x/y plane, so +z is up. Yaw spins about z (the ground normal);
  // pitch then tilts elevation. rotZ first so yaw stays a true heading once tilted.
  mat4.rotationZ(_vpRot, yaw);
  mat4.rotationX(_vpTmp, pitch);
  mat4.multiply(_vpRot, _vpTmp, _vpRot);          // rotX(pitch) * rotZ(yaw)
  mat4.translation(_vpTmp, 0, 0, -CAM.dist);
  mat4.multiply(_vpRot, _vpTmp, _vpRot);          // pull camera back along +z
  return mat4.multiply(_vpResult, _vpProj, _vpRot);
}
