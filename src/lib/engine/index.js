// Standalone WebGL playground engine — no three.js, no animejs. Just basic math,
// geometry builders, a perspective-camera matrix helper, a tween lib, and a thin
// GL toolkit. The engine works in WORLD SPACE: scenes supply model matrices and
// write their own shaders + draws. No scene-graph, no materials.
//
// Rendering is backend-agnostic: a scene writes one renderer against the GPU
// device (gpu/), which runs it on WebGPU (preferred) or WebGL2 (fallback).
// gpu/index.js owns selection; gl.js / webgpu.js are the per-API device kits.

export { Vec3, Euler, Color, mat4, DEG2RAD } from "./math.js";
export { Camera } from "./camera.js";
export {
  Geometry, boxGeometry, cylinderGeometry, planeGeometry, mergeGeometries,
} from "./geometry.js";
export { makeContext, DataTexture } from "./gl.js";
export { makeWebGPUContext } from "./webgpu.js";
// Backend-agnostic GPU device: shader / buffer / texture / camera over WebGPU
// (preferred) or WebGL2 (fallback). Scenes render once against this surface.
export { createDevice } from "./gpu/index.js";
export { animate, stagger, utils, eases } from "./anim.js";
export { loadDragonMesh } from "./mesh.js";
