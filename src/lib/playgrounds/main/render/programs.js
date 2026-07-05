// `uniforms` order is load-bearing: WebGPU packs into a buffer whose WGSL struct must declare the same fields in the same order.

import GLYPH_FRAG from "./webgl/shaders/glyph.frag.glsl?raw";
import SPLASH_FRAG from "./webgl/shaders/splash.frag.glsl?raw";
import ENSO_FRAG from "./webgl/shaders/enso.frag.glsl?raw";
import STROKE_FRAG from "./webgl/shaders/stroke.frag.glsl?raw";
import HEAD_FRAG from "./webgl/shaders/head.frag.glsl?raw";
import FLOWER_FRAG from "./webgl/shaders/flower.frag.glsl?raw";
import GRID_FRAG from "./webgl/shaders/grid.frag.glsl?raw";
import GRID_VERT from "./webgl/shaders/grid.vert.glsl?raw";
import DRAGON3D_FRAG from "./webgl/shaders/dragon3d.frag.glsl?raw";
import DRAGON3D_VERT from "./webgl/shaders/dragon3d.vert.glsl?raw";
import MECH_DRAGON_FRAG from "./webgl/shaders/mech-dragon.frag.glsl?raw";
import MECH_DRAGON_VERT from "./webgl/shaders/mech-dragon.vert.glsl?raw";
import FS_TRI_VERT from "./webgl/shaders/fs-tri.vert.glsl?raw";
import COMPOSITE_VERT from "./webgl/shaders/composite.vert.glsl?raw";
import COMPOSITE_FRAG from "./webgl/shaders/composite.frag.glsl?raw";
import BLIT_FRAG from "./webgl/shaders/blit.frag.glsl?raw";
import STROKE_VERT from "./webgl/shaders/stroke.vert.glsl?raw";
import HEAD_VERT from "./webgl/shaders/head.vert.glsl?raw";
import FLOWER_VERT from "./webgl/shaders/flower.vert.glsl?raw";
import LINE_VERT from "./webgl/shaders/line.vert.glsl?raw";
import LINE_FRAG from "./webgl/shaders/line.frag.glsl?raw";

import GLYPH_WGSL from "./webgpu/shaders/glyph.wgsl?raw";
import SPLASH_WGSL from "./webgpu/shaders/splash.wgsl?raw";
import ENSO_WGSL from "./webgpu/shaders/enso.wgsl?raw";
import STROKE_WGSL from "./webgpu/shaders/stroke.wgsl?raw";
import HEAD_WGSL from "./webgpu/shaders/head.wgsl?raw";
import COMPOSITE_WGSL from "./webgpu/shaders/composite.wgsl?raw";
import GRID_WGSL from "./webgpu/shaders/grid.wgsl?raw";
import FLOWER_WGSL from "./webgpu/shaders/flower.wgsl?raw";
import DRAGON3D_WGSL from "./webgpu/shaders/dragon3d.wgsl?raw";
import MECH_DRAGON_WGSL from "./webgpu/shaders/mech-dragon.wgsl?raw";
import LINE_WGSL from "./webgpu/shaders/line.wgsl?raw";
import BLIT_WGSL from "./webgpu/shaders/blit.wgsl?raw";

const VEC2 = (name) => ({ name, type: "vec2" });
const F32 = (name) => ({ name, type: "f32" });
const I32 = (name) => ({ name, type: "i32" });
const VEC3 = (name) => ({ name, type: "vec3" });
const VEC4 = (name) => ({ name, type: "vec4" });
const MAT4 = (name) => ({ name, type: "mat4" });

