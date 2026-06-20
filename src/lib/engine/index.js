// Engine works in WORLD SPACE: scenes supply model matrices, write own shaders
// + draws. No scene-graph, no materials.
//
// Rendering goes through ONE backend-agnostic GPU device (gpu/): scene writes
// single renderer against it, runs on WebGPU (preferred) or WebGL2 (fallback).
// gpu/index.js owns backend selection; gpu/webgl.js + gpu/webgpu.js are
// per-API device impls.

export { Vec3, Euler, Color, mat4, DEG2RAD } from "./math.js";
export { Camera } from "./camera.js";
export {
  Geometry, boxGeometry, cylinderGeometry, planeGeometry, mergeGeometries,
} from "./geometry.js";
// authors supply both shader languages (WGSL for WebGPU, GLSL for WebGL2);
// device picks one
export { createDevice } from "./gpu/index.js";
export { animate, stagger, utils, eases } from "./anim.js";
export { loadDragonMesh } from "./mesh.js";
