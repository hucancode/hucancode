// Shader bundle for the /paint scene. One entry per draw program, each carrying
// BOTH language variants (GLSL for the WebGL2 backend, WGSL for WebGPU) plus the
// backend-agnostic pipeline descriptor the engine GPU device consumes
// (engine/gpu). The scene renderer (scene.js) builds device.shader() from these.
//
// Vertex attributes carry a GLSL `name` (getAttribLocation) and a WGSL `location`.
// `uniforms` is an ordered {name,type} list: WebGL sets by name, WebGPU packs into
// a uniform buffer whose WGSL struct declares the same fields in the same order.

// fragment GLSL (existing, hand-written calligraphy/ink shaders)
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

// WGSL (one module per program; vs/fs entry points)
import GLYPH_WGSL from "./webgpu/shaders/glyph.wgsl?raw";
import SPLASH_WGSL from "./webgpu/shaders/splash.wgsl?raw";
import ENSO_WGSL from "./webgpu/shaders/enso.wgsl?raw";
import STROKE_WGSL from "./webgpu/shaders/stroke.wgsl?raw";
import HEAD_WGSL from "./webgpu/shaders/head.wgsl?raw";
import COMPOSITE_WGSL from "./webgpu/shaders/composite.wgsl?raw";
import GRID_WGSL from "./webgpu/shaders/grid.wgsl?raw";
import FLOWER_WGSL from "./webgpu/shaders/flower.wgsl?raw";
import DRAGON3D_WGSL from "./webgpu/shaders/dragon3d.wgsl?raw";
import LINE_WGSL from "./webgpu/shaders/line.wgsl?raw";
import BLIT_WGSL from "./webgpu/shaders/blit.wgsl?raw";

// ---- inline GLSL vertex/fragment (were inline strings in the old renderer) ----
const FS_TRI_VERT = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
out vec2 vUV;
void main() { vec2 p = POS[gl_VertexID]; vUV = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const COMPOSITE_VERT = `#version 300 es
precision highp float;
uniform float uAspect;
uniform float uZ;
uniform float uStationY;
uniform mat4 uViewProj;
out vec2 vUV;
const vec2 C[4] = vec2[4](vec2(0.0,0.0), vec2(1.0,0.0), vec2(0.0,1.0), vec2(1.0,1.0));
void main() {
  vec2 c = C[gl_VertexID];
  vUV = c;
  vec3 world = vec3((c.x * 2.0 - 1.0) * uAspect, c.y * 2.0 - 1.0 + uStationY, uZ);
  gl_Position = uViewProj * vec4(world, 1.0);
}`;
const COMPOSITE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uOpacity;
in vec2 vUV;
out vec4 fragColor;
void main() { fragColor = texture(uTex, vUV) * uOpacity; }`;

const BLIT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUV;
out vec4 fragColor;
void main() { fragColor = texture(uTex, vUV); }`;

// uFlipY = +1 on WebGL, -1 on WebGPU: these emit clip space directly (no
// gl_FragCoord), so the offscreen render-to-texture V axis differs between APIs.
const STROKE_VERT = `#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aLineUV;
uniform float uAspect;
uniform float uCamY;
uniform float uFlipY;
out vec2 vUV01;
out vec2 vWorld;
void main() {
  vUV01 = aLineUV;
  vWorld = aPos;
  gl_Position = vec4(aPos.x / uAspect, (aPos.y - uCamY) * uFlipY, 0.0, 1.0);
}`;

const HEAD_VERT = `#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aUV;
uniform float uAspect;
uniform float uCamY;
uniform float uFlipY;
out vec2 vUV;
void main() { vUV = aUV; gl_Position = vec4(aPos.x / uAspect, (aPos.y - uCamY) * uFlipY, 0.0, 1.0); }`;

// instanced: per-instance iData0 = (cx, cy, scale, z), iData1 = (bloom, seed, alpha, _)
const FLOWER_VERT = `#version 300 es
precision highp float;
layout(location = 1) in vec4 iData0;
layout(location = 2) in vec4 iData1;
uniform mat4 uViewProj;
out vec2 vLocal;
out float vBloom;
out float vSeed;
out float vAlpha;
const vec2 C[4] = vec2[4](vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(-1.0,1.0), vec2(1.0,1.0));
void main() {
  vec2 c = C[gl_VertexID];
  vLocal = c;
  vBloom = iData1.x; vSeed = iData1.y; vAlpha = iData1.z;
  vec3 world = vec3(iData0.xy + c * iData0.z, iData0.w);
  gl_Position = uViewProj * vec4(world, 1.0);
}`;

const LINE_VERT = `#version 300 es
precision highp float;
in vec3 aPos;
uniform mat4 uVP;
uniform float uAspect;
uniform int u3D;
void main() {
  gl_PointSize = 10.0;
  if (u3D == 1) gl_Position = uVP * vec4(aPos, 1.0);
  else gl_Position = vec4(aPos.x / uAspect, aPos.y, 0.0, 1.0);
}`;
const LINE_FRAG = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 fragColor;
void main() { fragColor = uColor; }`;

// ---- reusable descriptor fragments ----
const VEC2 = (name) => ({ name, type: "vec2" });
const F32 = (name) => ({ name, type: "f32" });
const I32 = (name) => ({ name, type: "i32" });
const VEC3 = (name) => ({ name, type: "vec3" });
const VEC4 = (name) => ({ name, type: "vec4" });
const MAT4 = (name) => ({ name, type: "mat4" });

// attribute-buffer layouts (stride in bytes; format f32 components)
const BUF_STROKE_POS = { stride: 8, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x2", offset: 0 }] };
const BUF_STROKE_UV = { stride: 8, step: "vertex", attributes: [{ name: "aLineUV", location: 1, format: "float32x2", offset: 0 }] };
const BUF_HEAD = { stride: 16, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x2", offset: 0 }, { name: "aUV", location: 1, format: "float32x2", offset: 8 }] };
const BUF_DRAGON_POS = { stride: 12, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x3", offset: 0 }] };
const BUF_DRAGON_NRM = { stride: 12, step: "vertex", attributes: [{ name: "aNormal", location: 1, format: "float32x3", offset: 0 }] };
const BUF_FLOWER_INST = { stride: 32, step: "instance", attributes: [{ name: "iData0", location: 1, format: "float32x4", offset: 0 }, { name: "iData1", location: 2, format: "float32x4", offset: 16 }] };
const BUF_LINE = { stride: 12, step: "vertex", attributes: [{ name: "aPos", location: 0, format: "float32x3", offset: 0 }] };

// Pass A = offscreen ink layers (rgba8, no MSAA, no depth, premultiplied accum).
// Pass B = screen (4x MSAA, depth attachment for the 3D dragon).
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
  // debug overlays (only used under ?debug); share line.wgsl, differ in topology
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
