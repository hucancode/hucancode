// FrameState contract for the /main (paint) scene's render backends.
//
// The generic backend seam (the Renderer interface below + backend selection)
// lives in the engine: engine/backend.js. This file pins down THIS scene's
// data contract — the FrameState shape its backends consume.
//
// The scene (main.js) is backend-agnostic: every frame it produces a plain-data
// FrameState describing what each layer looks like at scene time t. A backend
// turns that description into pixels. Today there is a WebGL2 backend
// (render/webgl); a WebGPU backend can be added later (render/webgpu) without
// touching the scene, because both implement this same interface.
//
// The interface is intentionally *layer-oriented* (glyph quad, ink-dragon
// quad, 3D dragon) rather than a generic GPU API - that keeps both backends
// small and the seam obvious.
//
// Renderer = {                       // contract owner: engine/backend.js
//   init(canvas): Promise<void>   create context, offscreen targets, programs
//   resize(w, h): void            resize swapchain + offscreen targets
//   frame(state: FrameState): void upload per-frame data + draw all passes
//   destroy(): void               release GPU resources
// }
//
// FrameState shape (all plain data, no GPU handles). Source of truth is
// main.js buildState(); keep this in sync with it.
//
// {
//   aspect: number,                       // canvas width / height
//   opacity: { glyph, inkDragon, dragon3d }, // per-layer composite opacity
//   grid: {                               // ground grid (radial wipe-in)
//     opacity, reveal, revealMinor,       // strength + major/minor reveal 0..1
//     viewProj: Float32Array,             // 16, column-major (shared orbit cam)
//     ext, z, step, minorDiv,             // plane extent / height / cell sizes
//   },
//   glyph: {
//     segs: Seg[],                        // from brush/bake.js bakeSegs()
//     playhead: number,                   // reveal time in seconds
//     baseRadius: number,
//   },
//   splash: { alpha, grow, spread, amount, time }, // procedural ink-wash blob
//   enso: { alpha, sweep, radius, lineWidth, angleStart, time }, // swept ring
//   flowers: {                            // bloom flowers seated in path circles
//     items: { x, y, r, bloom, seed }[],  // world centre, radius, 0..1 bloom, hash
//     count, alpha,                        // live count + global layer opacity
//     viewProj: Float32Array,             // 16, shared orbit cam
//   },
//   inkDragon: {
//     body: {x,y}[],                      // verlet chain, tail -> tip
//     head: { pos:{x,y}, dir:{x,y}, size, alpha }, // head quad frame
//     widthScale: number,                 // body stroke width multiplier
//   },
//   dragon3d: {
//     frames: Float32Array,               // N * 16, column-major mat4 path frames
//     frameCount: number,                 // N
//     pathLen: number,                    // total arc length of the path
//     bodyLen: number,                    // mesh length in path units
//     headOffset: number,                 // head arc offset into the frame buffer
//     girth: number,                      // cross-section scale
//     time: number,                       // animation clock (flies forever)
//     viewProj: Float32Array,             // 16, column-major
//   },
//   debug: {                              // only populated when debug flags set
//     show: boolean, buffer: string,      // overlay on / which FBO to inspect
//     path2d, path3d, pool,               // sampled polylines + waypoints
//   },
// }

export const LAYERS = ["glyph", "inkDragon", "dragon3d"];
