// WebGPU backend - STUB. Not implemented yet; the seam exists so the scene
// (scenes/paint.js) and factory (render/index.js) can target WebGPU later
// without changes. Implement the render/renderer.js contract here.
//
// Porting notes:
//  - The 3D dragon path-deform shader already exists in WGSL at
//    flying-dragon/src/material/shader_dragon.wgsl - reuse it directly.
//  - The glyph SDF + ink stroke shaders need WGSL ports of the GLSL under
//    render/webgl/shaders/.
//  - Compose glyph + ink-dragon offscreen textures onto the swapchain with
//    per-layer opacity, then draw the 3D dragon (depth-tested) on top.

export function makeWebGPURenderer(/* canvas */) {
  return {
    async init() {
      throw new Error("WebGPU backend not implemented yet");
    },
    resize() {},
    frame() {},
    destroy() {},
  };
}
