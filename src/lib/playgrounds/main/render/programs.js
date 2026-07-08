// `uniforms` order is load-bearing: WebGPU packs into a buffer whose WGSL struct must declare the same fields in the same order.

import { F32, I32, VEC2, VEC3, VEC4, MAT4 } from "$lib/engine/index.js";
import { INSTANCED_PROGRAM } from "$lib/mech/instancing.js";
import GLYPH from "./shaders/glyph.wgsl?shader";
import ENSO from "./shaders/enso.wgsl?shader";
import STROKE from "./shaders/stroke.wgsl?shader";
import HEAD from "./shaders/head.wgsl?shader";
import GRID from "./shaders/grid.wgsl?shader";
import LINE from "./shaders/line.wgsl?shader";

const BUF_STROKE_POS = { stride: 8, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x2", offset: 0 }] };
const BUF_STROKE_UV = { stride: 8, step: "vertex", attributes: [{ name: "aLineUV", location: 1, format: "float32x2", offset: 0 }] };
const BUF_HEAD = { stride: 16, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x2", offset: 0 }, { name: "aUV", location: 1, format: "float32x2", offset: 8 }] };
const BUF_LINE = { stride: 12, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x3", offset: 0 }] };

export const PROGRAMS = {
  glyph: {
    ...GLYPH,
    uniforms: [MAT4("uViewProj"), F32("uOpacity"), F32("uAspect"), F32("uZ"), F32("uStationY"), F32("uExt"), VEC2("uResolution"), F32("uBaseRadius"), F32("uTime"), I32("uNSeg"), VEC3("uInkColor")],
    textures: [{ name: "uSegTex", binding: 1 }],
    blend: "straight", depth: "none", topology: "tri-strip",
  },
  enso: {
    ...ENSO,
    uniforms: [MAT4("uViewProj"), F32("uOpacity"), F32("uAspect"), F32("uZ"), F32("uStationY"), F32("uExt"), VEC2("uResolution"), F32("uRadius"), F32("uSweep"), F32("uAngleStart"), F32("uLineWidth"), VEC3("uInkColor")],
    blend: "straight", depth: "none", topology: "tri-strip",
  },
  stroke: {
    ...STROKE,
    buffers: [BUF_STROKE_POS, BUF_STROKE_UV],
    uniforms: [MAT4("uViewProj"), F32("uOpacity"), VEC4("uBrushColor")],
    blend: "straight", depth: "none", topology: "tri",
  },
  head: {
    ...HEAD,
    buffers: [BUF_HEAD],
    uniforms: [MAT4("uViewProj"), F32("uOpacity"), VEC4("uBrushColor")],
    blend: "straight", depth: "none", topology: "tri-strip",
  },
  grid: {
    ...GRID,
    uniforms: [MAT4("uViewProj"), F32("uExt"), F32("uZ"), F32("uStep"), F32("uMinorDiv"), F32("uOpacity"), F32("uReveal"), F32("uRevealMinor"), VEC3("uInkColor")],
    blend: "premult", depth: "none", topology: "tri-strip",
  },
  mechDragon: {
    ...INSTANCED_PROGRAM,
    blend: "straight", depth: "test", topology: "tri",
  },
  line: {
    ...LINE,
    buffers: [BUF_LINE],
    uniforms: [MAT4("uVP"), F32("uAspect"), I32("u3D"), VEC4("uColor")],
    blend: "straight", depth: "none", topology: "line-strip",
  },
  point: {
    ...LINE,
    buffers: [BUF_LINE],
    uniforms: [MAT4("uVP"), F32("uAspect"), I32("u3D"), VEC4("uColor")],
    blend: "straight", depth: "none", topology: "point",
  },
};
