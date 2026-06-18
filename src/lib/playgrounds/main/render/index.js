// Backend registry for the /main (paint) scene. The selection + fallback logic
// lives in the engine (engine/backend.js); here we only declare which backends
// implement this scene's FrameState contract (render/renderer.js). The WebGPU
// module is lazily imported so it never bundles into the WebGL2 path.

import { createRenderer as selectRenderer } from "$lib/engine/index.js";
import { makeWebGLRenderer } from "./webgl/webgl-renderer.js";

const BACKENDS = {
  webgl: makeWebGLRenderer,
  webgpu: async (canvas) =>
    (await import("./webgpu/webgpu-renderer.js")).makeWebGPURenderer(canvas),
};

// WebGL2 by default; pass { prefer: "webgpu" } to try WebGPU first (falls back
// to WebGL2 when unavailable or not yet implemented).
export function createRenderer(canvas, opts = {}) {
  return selectRenderer(canvas, BACKENDS, opts);
}
