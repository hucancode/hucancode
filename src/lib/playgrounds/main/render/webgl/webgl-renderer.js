// WebGL2 backend for /paint. Implements the render/renderer.js contract.
//
// Pass A: render glyph ink + ink-dragon into two offscreen RGBA8 targets,
//         premultiplied (blendFuncSeparate so the alpha channel accumulates
//         coverage correctly).
// Pass B: clear screen to paper, composite both targets as fullscreen quads
//         scaled by per-layer opacity (premultiplied blend), then draw the 3D
//         dragon directly with depth testing on top.

import GLYPH_FRAG from "./shaders/glyph.frag.glsl?raw";
import SPLASH_FRAG from "./shaders/splash.frag.glsl?raw";
import ENSO_FRAG from "./shaders/enso.frag.glsl?raw";
import STROKE_FRAG from "./shaders/stroke.frag.glsl?raw";
import HEAD_FRAG from "./shaders/head.frag.glsl?raw";
import DRAGON3D_VERT from "./shaders/dragon3d.vert.glsl?raw";
import DRAGON3D_FRAG from "./shaders/dragon3d.frag.glsl?raw";
import GRID_VERT from "./shaders/grid.vert.glsl?raw";
import GRID_FRAG from "./shaders/grid.frag.glsl?raw";
import FLOWER_FRAG from "./shaders/flower.frag.glsl?raw";
import { buildRibbon, PERP_CLEARANCE, ARC_CLEARANCE } from "./stroke-gl.js";
import { makeContext, loadDragonMesh } from "$lib/engine/index.js";
import { mark } from "$lib/engine/profile.js";
import { FLOWER_PETALS, FLOWER_LAYERS } from "../../config.js";

const FLOWER_Z = -0.005; // flowers sit just above the grid, under the dragon/glyph

// Kanagawa wave: lotusWhite3 / sumiInk0 for light; sumiInk0 / fujiWhite for dark
const PAPER_LIGHT      = [0.949, 0.925, 0.737, 1.0];
const INK_LIGHT        = [0.086, 0.086, 0.114, 0.95]; // sumiInk0 #16161D
const PAPER_DARK       = [0.086, 0.086, 0.114, 1.0]; // sumiInk0 #16161D
const INK_DARK         = [0.863, 0.843, 0.729, 0.95]; // fujiWhite #DCD7BA
// splash uses a tonal range: mix(INK_xLOW, INK_xHIGH, coverage)
const SPLASH_LOW_LIGHT = [0.32, 0.31, 0.30];  // low-coverage areas, light mode
const SPLASH_HIGH_LIGHT= [0.06, 0.06, 0.07];  // high-coverage areas, light mode
const SPLASH_LOW_DARK  = [0.47, 0.46, 0.40];  // low-coverage areas, dark mode (warm grey)
const SPLASH_HIGH_DARK = [0.863, 0.843, 0.729]; // high-coverage areas, dark mode (fujiWhite)
// 3d dragon albedo: dark ink on light paper / light ink on dark paper
const DRAGON3D_LIGHT   = [0.06, 0.07, 0.10];  // near-black, light mode
const DRAGON3D_DARK    = [0.70, 0.68, 0.59];  // fujiWhite, dimmed for shading
const _darkMQ = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function isDark()         { return !!_darkMQ?.matches; }
function getPaper()       { return isDark() ? PAPER_DARK  : PAPER_LIGHT; }
function getInk()         { return isDark() ? INK_DARK    : INK_LIGHT; }       // 4-elem, for uniform4fv
function getInkRGB()      { const c = getInk(); return [c[0], c[1], c[2]]; }  // 3-elem, for uniform3fv
function getSplashLow()   { return isDark() ? SPLASH_LOW_DARK  : SPLASH_LOW_LIGHT; }
function getSplashHigh()  { return isDark() ? SPLASH_HIGH_DARK : SPLASH_HIGH_LIGHT; }
function getDragon3d()    { return isDark() ? DRAGON3D_DARK    : DRAGON3D_LIGHT; }
const DRAGON_OBJ = "/assets/obj/dragon-low.obj";

// head quad corners [localX, localY, u, v] (HW=2.4*0.5, HH=1.6*0.5); constant
const HEAD_CORNERS = [
  [-1.2, -0.8, 0, 0],
  [1.2, -0.8, 1, 0],
  [-1.2, 0.8, 0, 1],
  [1.2, 0.8, 1, 1],
];

