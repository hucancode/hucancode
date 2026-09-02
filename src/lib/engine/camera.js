import { Vec3 } from "../math/vec3.js";
import * as mat4 from "../math/mat4.js";

// Default projection (WebGL clip convention, z in [-1,1])
const glProject = (out, fov, aspect, near, far) =>
  mat4.perspective(out, fov, aspect, near, far);

export class Camera {
  constructor(fov = Math.PI / 4, aspect = 1, near = 1, far = 2000, project = glProject) {
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.project = project;
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
    this.project(this.projectionMatrix, this.fov, this.aspect, this.near, this.far);
    return this;
  }
  update() {
    mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
    mat4.multiply(this.viewProjMatrix, this.projectionMatrix, this.viewMatrix);
    return this;
  }
}
