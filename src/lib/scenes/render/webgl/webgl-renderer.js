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
import STROKE_FRAG from "./shaders/stroke.frag.glsl?raw";
import HEAD_FRAG from "./shaders/head.frag.glsl?raw";
import DRAGON3D_VERT from "./shaders/dragon3d.vert.glsl?raw";
import DRAGON3D_FRAG from "./shaders/dragon3d.frag.glsl?raw";
import GRID_VERT from "./shaders/grid.vert.glsl?raw";
import GRID_FRAG from "./shaders/grid.frag.glsl?raw";
import { buildRibbon, PERP_CLEARANCE, ARC_CLEARANCE } from "./stroke-gl.js";
import { loadDragonMesh } from "./dragon3d-gl.js";

const PAPER = [1.0, 0.988, 0.878, 1.0];
const INK_COLOR = [0.05, 0.05, 0.05, 0.95];
const DRAGON_OBJ = "/assets/obj/dragon-low.obj";

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
uniform mat4 uViewProj;
out vec2 vUV;
const vec2 C[4] = vec2[4](vec2(0.0,0.0), vec2(1.0,0.0), vec2(0.0,1.0), vec2(1.0,1.0));
void main() {
  vec2 c = C[gl_VertexID];
  vUV = c;
  vec3 world = vec3((c.x * 2.0 - 1.0) * uAspect, c.y * 2.0 - 1.0, uZ);
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

// debug path lines: 2D (x/aspect,y) or 3D (uVP * pos)
const LINE_VERT = `#version 300 es
precision highp float;
in vec3 aPos;
uniform mat4 uVP;
uniform float uAspect;
uniform int u3D;
void main() {
  if (u3D == 1) gl_Position = uVP * vec4(aPos, 1.0);
  else gl_Position = vec4(aPos.x / uAspect, aPos.y, 0.0, 1.0);
}`;
const LINE_FRAG = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 fragColor;
void main() { fragColor = uColor; }`;

const STROKE_VERT = `#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aLineUV;
uniform float uAspect;
out vec2 vUV01;
out vec2 vWorld;
void main() {
  vUV01 = aLineUV;
  vWorld = aPos;
  gl_Position = vec4(aPos.x / uAspect, aPos.y, 0.0, 1.0);
}`;

const HEAD_VERT = `#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aUV;
uniform float uAspect;
out vec2 vUV;
void main() { vUV = aUV; gl_Position = vec4(aPos.x / uAspect, aPos.y, 0.0, 1.0); }`;

// ---- gl helpers ------------------------------------------------------------
function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("shader compile failed:\n" + log + "\n--- src ---\n" + src);
  }
  return sh;
}
function link(gl, vsSrc, fsSrc) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("program link failed:\n" + gl.getProgramInfoLog(p));
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return p;
}
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
  let fbo = { glyph: null, splash: null, ink: null, dragon: null };
  let segTex, segBuf = new Float32Array(0), segRows = 0;
  // dynamic stroke buffers
  let strokeVao, posBuf, uvBuf, idxBuf;
  // head buffers
  let headVao, headBuf;
  // dragon3d
  let d3Vao, d3PosBuf, d3NormBuf, d3FramesTex, d3VertexCount = 0, d3FramesUploaded = false;
  // debug lines
  let lineVao, lineBuf, lineScratch = new Float32Array(0);
  let w = 1, h = 1;

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
    gl = canvas.getContext("webgl2", {
      alpha: false, antialias: true, depth: true, premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL2 not available");
    if (!gl.getExtension("EXT_color_buffer_float")) {
      // RGBA32F seg texture only needs sampling (core), not render - this is fine
      // even without the extension; texImage2D RGBA32F + texelFetch is core WebGL2.
    }

    progs.glyph = link(gl, FS_TRI_VERT, GLYPH_FRAG);
    progs.splash = link(gl, FS_TRI_VERT, SPLASH_FRAG);
    progs.composite = link(gl, COMPOSITE_VERT, COMPOSITE_FRAG);
    progs.stroke = link(gl, STROKE_VERT, STROKE_FRAG);
    progs.head = link(gl, HEAD_VERT, HEAD_FRAG);
    progs.dragon3d = link(gl, DRAGON3D_VERT, DRAGON3D_FRAG);
    progs.grid = link(gl, GRID_VERT, GRID_FRAG);
    progs.blit = link(gl, FS_TRI_VERT, BLIT_FRAG);
    progs.line = link(gl, LINE_VERT, LINE_FRAG);

    U.glyph = uniforms(gl, progs.glyph, ["uResolution", "uBaseRadius", "uTime", "uNSeg", "uSegTex"]);
    U.splash = uniforms(gl, progs.splash, ["uResolution", "uGrow", "uSpread", "uAmount", "uClock"]);
    U.composite = uniforms(gl, progs.composite, ["uTex", "uOpacity", "uAspect", "uZ", "uViewProj"]);
    U.stroke = uniforms(gl, progs.stroke, [
      "uAspect", "uInkFlow", "uStrands", "uWaterFlow", "uWobble", "uOpacity",
      "uWidthEnd", "uWidthOffset", "uWidthRange", "uWidthAnchor",
      "uPerpClearance", "uArcClearance", "uBrushColor", "uSimple",
    ]);
    U.head = uniforms(gl, progs.head, ["uAspect", "uBrushColor", "uOpacity"]);
    U.dragon3d = uniforms(gl, progs.dragon3d, [
      "uFrames", "uN", "uPathLen", "uBodyLen", "uHeadOffset", "uGirth", "uViewProj", "uOpacity", "uTime",
    ]);
    U.grid = uniforms(gl, progs.grid, ["uViewProj", "uExt", "uZ", "uStep", "uMinorDiv", "uOpacity", "uReveal", "uRevealMinor"]);
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

    // load dragon mesh (x normalised to [0,1]; uBodyLen scales it at draw time)
    const mesh = await loadDragonMesh(DRAGON_OBJ, 1.0);
    d3VertexCount = mesh.vertexCount;
    d3Vao = gl.createVertexArray();
    gl.bindVertexArray(d3Vao);
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

    resize(gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  function resize(nw, nh) {
    w = Math.max(1, nw | 0);
    h = Math.max(1, nh | 0);
    freeTarget(fbo.glyph);
    freeTarget(fbo.splash);
    freeTarget(fbo.ink);
    freeTarget(fbo.dragon);
    fbo.glyph = makeTarget();
    fbo.splash = makeTarget();
    fbo.ink = makeTarget();
    fbo.dragon = makeTarget(true); // needs depth for self-occlusion
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function uploadSegs(segs) {
    const n = segs.length;
    if (n === 0) return 0;
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
  function drawStroke(points, lineWidth, aspect, opacity, params, simple) {
    const r = buildRibbon(points, lineWidth);
    if (!r) return;
    gl.bindVertexArray(strokeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, r.positions, gl.STREAM_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, r.uvs, gl.STREAM_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, r.indices, gl.STREAM_DRAW);

    gl.uniform1f(U.stroke.uAspect, aspect);
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
    gl.uniform4fv(U.stroke.uBrushColor, INK_COLOR);
    gl.uniform1i(U.stroke.uSimple, simple ? 1 : 0);
    gl.drawElements(gl.TRIANGLES, r.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  const BODY_PARAMS = {
    inkFlow: 1.0, strands: 3.0, waterFlow: 0.8, wobble: 0.3,
    widthEnd: 0.2, widthOffset: 0.5, widthRange: 1.0, widthAnchor: 0.5,
  };
  function drawHead(head, aspect, opacity) {
    const theta = Math.atan2(head.dir.y, head.dir.x);
    const ct = Math.cos(theta), st = Math.sin(theta);
    const s = head.size;
    const HW = 2.4 * 0.5, HH = 1.6 * 0.5;
    const corners = [
      [-HW, -HH, 0, 0],
      [HW, -HH, 1, 0],
      [-HW, HH, 0, 1],
      [HW, HH, 1, 1],
    ];
    const data = new Float32Array(4 * 4);
    for (let i = 0; i < 4; i++) {
      const lx = corners[i][0] * s, ly = corners[i][1] * s;
      const wx = head.pos.x + (ct * lx - st * ly);
      const wy = head.pos.y + (st * lx + ct * ly);
      data[i * 4 + 0] = wx; data[i * 4 + 1] = wy;
      data[i * 4 + 2] = corners[i][2]; data[i * 4 + 3] = corners[i][3];
    }
    gl.bindVertexArray(headVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, headBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    gl.useProgram(progs.head);
    gl.uniform1f(U.head.uAspect, aspect);
    gl.uniform1f(U.head.uOpacity, opacity);
    gl.uniform4fv(U.head.uBrushColor, INK_COLOR);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function drawLine(dataF32, use3D, vp, aspect, color) {
    gl.bindVertexArray(lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, dataF32, gl.STREAM_DRAW);
    gl.useProgram(progs.line);
    gl.uniform1i(U.line.u3D, use3D ? 1 : 0);
    if (vp) gl.uniformMatrix4fv(U.line.uVP, false, vp);
    gl.uniform1f(U.line.uAspect, aspect);
    gl.uniform4fv(U.line.uColor, color);
    gl.drawArrays(gl.LINE_STRIP, 0, dataF32.length / 3);
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
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function compositeQuad(tex, opacity, z, viewProj, aspect) {
    gl.useProgram(progs.composite);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(U.composite.uTex, 0);
    gl.uniform1f(U.composite.uOpacity, opacity);
    gl.uniform1f(U.composite.uAspect, aspect);
    gl.uniform1f(U.composite.uZ, z);
    gl.uniformMatrix4fv(U.composite.uViewProj, false, viewProj);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function frame(state) {
    const aspect = state.aspect;
    const nSeg = uploadSegs(state.glyph.segs); // shared by the glyph + splash passes

    // ---------- Pass A: glyph ink -> FBO_glyph ----------
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.glyph.fb);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (nSeg > 0) {
      gl.useProgram(progs.glyph);
      gl.bindVertexArray(emptyVao);
      gl.uniform2f(U.glyph.uResolution, w, h);
      gl.uniform1f(U.glyph.uBaseRadius, state.glyph.baseRadius);
      gl.uniform1f(U.glyph.uTime, state.glyph.playhead);
      gl.uniform1i(U.glyph.uNSeg, nSeg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, segTex);
      gl.uniform1i(U.glyph.uSegTex, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // ---------- Pass A: ink splash -> FBO_splash ----------
    // procedural noise blob centred at the origin, grows + splatters over time
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.splash.fb);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (state.splash && state.splash.alpha > 0) {
      gl.useProgram(progs.splash);
      gl.bindVertexArray(emptyVao);
      gl.uniform2f(U.splash.uResolution, w, h);
      gl.uniform1f(U.splash.uGrow, state.splash.grow);
      gl.uniform1f(U.splash.uSpread, state.splash.spread);
      gl.uniform1f(U.splash.uAmount, state.splash.amount);
      gl.uniform1f(U.splash.uClock, state.splash.time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // ---------- Pass A: ink dragon -> FBO_ink ----------
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.ink.fb);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (state.opacity.inkDragon > 0) {
      const d = state.inkDragon;
      const ws = d.widthScale ?? 1; // body stroke width grows with the dragon
      gl.useProgram(progs.stroke);
      drawStroke(d.body, 0.03 * ws, aspect, 1.0, BODY_PARAMS, false);
      drawHead(d.head, aspect, 1.0);
    }

    // ---------- Pass B: composite to screen ----------
    // glyph + ink-dragon are textured quads on the z=0 plane, drawn through the
    // SAME orbit camera as the 3D dragon, so they tilt with it (no billboard).
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.clearColor(PAPER[0], PAPER[1], PAPER[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied composite
    const vp = state.dragon3d.viewProj;

    // ground grid (behind the ink layers, over the paper); radial wipe-in
    if (state.grid && state.grid.reveal > 0) drawGrid(state.grid);

    // ink splash wash sits between the grid and the glyph, bleeding under it
    if (state.splash && state.splash.alpha > 0)
      compositeQuad(fbo.splash.tex, state.splash.alpha, -0.006, vp, aspect);
    compositeQuad(fbo.glyph.tex, state.opacity.glyph, -0.002, vp, aspect);
    compositeQuad(fbo.ink.tex, state.opacity.inkDragon, 0.0, vp, aspect);

    // ---------- 3D dragon -> its own target, then composite to screen ----------
    if (state.opacity.dragon3d > 0 && d3VertexCount > 0) {
      const d3 = state.dragon3d;
      if (!d3FramesUploaded) {
        gl.bindTexture(gl.TEXTURE_2D, d3FramesTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 4, d3.frameCount, 0, gl.RGBA, gl.FLOAT, d3.frames, 0);
        d3FramesUploaded = true;
      }
      // draw the dragon into its offscreen target (transparent, own depth)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.dragon.fb);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
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
      gl.uniform1f(U.dragon3d.uTime, d3.time);
      gl.uniformMatrix4fv(U.dragon3d.uViewProj, false, d3.viewProj);
      gl.drawArrays(gl.TRIANGLES, 0, d3VertexCount);
      gl.disable(gl.DEPTH_TEST);

      // composite the dragon target to screen (premultiplied)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied dragon over
      gl.bindVertexArray(emptyVao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fbo.dragon.tex);
      gl.useProgram(progs.blit);
      gl.uniform1i(U.blit.uTex, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // ---------- debug path overlay ----------
    if (state.debug && state.debug.show) {
      gl.disable(gl.DEPTH_TEST);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const p2 = state.debug.path2d;
      if (p2 && p2.length) {
        if (lineScratch.length < p2.length * 3) lineScratch = new Float32Array(p2.length * 3);
        for (let i = 0; i < p2.length; i++) {
          lineScratch[i * 3] = p2[i].x; lineScratch[i * 3 + 1] = p2[i].y; lineScratch[i * 3 + 2] = 0;
        }
        // the 2D path lies on z=0 in world space -> draw through the scene camera
        // so it tilts/orbits with the dragon (not a flat screen overlay)
        drawLine(lineScratch.subarray(0, p2.length * 3), true, state.dragon3d.viewProj, aspect, [0.9, 0.1, 0.6, 0.9]);
      }
      if (state.debug.path3d && state.debug.path3d.length) {
        drawLine(state.debug.path3d, true, state.dragon3d.viewProj, aspect, [0.0, 0.7, 1.0, 0.9]);
      }
    }

    // ---------- debug: inspect a single offscreen buffer fullscreen ----------
    if (state.debug && state.debug.buffer && state.debug.buffer !== "none") {
      const map = { dragon: fbo.dragon, glyph: fbo.glyph, splash: fbo.splash, ink: fbo.ink };
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

    gl.bindVertexArray(null);
  }

  function destroy() {
    if (!gl) return;
    for (const k in progs) gl.deleteProgram(progs[k]);
    freeTarget(fbo.glyph); freeTarget(fbo.splash); freeTarget(fbo.ink); freeTarget(fbo.dragon);
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
