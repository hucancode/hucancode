// Perspective camera, matrix helper (projection + view). No scene graph: scene
// positions things in world space, feeds camera matrices to own shaders.

import { Vec3, mat4 } from "./math.js";

export class Camera {
  constructor(fovDeg = 45, aspect = 1, near = 1, far = 2000) {
    this.fov = fovDeg;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.position = new Vec3(0, 0, 10);
    this.up = new Vec3(0, 1, 0);
    this.target = new Vec3(0, 0, 0);
    this.projectionMatrix = mat4.create();
    this.viewMatrix = mat4.create();
    this.viewProjMatrix = mat4.create();
    this.updateProjectionMatrix();
  }
  lookAt(x, y, z) {
    this.target.set(x, y, z);
    return this;
  }
  updateProjectionMatrix() {
    mat4.perspective(this.projectionMatrix, (this.fov * Math.PI) / 180, this.aspect, this.near, this.far);
    return this;
  }
  // rebuild view + cached view*projection. call once per frame after moving
  update() {
    mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
    mat4.multiply(this.viewProjMatrix, this.projectionMatrix, this.viewMatrix);
    return this;
  }
}
