// WebGPU backend for /main (paint) — SCAFFOLD. Implements the render/renderer.js
// contract so createRenderer({ prefer: "webgpu" }) can target it; the device is
// acquired via the engine WebGPU kit (engine/webgpu.js), but the render pipeline
// is not built yet, so init() throws and the factory falls back to WebGL2.
//
// Porting notes:
//  - Device/swapchain: makeWebGPUContext(canvas) already done below.
//  - The 3D dragon path-deform shader exists in WGSL at
//    flying-dragon/src/material/shader_dragon.wgsl — reuse it directly.
//  - Port the glyph SDF + ink stroke + splash/enso/grid GLSL under
//    render/webgl/shaders/ to WGSL.
//  - Compose glyph + ink-dragon offscreen textures onto the swapchain with
//    per-layer opacity, then draw the depth-tested 3D dragon on top — same pass
//    structure as webgl-renderer.js, mapped to render passes.
//  - Backend-shared, GL-agnostic constants (palette, asset paths, FrameState
//    shape) come from the scene/webgl side; lift them to a shared module when
//    this is implemented so both backends consume one source of truth.

import { makeWebGPUContext } from "$lib/engine/index.js";

export function makeWebGPURenderer(canvas) {
  let gpu = null;
  return {
    async init() {
      gpu = await makeWebGPUContext(canvas); // { device, context, format, ... }
      throw new Error("WebGPU backend: render pipeline not implemented yet");
    },
    resize(w, h) {
      gpu?.resize(w, h);
    },
    frame(/* state */) {},
    destroy() {
      gpu?.device?.destroy?.();
      gpu = null;
    },
  };
}
