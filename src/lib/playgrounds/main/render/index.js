import { createDevice } from "$lib/engine/index.js";
import { makeSceneRenderer } from "./scene.js";

export async function createRenderer(canvas, opts = {}) {
  const device = await createDevice(canvas, { prefer: opts.prefer || "webgpu" });
  const r = makeSceneRenderer(device, canvas);
  await r.init();
  return r;
}
