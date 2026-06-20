// Renderer entry for the /paint scene. Builds the engine GPU device (WebGPU
// preferred, WebGL2 fallback — see engine/gpu) and the single backend-agnostic
// scene renderer over it (scene.js). The returned object satisfies the
// render/renderer.js Renderer contract (resize / frame / destroy).

import { createDevice } from "$lib/engine/index.js";
import { makeSceneRenderer } from "./scene.js";

export async function createRenderer(canvas, opts = {}) {
  const device = await createDevice(canvas, { prefer: opts.prefer || "webgpu" });
  const r = makeSceneRenderer(device, canvas);
  await r.init();
  return r;
}