// ---- inline vertex shaders -------------------------------------------------
const FS_TRI_VERT = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
out vec2 vUV;
void main() { vec2 p = POS[gl_VertexID]; vUV = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

// Composite quad lives on the z=0 plane in world space and goes through the
// orbit camera (uViewProj), so the glyph / ink-dragon layers tilt WITH the 3D
// dragon instead of billboarding. uZ separates the two coplanar layers.
const COMPOSITE_VERT = `#version 300 es
precision highp float;
uniform float uAspect;
uniform float uZ;
uniform float uStationY; // world-Y the layer is parked at (corridor station)
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
void main() { fragColor = texture(uTex, vUV) * uOpacity; }`; // premultiplied scale

// blit a full-screen target straight through (dragon target -> screen)
const BLIT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUV;
out vec4 fragColor;
void main() { fragColor = texture(uTex, vUV); }`;

// A single bloom flower: a quad of half-size uScale centred at world uCenter on the
// z=uZ ground plane, through the orbit camera (so flowers tilt with the scene). One
// draw per flower; vLocal (-1..1) is the flower's polar field in the fragment shader.
const FLOWER_VERT = `#version 300 es
precision highp float;
uniform vec2 uCenter;
uniform float uScale;
uniform float uZ;
uniform mat4 uViewProj;
out vec2 vLocal;
const vec2 C[4] = vec2[4](vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(-1.0,1.0), vec2(1.0,1.0));
void main() {
  vec2 c = C[gl_VertexID];
  vLocal = c;
  vec3 world = vec3(uCenter + c * uScale, uZ);
  gl_Position = uViewProj * vec4(world, 1.0);
}`;

// debug path lines and points: 2D (x/aspect,y) or 3D (uVP * pos)
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

// The ink dragon travels the whole corridor, so its body/head are drawn
// CAMERA-RELATIVE: subtract uCamY so a body parked at world-Y == camY lands at the
// FBO centre (and stays inside the [-1,1] FBO bounds). The ink composite quad is
// parked at stationY == camY to cancel the view-proj corridor pan.
const STROKE_VERT = `#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aLineUV;
uniform float uAspect;
uniform float uCamY;
out vec2 vUV01;
out vec2 vWorld;
void main() {
  vUV01 = aLineUV;
  vWorld = aPos;
  gl_Position = vec4(aPos.x / uAspect, aPos.y - uCamY, 0.0, 1.0);
}`;

const HEAD_VERT = `#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aUV;
uniform float uAspect;
uniform float uCamY;
out vec2 vUV;
void main() { vUV = aUV; gl_Position = vec4(aPos.x / uAspect, aPos.y - uCamY, 0.0, 1.0); }`;

// ---- gl helpers ------------------------------------------------------------
// shader compile + program link come from the engine GL toolkit (makeContext).
// link() returns the raw WebGLProgram; uniform locations are still cached and
// driven raw here because the layers use int + raw-texture uniforms the engine
// program.set() abstraction does not cover.
function uniforms(gl, prog, names) {
  const U = {};
  for (const n of names) U[n] = gl.getUniformLocation(prog, n);
  return U;
}

export function makeWebGLRenderer(canvas) {
  let gl;
  let progs = {};
  let U = {};
  let emptyVao;
  // { fb, tex, rb, w, h }
  // dragon draws straight to the screen, so it needs no offscreen target
  let fbo = { glyph: null, splash: null, enso: null, ink: null };
  let segTex, segBuf = new Float32Array(0), segRows = 0, segRef = null;
  // dynamic stroke buffers
  let strokeVao, posBuf, uvBuf, idxBuf;
  let strokeIdxCount = -1; // ribbon topology is fixed -> indices uploaded once
  // head buffers
  let headVao, headBuf;
  const headData = new Float32Array(16); // reused head-quad scratch (no per-frame alloc)
  // dragon3d
  let d3Vao, d3PosBuf, d3NormBuf, d3FramesTex, d3VertexCount = 0, d3FramesRef = null;
  // debug lines
  let lineVao, lineBuf, lineScratch = new Float32Array(0);
  let w = 1, h = 1;
  // steady-state caching: the glyph FBO is static once the trace ends (its shader
  // has no clock), so re-render only when the playhead changes. splash + enso only
  // drift slowly on uClock once saturated -> re-render every STATIC_THROTTLE frames.
  let frameCount = 0;
  let glyphCacheKey = NaN; // last rendered playhead (NaN forces a render)
  const STATIC_THROTTLE = 8;

  function makeTarget(withDepth, div) {
    const tw = Math.max(1, Math.ceil(w / (div || 1)));
    const th = Math.max(1, Math.ceil(h / (div || 1)));
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    let rb = null;
    if (withDepth) {
      rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, tw, th);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, rb, w: tw, h: th };
  }
  function freeTarget(t) {
    if (!t) return;
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fb);
    if (t.rb) gl.deleteRenderbuffer(t.rb);
  }

  async function init() {
    const endInit = mark("webgl init total");
    // engine GL toolkit: WebGL2 context (opaque, MSAA) + shader compile/link.
    // .program() returns a wrapper; we keep its raw .prog and drive uniforms by
    // hand (int + raw-texture uniforms the wrapper's set() does not handle).
    // RGBA32F seg/frames textures are sampled-only (texelFetch), core WebGL2 —
    // EXT_color_buffer_float is not required.
    const ctx = makeContext(canvas, { alpha: false, antialias: true });
    gl = ctx.gl;
    const link = (vs, fs) => ctx.program(vs, fs).prog;

    const endShaders = mark("webgl shader compile+link");
    progs.glyph = link(FS_TRI_VERT, GLYPH_FRAG);
    progs.splash = link(FS_TRI_VERT, SPLASH_FRAG);
    progs.enso = link(FS_TRI_VERT, ENSO_FRAG);
    progs.composite = link(COMPOSITE_VERT, COMPOSITE_FRAG);
    progs.stroke = link(STROKE_VERT, STROKE_FRAG);
    progs.head = link(HEAD_VERT, HEAD_FRAG);
    progs.dragon3d = link(DRAGON3D_VERT, DRAGON3D_FRAG);
    progs.grid = link(GRID_VERT, GRID_FRAG);
    progs.flower = link(FLOWER_VERT, FLOWER_FRAG);
    progs.blit = link(FS_TRI_VERT, BLIT_FRAG);
    progs.line = link(LINE_VERT, LINE_FRAG);
    endShaders();

    U.glyph = uniforms(gl, progs.glyph, ["uResolution", "uBaseRadius", "uTime", "uNSeg", "uSegTex", "uInkColor"]);
    U.splash = uniforms(gl, progs.splash, ["uResolution", "uGrow", "uSpread", "uAmount", "uClock", "uInkDark", "uInkLight"]);
    U.enso = uniforms(gl, progs.enso, ["uResolution", "uRadius", "uSweep", "uAngleStart", "uLineWidth", "uClock", "uInkColor"]);
    U.composite = uniforms(gl, progs.composite, ["uTex", "uOpacity", "uAspect", "uZ", "uStationY", "uViewProj"]);
    U.stroke = uniforms(gl, progs.stroke, [
      "uAspect", "uCamY", "uInkFlow", "uStrands", "uWaterFlow", "uWobble", "uOpacity",
      "uWidthEnd", "uWidthOffset", "uWidthRange", "uWidthAnchor",
      "uPerpClearance", "uArcClearance", "uBrushColor", "uSimple",
    ]);
    U.head = uniforms(gl, progs.head, ["uAspect", "uCamY", "uBrushColor", "uOpacity"]);
    U.dragon3d = uniforms(gl, progs.dragon3d, [
      "uFrames", "uN", "uPathLen", "uBodyLen", "uHeadOffset", "uGirth", "uViewProj", "uOpacity", "uTime", "uLightBoost", "uAlbedo",
    ]);
    U.grid = uniforms(gl, progs.grid, ["uViewProj", "uExt", "uZ", "uStep", "uMinorDiv", "uOpacity", "uReveal", "uRevealMinor", "uInkColor"]);
    U.flower = uniforms(gl, progs.flower, [
      "uCenter", "uScale", "uZ", "uViewProj", "uBloom", "uSeed", "uAlpha", "uPetals", "uLayers", "uInkColor",
    ]);
    U.blit = uniforms(gl, progs.blit, ["uTex"]);
    U.line = uniforms(gl, progs.line, ["uVP", "uAspect", "u3D", "uColor"]);

    emptyVao = gl.createVertexArray();

    // seg texture
    segTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, segTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // stroke dynamic buffers + vao
    strokeVao = gl.createVertexArray();
    gl.bindVertexArray(strokeVao);
    posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    const aPos = gl.getAttribLocation(progs.stroke, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    const aUV = gl.getAttribLocation(progs.stroke, "aLineUV");
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
    idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bindVertexArray(null);

    // head buffers + vao (interleaved aPos.xy, aUV.xy)
    headVao = gl.createVertexArray();
    gl.bindVertexArray(headVao);
    headBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, headBuf);
    const hPos = gl.getAttribLocation(progs.head, "aPos");
    const hUV = gl.getAttribLocation(progs.head, "aUV");
    gl.enableVertexAttribArray(hPos);
    gl.vertexAttribPointer(hPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(hUV);
    gl.vertexAttribPointer(hUV, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);

    // debug line buffer + vao (aPos.xyz)
    lineVao = gl.createVertexArray();
    gl.bindVertexArray(lineVao);
    lineBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    const lPos = gl.getAttribLocation(progs.line, "aPos");
    gl.enableVertexAttribArray(lPos);
    gl.vertexAttribPointer(lPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // dragon3d frames texture
    d3FramesTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, d3FramesTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // load dragon mesh asynchronously -- don't block first paint. The 2D glyph
    // trace renders immediately; the 3D dragon appears once the mesh arrives
    // (its draw is gated on d3VertexCount > 0). Asset is preloaded in <head>,
    // so the fetch usually hits cache.
    loadMesh().catch((e) => console.warn("[paint] dragon mesh load failed", e));

    resize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    endInit();
  }

  // x normalised to [0,1]; uBodyLen scales it at draw time
  async function loadMesh() {
    const endMesh = mark("dragon mesh load+upload");
    const endFetch = mark("loadDragonMesh (fetch+parse)");
    const mesh = await loadDragonMesh(DRAGON_OBJ, 1.0);
    endFetch();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    d3PosBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, d3PosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
    const dPos = gl.getAttribLocation(progs.dragon3d, "aPos");
    gl.enableVertexAttribArray(dPos);
    gl.vertexAttribPointer(dPos, 3, gl.FLOAT, false, 0, 0);
    d3NormBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, d3NormBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
    const dNorm = gl.getAttribLocation(progs.dragon3d, "aNormal");
    gl.enableVertexAttribArray(dNorm);
    gl.vertexAttribPointer(dNorm, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    // publish last: gates the draw, so VAO/buffers are fully ready first
    d3Vao = vao;
    d3VertexCount = mesh.vertexCount;
    endMesh();
  }

  function resize(nw, nh) {
    w = Math.max(1, nw | 0);
    h = Math.max(1, nh | 0);
    freeTarget(fbo.glyph);
    freeTarget(fbo.splash);
    freeTarget(fbo.enso);
    freeTarget(fbo.ink);
    fbo.glyph = makeTarget();      // full-res: crisp calligraphy SDF
    fbo.splash = makeTarget(false, 2); // soft fbm wash -> half-res is invisible
    fbo.enso = makeTarget(false);   // soft brush noise
    fbo.ink = makeTarget();        // full-res: crisp dragon ribbon
    glyphCacheKey = NaN;           // targets recreated -> force a glyph re-render
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function uploadSegs(segs) {
    const n = segs.length;
    if (n === 0) return 0;
    // glyph segs are baked once in initScene and never mutate -> upload only when
    // the array identity changes (scene reload), not every frame.
    if (segs === segRef && n === segRows) return n;
    segRef = segs;
    const need = n * 16;
    if (segBuf.length < need) segBuf = new Float32Array(need);
    for (let i = 0; i < n; i++) {
      const s = segs[i];
      let o = i * 16;
      segBuf[o++] = s.p1.x; segBuf[o++] = s.p1.y; segBuf[o++] = s.p2.x; segBuf[o++] = s.p2.y;
      segBuf[o++] = s.ctrl.x; segBuf[o++] = s.ctrl.y; segBuf[o++] = s.pr1; segBuf[o++] = s.pr2;
      segBuf[o++] = s.k; segBuf[o++] = s.belly; segBuf[o++] = s.hasBelly; segBuf[o++] = s.t0;
      segBuf[o++] = s.dur; segBuf[o++] = s.v0; segBuf[o++] = s.v1; segBuf[o++] = 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, segTex);
    if (n !== segRows) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 4, n, 0, gl.RGBA, gl.FLOAT, segBuf, 0);
      segRows = n;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, n, gl.RGBA, gl.FLOAT, segBuf, 0);
    }
    return n;
  }

  // draw one ribbon stroke into the currently-bound FBO
  function drawStroke(points, lineWidth, aspect, opacity, params, simple, camY = 0) {
    const r = buildRibbon(points, lineWidth);
    if (!r) return;
    gl.bindVertexArray(strokeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, r.positions, gl.STREAM_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, r.uvs, gl.STREAM_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    if (strokeIdxCount !== r.indexCount) {
      // topology constant for a fixed body length -> upload indices once
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, r.indices, gl.STATIC_DRAW);
      strokeIdxCount = r.indexCount;
    }

    gl.uniform1f(U.stroke.uAspect, aspect);
    gl.uniform1f(U.stroke.uCamY, camY);
    gl.uniform1f(U.stroke.uInkFlow, params.inkFlow);
    gl.uniform1f(U.stroke.uStrands, params.strands);
    gl.uniform1f(U.stroke.uWaterFlow, params.waterFlow);
    gl.uniform1f(U.stroke.uWobble, params.wobble);
    gl.uniform1f(U.stroke.uOpacity, opacity);
    gl.uniform1f(U.stroke.uWidthEnd, params.widthEnd);
    gl.uniform1f(U.stroke.uWidthOffset, params.widthOffset);
    gl.uniform1f(U.stroke.uWidthRange, params.widthRange);
    gl.uniform1f(U.stroke.uWidthAnchor, params.widthAnchor ?? 0.5);
    gl.uniform1f(U.stroke.uPerpClearance, PERP_CLEARANCE);
    gl.uniform1f(U.stroke.uArcClearance, ARC_CLEARANCE);
    gl.uniform4fv(U.stroke.uBrushColor, getInk());
    gl.uniform1i(U.stroke.uSimple, simple ? 1 : 0);
    gl.drawElements(gl.TRIANGLES, r.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  const BODY_PARAMS = {
    inkFlow: 1.0, strands: 3.0, waterFlow: 0.8, wobble: 0.3,
    widthEnd: 0.2, widthOffset: 0.5, widthRange: 1.0, widthAnchor: 0.5,
  };
  function drawHead(head, aspect, opacity, camY = 0) {
    const theta = Math.atan2(head.dir.y, head.dir.x);
    const ct = Math.cos(theta), st = Math.sin(theta);
    const s = head.size;
    const data = headData;
    for (let i = 0; i < 4; i++) {
      const c = HEAD_CORNERS[i];
      const lx = c[0] * s, ly = c[1] * s;
      const wx = head.pos.x + (ct * lx - st * ly);
      const wy = head.pos.y + (st * lx + ct * ly);
      data[i * 4 + 0] = wx; data[i * 4 + 1] = wy;
      data[i * 4 + 2] = c[2]; data[i * 4 + 3] = c[3];
    }
    gl.bindVertexArray(headVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, headBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    gl.useProgram(progs.head);
    gl.uniform1f(U.head.uAspect, aspect);
    gl.uniform1f(U.head.uCamY, camY);
    gl.uniform1f(U.head.uOpacity, opacity);
    gl.uniform4fv(U.head.uBrushColor, getInk());
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function bindLineData(dataF32, use3D, vp, aspect, color) {
    gl.bindVertexArray(lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, dataF32, gl.STREAM_DRAW);
    gl.useProgram(progs.line);
    gl.uniform1i(U.line.u3D, use3D ? 1 : 0);
    if (vp) gl.uniformMatrix4fv(U.line.uVP, false, vp);
    gl.uniform1f(U.line.uAspect, aspect);
    gl.uniform4fv(U.line.uColor, color);
  }
  function drawLine(dataF32, use3D, vp, aspect, color) {
    bindLineData(dataF32, use3D, vp, aspect, color);
    gl.drawArrays(gl.LINE_STRIP, 0, dataF32.length / 3);
  }
  function drawPoints(dataF32, use3D, vp, aspect, color) {
    bindLineData(dataF32, use3D, vp, aspect, color);
    gl.drawArrays(gl.POINTS, 0, dataF32.length / 3);
  }

  // ground grid: procedural quad on the x/y ground plane, through the orbit camera
  // (black lines + fog + falloff), wiped in radially from the origin (uReveal).
  function drawGrid(g) {
    gl.useProgram(progs.grid);
    gl.bindVertexArray(emptyVao);
    gl.uniformMatrix4fv(U.grid.uViewProj, false, g.viewProj);
    gl.uniform1f(U.grid.uExt, g.ext);
    gl.uniform1f(U.grid.uZ, g.z);
    gl.uniform1f(U.grid.uStep, g.step);
    gl.uniform1f(U.grid.uMinorDiv, g.minorDiv);
    gl.uniform1f(U.grid.uOpacity, g.opacity);
    gl.uniform1f(U.grid.uReveal, g.reveal);
    gl.uniform1f(U.grid.uRevealMinor, g.revealMinor);
    gl.uniform3fv(U.grid.uInkColor, getInkRGB());
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // bloom flowers: one premultiplied quad per visible flower, on the ground plane
  // through the orbit camera. The premultiplied composite blend is already set by
  // compositePass; buds (bloom ~0) are skipped. Shared knobs are set once, per-flower
  // placement + bloom + seed set in the loop.
  function drawFlowers(state, vp) {
    const f = state.flowers;
    if (!f || !f.items || f.count <= 0 || f.alpha <= 0) return;
    gl.useProgram(progs.flower);
    gl.bindVertexArray(emptyVao);
    gl.uniformMatrix4fv(U.flower.uViewProj, false, vp);
    gl.uniform1f(U.flower.uZ, FLOWER_Z);
    gl.uniform1f(U.flower.uPetals, FLOWER_PETALS);
    gl.uniform1f(U.flower.uLayers, FLOWER_LAYERS);
    gl.uniform3fv(U.flower.uInkColor, getInkRGB());
    const items = f.items;
    for (let i = 0; i < f.count; i++) {
      const fl = items[i];
      if (fl.bloom <= 0.001) continue; // still a closed bud -> nothing to draw
      gl.uniform2f(U.flower.uCenter, fl.x, fl.y);
      gl.uniform1f(U.flower.uScale, fl.r);
      gl.uniform1f(U.flower.uBloom, fl.bloom);
      gl.uniform1f(U.flower.uSeed, fl.seed);
      gl.uniform1f(U.flower.uAlpha, f.alpha * (fl.opacity ?? 1)); // per-flower ink opacity
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  function compositeQuad(tex, opacity, z, viewProj, aspect, stationY = 0) {
    gl.useProgram(progs.composite);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(U.composite.uTex, 0);
    gl.uniform1f(U.composite.uOpacity, opacity);
    gl.uniform1f(U.composite.uAspect, aspect);
    gl.uniform1f(U.composite.uZ, z);
    gl.uniform1f(U.composite.uStationY, stationY);
    gl.uniformMatrix4fv(U.composite.uViewProj, false, viewProj);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ---------- Pass A: offscreen ink layers ----------
  // Each renders into its own RGBA target. The premultiplied accumulation blend
  // (set once in frame()) is shared across all four, so they must run together.

  // glyph ink SDF -> fbo.glyph. Static once the trace ends (shader has no clock),
  // so skip the redraw while the playhead is unchanged; the FBO keeps its content.
  function glyphPass(state, nSeg) {
    if (nSeg <= 0 || state.glyph.playhead === glyphCacheKey) return; // empty or cached
    glyphCacheKey = state.glyph.playhead;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.glyph.fb);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(progs.glyph);
    gl.bindVertexArray(emptyVao);
    gl.uniform2f(U.glyph.uResolution, w, h);
    gl.uniform1f(U.glyph.uBaseRadius, state.glyph.baseRadius);
    gl.uniform1f(U.glyph.uTime, state.glyph.playhead);
    gl.uniform1i(U.glyph.uNSeg, nSeg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, segTex);
    gl.uniform1i(U.glyph.uSegTex, 0);
    gl.uniform3fv(U.glyph.uInkColor, getInkRGB());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // procedural noise blob centred at the origin, grows + splatters over time.
  // Half-res target; once grown it only drifts on uClock -> throttle the redraw.
  function splashPass(state) {
    const animating = !state.splash || state.splash.alpha <= 0 || state.splash.grow < 1;
    if (!animating && frameCount % STATIC_THROTTLE !== 0) return; // keep cached drift
    const t = fbo.splash;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!state.splash || state.splash.alpha <= 0) return;
    gl.useProgram(progs.splash);
    gl.bindVertexArray(emptyVao);
    gl.uniform2f(U.splash.uResolution, t.w, t.h);
    gl.uniform1f(U.splash.uGrow, state.splash.grow);
    gl.uniform1f(U.splash.uSpread, state.splash.spread);
    gl.uniform1f(U.splash.uAmount, state.splash.amount);
    gl.uniform1f(U.splash.uClock, state.splash.time);
    gl.uniform3fv(U.splash.uInkLight, getSplashLow());
    gl.uniform3fv(U.splash.uInkDark, getSplashHigh());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // polar brush stroke swept by the dragon head (uSweep); straight-alpha output.
  // Half-res target; once swept it only drifts on uClock -> throttle the redraw.
  function ensoPass(state) {
    const animating = !state.enso || state.enso.alpha <= 0 || state.enso.sweep < 1;
    if (!animating && frameCount % STATIC_THROTTLE !== 0) return; // keep cached drift
    const t = fbo.enso;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!state.enso || state.enso.alpha <= 0 || state.enso.sweep <= 0) return;
    gl.useProgram(progs.enso);
    gl.bindVertexArray(emptyVao);
    gl.uniform2f(U.enso.uResolution, t.w, t.h);
    gl.uniform1f(U.enso.uRadius, state.enso.radius);
    gl.uniform1f(U.enso.uSweep, state.enso.sweep);
    gl.uniform1f(U.enso.uAngleStart, state.enso.angleStart);
    gl.uniform1f(U.enso.uLineWidth, state.enso.lineWidth);
    gl.uniform1f(U.enso.uClock, state.enso.time);
    gl.uniform3fv(U.enso.uInkColor, getInkRGB());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ink-dragon body ribbon + head quad -> fbo.ink
  function inkPass(state, aspect) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.ink.fb);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (state.opacity.inkDragon <= 0) return;
    const d = state.inkDragon;
    const ws = d.widthScale ?? 1; // body stroke width grows with the dragon
    const camY = state.camY || 0;  // body drawn camera-relative (corridor)
    gl.useProgram(progs.stroke);
    drawStroke(d.body, 0.03 * ws, aspect, 1.0, BODY_PARAMS, false, camY);
    if ((d.head.alpha ?? 1) > 0) drawHead(d.head, aspect, d.head.alpha ?? 1, camY); // head hidden early in the trace
  }

  // ---------- Pass B: composite the ink layers to screen ----------
  // glyph + ink-dragon are textured quads on the z=0 plane, drawn through the
  // SAME orbit camera as the 3D dragon, so they tilt with it (no billboard).
  function compositePass(state, aspect) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    const paper = getPaper();
    gl.clearColor(paper[0], paper[1], paper[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied composite
    const vp = state.dragon3d.viewProj;

    // Each 2D layer is parked at its corridor station world-Y; the camera pan
    // (baked into vp) slides it through frame. The traveling ink dragon is drawn
    // camera-relative (see index.js) so its quad stays camera-locked at camY.
    const camY = state.camY || 0;
    // ground grid (behind the ink layers, over the paper); radial wipe-in
    if (state.grid && state.grid.reveal > 0) drawGrid(state.grid);
    // bloom flowers on the ground (above the grid, under the splash/glyph/dragon)
    drawFlowers(state, vp);
    // ink splash wash sits between the grid and the glyph, bleeding under it
    if (state.splash && state.splash.alpha > 0)
      compositeQuad(fbo.splash.tex, state.splash.alpha, -0.006, vp, aspect, state.splash.stationY || 0);
    // enso circle sits between the splash and the glyph (encircles the symbol)
    if (state.enso && state.enso.alpha > 0)
      compositeQuad(fbo.enso.tex, state.enso.alpha, -0.004, vp, aspect, state.enso.stationY || 0);
    compositeQuad(fbo.glyph.tex, state.opacity.glyph, -0.002, vp, aspect, state.glyph.stationY || 0);
    compositeQuad(fbo.ink.tex, state.opacity.inkDragon, 0.0, vp, aspect, camY);
  }

  // ---------- 3D dragon, drawn straight onto the screen ----------
  // The screen already holds opaque paper + ink (compositePass), and its depth
  // buffer was cleared there, so we depth-test the dragon for self-occlusion and
  // alpha-blend it over. Straight SRC_ALPHA over an opaque background gives the
  // exact pixels the old transparent-target + premultiplied blit did, and the
  // default framebuffer's MSAA antialiases the dragon edges for free.
  function dragonPass(state) {
    if (state.opacity.dragon3d <= 0 || d3VertexCount <= 0) return;
    const d3 = state.dragon3d;
    // re-upload whenever the frame buffer changes (scene swaps the transition
    // buffer for the pure-loop3 ring once the body leaves the circles).
    if (d3.frames && d3.frames !== d3FramesRef) {
      gl.bindTexture(gl.TEXTURE_2D, d3FramesTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 4, d3.frameCount, 0, gl.RGBA, gl.FLOAT, d3.frames, 0);
      d3FramesRef = d3.frames;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(progs.dragon3d);
    gl.bindVertexArray(d3Vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, d3FramesTex);
    gl.uniform1i(U.dragon3d.uFrames, 0);
    gl.uniform1f(U.dragon3d.uN, d3.frameCount);
    gl.uniform1f(U.dragon3d.uPathLen, d3.pathLen);
    gl.uniform1f(U.dragon3d.uBodyLen, d3.bodyLen);
    gl.uniform1f(U.dragon3d.uHeadOffset, d3.headOffset);
    gl.uniform1f(U.dragon3d.uGirth, d3.girth);
    gl.uniform1f(U.dragon3d.uOpacity, state.opacity.dragon3d);
    gl.uniform1f(U.dragon3d.uLightBoost, 1.0);
    gl.uniform3fv(U.dragon3d.uAlbedo, getDragon3d());
    gl.uniform1f(U.dragon3d.uTime, d3.time);
    gl.uniformMatrix4fv(U.dragon3d.uViewProj, false, d3.viewProj);
    gl.drawArrays(gl.TRIANGLES, 0, d3VertexCount);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
  }

  // ---------- debug overlays (path polylines + single-buffer inspect) ----------
  function debugPass(state, aspect) {
    if (!state.debug) return;
    if (state.debug.show) {
      gl.disable(gl.DEPTH_TEST);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const vp = state.dragon3d.viewProj;
      const p2 = state.debug.path2d;
      if (p2 && p2.length) {
        if (lineScratch.length < p2.length * 3) lineScratch = new Float32Array(p2.length * 3);
        for (let i = 0; i < p2.length; i++) {
          lineScratch[i * 3] = p2[i].x; lineScratch[i * 3 + 1] = p2[i].y; lineScratch[i * 3 + 2] = 0;
        }
        // the 2D path lies on z=0 in world space -> draw through the scene camera
        drawLine(lineScratch.subarray(0, p2.length * 3), true, vp, aspect, [0.9, 0.1, 0.6, 0.9]);
      }
      if (state.debug.path3d && state.debug.path3d.length) {
        drawLine(state.debug.path3d, true, vp, aspect, [0.0, 0.7, 1.0, 0.9]);
      }
      // pool waypoints: circle centres (single colour)
      if (state.debug.pool?.length) {
        drawPoints(state.debug.pool, true, vp, aspect, [0.2, 0.5, 1.0, 1.0]);
      }
    }
    // inspect a single offscreen buffer fullscreen
    if (state.debug.buffer && state.debug.buffer !== "none") {
      const map = { glyph: fbo.glyph, splash: fbo.splash, enso: fbo.enso, ink: fbo.ink };
      const tgt = map[state.debug.buffer];
      if (tgt) {
        gl.disable(gl.BLEND);
        gl.useProgram(progs.blit);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tgt.tex);
        gl.uniform1i(U.blit.uTex, 0);
        gl.bindVertexArray(emptyVao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.enable(gl.BLEND);
      }
    }
  }

  function frame(state) {
    frameCount++;
    const aspect = state.aspect;
    const nSeg = uploadSegs(state.glyph.segs); // shared by the glyph pass

    // Pass A: offscreen ink layers, premultiplied accumulation blend (shared)
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    glyphPass(state, nSeg);
    splashPass(state);
    ensoPass(state);
    inkPass(state, aspect);

    // Pass B: composite ink layers, then the 3D dragon, then debug overlays
    compositePass(state, aspect);
    dragonPass(state);
    debugPass(state, aspect);

    gl.bindVertexArray(null);
  }

  function destroy() {
    if (!gl) return;
    for (const k in progs) gl.deleteProgram(progs[k]);
    freeTarget(fbo.glyph); freeTarget(fbo.splash); freeTarget(fbo.enso); freeTarget(fbo.ink);
    gl.deleteTexture(segTex);
    gl.deleteTexture(d3FramesTex);
    gl.deleteBuffer(posBuf); gl.deleteBuffer(uvBuf); gl.deleteBuffer(idxBuf);
    gl.deleteBuffer(headBuf); gl.deleteBuffer(d3PosBuf); gl.deleteBuffer(d3NormBuf); gl.deleteBuffer(lineBuf);
    gl.deleteVertexArray(emptyVao); gl.deleteVertexArray(strokeVao);
    gl.deleteVertexArray(headVao); gl.deleteVertexArray(d3Vao); gl.deleteVertexArray(lineVao);
    gl = null;
  }

  return { init, resize, frame, destroy, get gl() { return gl; } };
}
