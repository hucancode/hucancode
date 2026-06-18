// Standalone WebGL playground engine — no three.js, no animejs. Just basic math,
// geometry builders, a perspective-camera matrix helper, a tween lib, and a thin
// GL toolkit. The engine works in WORLD SPACE: scenes supply model matrices and
// write their own shaders + draws. No scene-graph, no materials.
//
// Rendering is backend-agnostic at the seam: a scene emits plain-data frame
// state, a backend (WebGL2 today, WebGPU later) turns it into pixels. backend.js
// owns the contract + selection; gl.js / webgpu.js are the per-API device kits.

export { Vec3, Euler, Color, mat4, DEG2RAD } from "./math.js";
export { Camera } from "./camera.js";
export {
  Geometry, boxGeometry, cylinderGeometry, planeGeometry, mergeGeometries,
} from "./geometry.js";
export { makeContext, DataTexture } from "./gl.js";
export { makeWebGPUContext } from "./webgpu.js";
export { createRenderer } from "./backend.js";
export { animate, stagger, utils, eases } from "./anim.js";
export { loadDragonMesh } from "./mesh.js";
