import { createWebGLDevice } from "./webgl.js";
import { createWebGPUDevice } from "./webgpu.js";
import { trackBackend } from "$lib/ga.js";

const ORDER = (prefer) => [...new Set([prefer, "webgpu", "webgl"])];

function available(name) {
  if (name === "webgpu")
    return typeof navigator !== "undefined" && !!navigator.gpu;
  return name === "webgl";
}

export async function createDevice(
  canvas,
  { prefer = "webgpu", msaa = true } = {},
) {
  let lastErr = null;
  for (const name of ORDER(prefer)) {
    if (!available(name)) continue;
    try {
      const device =
        name === "webgpu"
          ? await createWebGPUDevice(canvas, { msaa })
          : createWebGLDevice(canvas, { msaa });
      trackBackend(device.backend);
      return device;
    } catch (e) {
      lastErr = e;
      console.warn(`[gpu] ${name} device unavailable, trying next`, e);
    }
  }
  throw new Error(
    "no GPU backend available" + (lastErr ? ": " + lastErr.message : ""),
  );
}
