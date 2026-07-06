// uniforms is an ordered {name,type} list: WGSL uniform struct MUST declare the
// same fields in the same order. correctViewProj remaps every viewProj for the
// active backend (WebGPU remaps z [-1,1] -> [0,1]).

import { createWebGLDevice } from "./webgl.js";
import { createWebGPUDevice } from "./webgpu.js";
import { trackBackend } from "$lib/ga.js";

// uniform-declaration shorthands for device.shader({ uniforms: [...] })
export const F32 = (name) => ({ name, type: "f32" });
export const I32 = (name) => ({ name, type: "i32" });
export const VEC2 = (name) => ({ name, type: "vec2" });
export const VEC3 = (name) => ({ name, type: "vec3" });
export const VEC4 = (name) => ({ name, type: "vec4" });
export const MAT4 = (name) => ({ name, type: "mat4" });

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
      const device = name === "webgpu" ? await createWebGPUDevice(canvas) : createWebGLDevice(canvas);
      trackBackend(device.backend);
      return device;
    } catch (e) {
      lastErr = e;
      console.warn(`[gpu] ${name} device unavailable, trying next`, e);
    }
  }
  throw new Error("no GPU backend available" + (lastErr ? ": " + lastErr.message : ""));
}