const BUF_STROKE_POS = { stride: 8, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x2", offset: 0 }] };
const BUF_STROKE_UV = { stride: 8, step: "vertex", attributes: [{ name: "aLineUV", location: 1, format: "float32x2", offset: 0 }] };
const BUF_HEAD = { stride: 16, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x2", offset: 0 }, { name: "aUV", location: 1, format: "float32x2", offset: 8 }] };
const BUF_DRAGON_POS = { stride: 12, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x3", offset: 0 }] };
const BUF_DRAGON_NRM = { stride: 12, step: "vertex", attributes: [{ name: "aNormal", location: 1, format: "float32x3", offset: 0 }] };
const BUF_FLOWER_INST = { stride: 32, step: "instance", attributes: [{ name: "iData0", location: 1, format: "float32x4", offset: 0 }, { name: "iData1", location: 2, format: "float32x4", offset: 16 }] };
const BUF_LINE = { stride: 12, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x3", offset: 0 }] };
// per-instance: 3 model matrix rows + 3 normal matrix rows + color = 28 floats
const BUF_MECH_INST = { stride: 112, step: "instance", attributes: [
  { name: "iM0", location: 2, format: "float32x4", offset: 0 },
  { name: "iM1", location: 3, format: "float32x4", offset: 16 },
  { name: "iM2", location: 4, format: "float32x4", offset: 32 },
  { name: "iN0", location: 5, format: "float32x4", offset: 48 },
  { name: "iN1", location: 6, format: "float32x4", offset: 64 },
  { name: "iN2", location: 7, format: "float32x4", offset: 80 },
  { name: "iColor", location: 8, format: "float32x4", offset: 96 },
] };

export const PROGRAMS = {
  glyph: {
    glsl: { vertex: FS_TRI_VERT, fragment: GLYPH_FRAG }, wgsl: GLYPH_WGSL,
    uniforms: [VEC2("uResolution"), F32("uBaseRadius"), F32("uTime"), I32("uNSeg"), VEC3("uInkColor")],
    textures: [{ name: "uSegTex", binding: 1 }],
    blend: "accum", topology: "tri", target: "rgba8", sampleCount: 1,
  },
  splash: {
    glsl: { vertex: FS_TRI_VERT, fragment: SPLASH_FRAG }, wgsl: SPLASH_WGSL,
    uniforms: [VEC2("uResolution"), F32("uGrow"), F32("uSpread"), F32("uAmount"), F32("uClock"), VEC3("uInkDark"), VEC3("uInkLight")],
    blend: "accum", topology: "tri", target: "rgba8", sampleCount: 1,
  },
  enso: {
    glsl: { vertex: FS_TRI_VERT, fragment: ENSO_FRAG }, wgsl: ENSO_WGSL,
    uniforms: [VEC2("uResolution"), F32("uRadius"), F32("uSweep"), F32("uAngleStart"), F32("uLineWidth"), VEC3("uInkColor")],
    blend: "accum", topology: "tri", target: "rgba8", sampleCount: 1,
  },
  stroke: {
    glsl: { vertex: STROKE_VERT, fragment: STROKE_FRAG }, wgsl: STROKE_WGSL,
    buffers: [BUF_STROKE_POS, BUF_STROKE_UV],
    uniforms: [F32("uAspect"), F32("uCamY"), F32("uFlipY"), F32("uInkFlow"), F32("uStrands"), F32("uWaterFlow"), F32("uWobble"), F32("uOpacity"), F32("uWidthEnd"), F32("uWidthOffset"), F32("uWidthRange"), F32("uWidthAnchor"), F32("uPerpClearance"), F32("uArcClearance"), I32("uSimple"), VEC4("uBrushColor")],
    blend: "accum", topology: "tri", target: "rgba8", sampleCount: 1,
  },
  head: {
    glsl: { vertex: HEAD_VERT, fragment: HEAD_FRAG }, wgsl: HEAD_WGSL,
    buffers: [BUF_HEAD],
    uniforms: [F32("uAspect"), F32("uCamY"), F32("uFlipY"), F32("uOpacity"), VEC4("uBrushColor")],
    blend: "accum", topology: "tri-strip", target: "rgba8", sampleCount: 1,
  },
  composite: {
    glsl: { vertex: COMPOSITE_VERT, fragment: COMPOSITE_FRAG }, wgsl: COMPOSITE_WGSL,
    uniforms: [MAT4("uViewProj"), F32("uOpacity"), F32("uAspect"), F32("uZ"), F32("uStationY")],
    textures: [{ name: "uTex", binding: 1 }], sampler: 2,
    blend: "premult", depth: "none", topology: "tri-strip", target: "screen", sampleCount: 4,
  },
  grid: {
    glsl: { vertex: GRID_VERT, fragment: GRID_FRAG }, wgsl: GRID_WGSL,
    uniforms: [MAT4("uViewProj"), F32("uExt"), F32("uZ"), F32("uStep"), F32("uMinorDiv"), F32("uOpacity"), F32("uReveal"), F32("uRevealMinor"), VEC3("uInkColor")],
    blend: "premult", depth: "none", topology: "tri-strip", target: "screen", sampleCount: 4,
  },
  flower: {
    glsl: { vertex: FLOWER_VERT, fragment: FLOWER_FRAG }, wgsl: FLOWER_WGSL,
    buffers: [BUF_FLOWER_INST],
    uniforms: [MAT4("uViewProj"), F32("uPetals"), F32("uLayers"), VEC3("uInkColor")],
    blend: "premult", depth: "none", topology: "tri-strip", target: "screen", sampleCount: 4,
  },
  dragon3d: {
    glsl: { vertex: DRAGON3D_VERT, fragment: DRAGON3D_FRAG }, wgsl: DRAGON3D_WGSL,
    buffers: [BUF_DRAGON_POS, BUF_DRAGON_NRM],
    uniforms: [MAT4("uViewProj"), F32("uN"), F32("uPathLen"), F32("uBodyLen"), F32("uHeadOffset"), F32("uGirth"), F32("uOpacity"), F32("uLightBoost"), VEC3("uAlbedo")],
    textures: [{ name: "uFrames", binding: 1 }],
    blend: "straight", depth: "test", topology: "tri", target: "screen", sampleCount: 4,
  },
  mechDragon: {
    glsl: { vertex: MECH_DRAGON_VERT, fragment: MECH_DRAGON_FRAG }, wgsl: MECH_DRAGON_WGSL,
    buffers: [BUF_DRAGON_POS, BUF_DRAGON_NRM, BUF_MECH_INST],
    uniforms: [MAT4("uViewProj"), VEC3("uLightPos"), VEC3("uViewPos"), F32("uOpacity")],
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
  blit: {
    glsl: { vertex: FS_TRI_VERT, fragment: BLIT_FRAG }, wgsl: BLIT_WGSL,
    textures: [{ name: "uTex", binding: 0 }], sampler: 1, uniformBinding: null,
    blend: "none", depth: "none", topology: "tri", target: "screen", sampleCount: 4,
  },
};
