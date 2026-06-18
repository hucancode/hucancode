// Backend-agnostic render seam. API-neutral: knows nothing about WebGL or
// WebGPU, only about *selecting* a backend and the contract every backend obeys.
//
//   Renderer = {
//     init(canvas): Promise<void>   acquire context, build pipelines/targets
//     resize(w, h): void            resize swapchain + offscreen targets
//     frame(state): void            consume one frame of plain scene data -> pixels
//     destroy(): void               release GPU resources
//   }
//
// A scene never calls the GPU directly: it emits a plain-data per-frame `state`
// and a backend turns it into pixels. The state shape is the scene's own
// contract (see each scene's renderer.js), shared by all of its backends, so the
// same scene runs on WebGL2 today and WebGPU later without changes.
//
// A backend *registry* maps a name to a factory `make(canvas) -> Renderer`
// (sync or async — async lets the WebGPU module be lazily imported so it never
// bundles into the WebGL path):
//
//   const BACKENDS = {
//     webgl:  makeWebGLRenderer,
//     webgpu: async (c) => (await import("./webgpu.js")).makeWebGPURenderer(c),
//   };
//   const r = await createRenderer(canvas, BACKENDS, { prefer: "webgpu" });

// preferred backend first; webgl is the universal fallback and goes last.
function backendOrder(prefer) {
  const order = [prefer, "webgpu", "webgl"];
  return [...new Set(order)];
}

// True when a backend could even run here (capability gate, before we try init).
function isAvailable(name) {
  if (name === "webgpu") return typeof navigator !== "undefined" && !!navigator.gpu;
  if (name === "webgl") return typeof document !== "undefined";
  return true;
}

// Walk the preference order, skipping unavailable backends, returning the first
// that constructs + init()s cleanly. A backend that throws during init (e.g. a
// WebGPU device request fails) falls through to the next one.
export async function createRenderer(canvas, registry, { prefer = "webgl" } = {}) {
  let lastErr = null;
  for (const name of backendOrder(prefer)) {
    const make = registry[name];
    if (!make || !isAvailable(name)) continue;
    try {
      const r = await make(canvas); // await: make may be async (lazy import)
      await r.init(canvas);
      return r;
    } catch (e) {
      lastErr = e;
      console.warn(`[engine] ${name} backend unavailable, trying next`, e);
    }
  }
  throw new Error(
    "no render backend available" + (lastErr ? ": " + lastErr.message : ""),
  );
}
