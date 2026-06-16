// Renderer backend contract for the /paint scene.
//
// The scene (scenes/paint.js) is backend-agnostic: every frame it produces a
// plain-data FrameState describing what each layer looks like at scene time t.
// A backend turns that description into pixels. Today there is a WebGL2
// backend (render/webgl); a WebGPU backend can be added later (render/webgpu)
// without touching the scene, because both implement this same interface.
//
// The interface is intentionally *layer-oriented* (glyph quad, ink-dragon
// quad, 3D dragon) rather than a generic GPU API - that keeps both backends
// small and the seam obvious.
//
// Renderer = {
//   init(canvas): Promise<void>   create context, offscreen targets, programs
//   resize(w, h): void            resize swapchain + offscreen targets
//   frame(state: FrameState): void upload per-frame data + draw all passes
//   destroy(): void               release GPU resources
// }
//
// FrameState shape (all plain data, no GPU handles):
//
// {
//   aspect: number,                       // canvas width / height
//   opacity: { glyph, inkDragon, dragon3d },
//   glyph: {
//     segs: Seg[],                        // from brush/bake.js bakeSegs()
//     playhead: number,                   // reveal time in seconds
//     baseRadius: number,
//   },
//   inkDragon: {
//     body: {x,y}[],                      // verlet chain, tail -> tip
//     whiskerL: {x,y}[],                  // anchor -> free tip
//     whiskerR: {x,y}[],
//     head: { pos:{x,y}, dir:{x,y}, size }, // head quad frame
//   },
//   dragon3d: {
//     frames: Float32Array,               // N * 16, column-major mat4 path frames
//     frameCount: number,                 // N
//     pathLen: number,                    // total arc length of the path
//     bodyLen: number,                    // mesh length in path units
//     time: number,                       // animation clock (flies forever)
//     viewProj: Float32Array,             // 16, column-major
//   },
// }

export const LAYERS = ["glyph", "inkDragon", "dragon3d"];
