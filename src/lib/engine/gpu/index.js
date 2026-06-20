// uniforms is an ordered {name,type} list: WGSL uniform struct MUST declare the
// same fields in the same order. correctViewProj remaps every viewProj for the
// active backend (WebGPU remaps z [-1,1] -> [0,1]).

import { createWebGLDevice } from "./webgl.js";
import { createWebGPUDevice } from "./webgpu.js";

export { Camera } from "../camera.js";

const ORDER = (prefer) => [...new Set([prefer, "webgpu", "webgl"])];

function available(name) {
  if (name === "webgpu") return typeof navigator !== "undefined" && !!navigator.gpu;
  if (name === "webgl") return typeof document !== "undefined";
  return false;
}

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
