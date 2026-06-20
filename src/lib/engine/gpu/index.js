// Backend-agnostic GPU device. Scene writes ONE renderer; runs on WebGPU
// (preferred) or WebGL2 (fallback).
//
// shader desc supplies BOTH shader languages (WGSL for WebGPU, GLSL for WebGL);
// layer picks one. uniforms is ordered {name,type} list: WebGL sets by name,
// WebGPU packs into uniform buffer whose WGSL struct declares same fields in order.
// correctViewProj remaps GL-convention view*proj for active backend (WebGPU remaps
// z [-1,1] -> [0,1]); use for every viewProj.
// Vertex attributes carry GLSL name + WGSL location; textures carry GLSL name +
// WGSL binding. Same value-map drives both backends.

import { createWebGLDevice } from "./webgl.js";
import { createWebGPUDevice } from "./webgpu.js";

export { Camera } from "../camera.js";

const ORDER = (prefer) => [...new Set([prefer, "webgpu", "webgl"])];

function available(name) {
  if (name === "webgpu") return typeof navigator !== "undefined" && !!navigator.gpu;
  if (name === "webgl") return typeof document !== "undefined";
  return false;
}

// Walk preference order, skip unavailable backends, return first device that
// constructs cleanly. WebGPU failure falls through to WebGL2.
export async function createDevice(canvas, { prefer = "webgpu" } = {}) {
  let lastErr = null;
  for (const name of ORDER(prefer)) {
    if (!available(name)) continue;
    try {
      return name === "webgpu" ? await createWebGPUDevice(canvas) : createWebGLDevice(canvas);
    } catch (e) {
      lastErr = e;
      console.warn(`[gpu] ${name} device unavailable, trying next`, e);
    }
  }
  throw new Error("no GPU backend available" + (lastErr ? ": " + lastErr.message : ""));
}
