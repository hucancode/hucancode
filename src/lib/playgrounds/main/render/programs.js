// `uniforms` order is load-bearing: WebGPU packs into a buffer whose WGSL struct must declare the same fields in the same order.

import { F32, I32, VEC2, VEC3, VEC4, MAT4 } from "$lib/engine/index.js";
import { INSTANCED_PROGRAM } from "$lib/mech/instancing.js";
import GLYPH_FRAG from "./webgl/shaders/glyph.frag.glsl?raw";
import ENSO_FRAG from "./webgl/shaders/enso.frag.glsl?raw";
import STROKE_FRAG from "./webgl/shaders/stroke.frag.glsl?raw";
import HEAD_FRAG from "./webgl/shaders/head.frag.glsl?raw";
import GRID_FRAG from "./webgl/shaders/grid.frag.glsl?raw";
import GRID_VERT from "./webgl/shaders/grid.vert.glsl?raw";
import QUAD_VERT from "./webgl/shaders/quad.vert.glsl?raw";
import STROKE_VERT from "./webgl/shaders/stroke.vert.glsl?raw";
import HEAD_VERT from "./webgl/shaders/head.vert.glsl?raw";
import LINE_VERT from "./webgl/shaders/line.vert.glsl?raw";
import LINE_FRAG from "./webgl/shaders/line.frag.glsl?raw";

import GLYPH_WGSL from "./webgpu/shaders/glyph.wgsl?raw";
import ENSO_WGSL from "./webgpu/shaders/enso.wgsl?raw";
import STROKE_WGSL from "./webgpu/shaders/stroke.wgsl?raw";
import HEAD_WGSL from "./webgpu/shaders/head.wgsl?raw";
import GRID_WGSL from "./webgpu/shaders/grid.wgsl?raw";
import LINE_WGSL from "./webgpu/shaders/line.wgsl?raw";

const BUF_STROKE_POS = { stride: 8, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x2", offset: 0 }] };
const BUF_STROKE_UV = { stride: 8, step: "vertex", attributes: [{ name: "aLineUV", location: 1, format: "float32x2", offset: 0 }] };
const BUF_HEAD = { stride: 16, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x2", offset: 0 }, { name: "aUV", location: 1, format: "float32x2", offset: 8 }] };
const BUF_LINE = { stride: 12, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x3", offset: 0 }] };

export const PROGRAMS = {
  glyph: {
    glsl: { vertex: QUAD_VERT, fragment: GLYPH_FRAG }, wgsl: GLYPH_WGSL,
    uniforms: [MAT4("uViewProj"), F32("uOpacity"), F32("uAspect"), F32("uZ"), F32("uStationY"), F32("uExt"), VEC2("uResolution"), F32("uBaseRadius"), F32("uTime"), I32("uNSeg"), VEC3("uInkColor")],
    textures: [{ name: "uSegTex", binding: 1 }],
    blend: "straight", depth: "none", topology: "tri-strip", target: "screen", sampleCount: 4,
  },
  enso: {
    glsl: { vertex: QUAD_VERT, fragment: ENSO_FRAG }, wgsl: ENSO_WGSL,
    uniforms: [MAT4("uViewProj"), F32("uOpacity"), F32("uAspect"), F32("uZ"), F32("uStationY"), F32("uExt"), VEC2("uResolution"), F32("uRadius"), F32("uSweep"), F32("uAngleStart"), F32("uLineWidth"), VEC3("uInkColor")],
    blend: "straight", depth: "none", topology: "tri-strip", target: "screen", sampleCount: 4,
  },
  stroke: {
    glsl: { vertex: STROKE_VERT, fragment: STROKE_FRAG }, wgsl: STROKE_WGSL,
    buffers: [BUF_STROKE_POS, BUF_STROKE_UV],
    uniforms: [MAT4("uViewProj"), F32("uOpacity"), VEC4("uBrushColor")],
    blend: "straight", depth: "none", topology: "tri", target: "screen", sampleCount: 4,
  },
  head: {
    glsl: { vertex: HEAD_VERT, fragment: HEAD_FRAG }, wgsl: HEAD_WGSL,
    buffers: [BUF_HEAD],
    uniforms: [MAT4("uViewProj"), F32("uOpacity"), VEC4("uBrushColor")],
    blend: "straight", depth: "none", topology: "tri-strip", target: "screen", sampleCount: 4,
  },
  grid: {
    glsl: { vertex: GRID_VERT, fragment: GRID_FRAG }, wgsl: GRID_WGSL,
    uniforms: [MAT4("uViewProj"), F32("uExt"), F32("uZ"), F32("uStep"), F32("uMinorDiv"), F32("uOpacity"), F32("uReveal"), F32("uRevealMinor"), VEC3("uInkColor")],
    blend: "premult", depth: "none", topology: "tri-strip", target: "screen", sampleCount: 4,
  },
  mechDragon: {
    ...INSTANCED_PROGRAM,
    blend: "straight", depth: "test", topology: "tri", target: "screen", sampleCount: 4,
  },
  line: {
    glsl: { vertex: LINE_VERT, fragment: LINE_FRAG }, wgsl: LINE_WGSL,
    buffers: [BUF_LINE],
    uniforms: [MAT4("uVP"), F32("uAspect"), I32("u3D"), VEC4("uColor")],
    blend: "straight", depth: "none", topology: "line-strip", target: "screen", sampleCount: 4,
  },
  point: {
    glsl: { vertex: LINE_VERT, fragment: LINE_FRAG }, wgsl: LINE_WGSL,
    buffers: [BUF_LINE],
    uniforms: [MAT4("uVP"), F32("uAspect"), I32("u3D"), VEC4("uColor")],
    blend: "straight", depth: "none", topology: "point", target: "screen", sampleCount: 4,
  },
};
