// Backend-agnostic GPU device — the engine's render abstraction. A scene writes
// ONE renderer against this surface and it runs on WebGPU (preferred) or WebGL2
// (fallback), instead of hand-rolling a renderer per backend.
//
// The surface is deliberately thin + low-level (this is a creative-coding engine;
// users write their own shaders). It exposes exactly four primitives plus a
// camera helper:
//
//   device.shader(desc)   a pipeline: { wgsl, glsl:{vertex,fragment}, buffers,
//                         uniforms, textures, blend, depth, topology, target,
//                         sampleCount }. Author supplies BOTH shader languages
//                         (WGSL for WebGPU, GLSL for WebGL); the layer picks one.
//                         `uniforms` is an ordered {name,type} list: WebGL sets
//                         them by name, WebGPU packs them into a uniform buffer
//                         whose WGSL struct declares the same fields in order.
//   device.buffer(desc)   { kind:'vertex'|'index'|'uniform', data|size, dynamic }
//   device.texture(desc)  { width, height, format:'rgba8'|'rgba32f', filter, data }
//   device.target(desc)   an offscreen color target you can sample next pass
//
//   device.pass({ target|'screen', clear, depth, depthClear }, (pass) => {
//     pass.draw(shader, { buffers, index, count, instances, uniforms, textures });
//   });
//
//   device.beginFrame() / endFrame()   bracket a frame (WebGPU records one command
//                         buffer + resets uniform rings; WebGL no-op).
//   device.correctViewProj(mat4)        camera seam: returns a clip-correct copy of
//                         a GL-convention view*proj for the active backend (WebGPU
//                         remaps z from [-1,1] to [0,1]); use for every viewProj.
//   device.resize(w,h) / destroy()
//
// Vertex attributes carry both a GLSL `name` and a WGSL `location`; textures carry
// a GLSL `name` and a WGSL `binding`. Same value-map drives both backends.

import { createWebGLDevice } from "./webgl.js";
import { createWebGPUDevice } from "./webgpu.js";

export { Camera } from "../camera.js";

const ORDER = (prefer) => [...new Set([prefer, "webgpu", "webgl"])];

function available(name) {
  if (name === "webgpu") return typeof navigator !== "undefined" && !!navigator.gpu;
  if (name === "webgl") return typeof document !== "undefined";
  return false;
}

// Walk the preference order, skipping unavailable backends, returning the first
// device that constructs cleanly. A WebGPU failure (no adapter, etc.) falls
// through to WebGL2.
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
