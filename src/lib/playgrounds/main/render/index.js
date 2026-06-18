// Renderer factory. Picks a backend implementing the render/renderer.js
// contract. WebGPU is preferred only when explicitly asked for and available;
// otherwise WebGL2. Today only the WebGL2 backend is implemented.

import { makeWebGLRenderer } from "./webgl/webgl-renderer.js";

export async function createRenderer(canvas, { prefer = "webgl" } = {}) {
  if (prefer === "webgpu" && typeof navigator !== "undefined" && navigator.gpu) {
    try {
      const { makeWebGPURenderer } = await import("./webgpu/webgpu-renderer.js");
      const r = makeWebGPURenderer(canvas);
      await r.init(canvas);
      return r;
    } catch (e) {
      console.warn("[paint] WebGPU backend unavailable, falling back to WebGL2", e);
    }
  }
  const r = makeWebGLRenderer(canvas);
  await r.init(canvas);
  return r;
}
