// FrameState contract for /main (paint) scene renderer. plain data, no GPU
// handles. source of truth = main.js buildState(); keep in sync.
//
// {
//   aspect,
//   opacity: { glyph, inkDragon, dragon3d },
//   grid: {
//     opacity, reveal, revealMinor,       // major/minor reveal 0..1
//     viewProj: Float32Array,             // 16, column-major (shared orbit cam)
//     ext, z, step, minorDiv,             // plane extent / height / cell sizes
//   },
//   glyph: {
//     segs: Seg[],                        // from brush/bake.js bakeSegs()
//     playhead,                           // reveal time, seconds
//     baseRadius,
//   },
//   splash: { alpha, grow, spread, amount, time },
//   enso: { alpha, sweep, radius, lineWidth, angleStart, time },
//   inkDragon: {
//     body: {x,y}[],                      // verlet chain, tail -> tip
//     head: { pos:{x,y}, dir:{x,y}, size, alpha },
//     widthScale,                         // body stroke width mult
//   },
//   dragon3d: {
//     // mech rig (D3_STYLE "mech"): instanced part handles over shared unit meshes
//     items: { key, m: number[9], t: [x,y,z], color, a }[],  // row-major linear + translation + alpha
//     meshes: { [key]: { positions, normals } },
//     eye: [x,y,z],                       // camera world pos (specular)
//     // legacy obj mesh (D3_STYLE "obj"): spine-deformed along path frames
//     frames: Float32Array,               // N * 16, column-major mat4 path frames
//     frameCount,                         // N
//     pathLen,                            // total arc length of path
//     bodyLen,                            // mesh length in path units
//     headOffset,                         // head arc offset into frame buffer
//     girth,                              // cross-section scale
//     time,
//     viewProj: Float32Array,             // 16, column-major
//   },
//   debug: {
//     show, buffer,                       // which FBO to inspect
//     path2d, path3d, pool,               // sampled polylines + waypoints
//   },
// }

export const LAYERS = ["glyph", "inkDragon", "dragon3d"];
