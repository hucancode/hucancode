// WebGL2 ink renderer for the calligraphy playground.
//
// Renders the glyph with the SDF brush shader
// (st/caligraphy-playground.frag.glsl). The baked Seg[] table
// is streamed to the GPU as an RGBA32F texture every render (bake.bakeSegs),
// so an edited glyph re-renders live - no shader recompile, no const arrays.

import FRAG from "$lib/playgrounds/shaders/st/caligraphy-playground.frag.glsl?raw";
import { bakeSegs } from "./bake";

const VERT = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main() { gl_Position = vec4(POS[gl_VertexID], 0.0, 1.0); }
`;

const TEXELS_PER_SEG = 4; // 4 RGBA32F texels = 16 floats per Seg (13 used)

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("brush GL shader compile failed:\n" + log);
  }
  return sh;
}

export function makeGLRenderer(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false, antialias: false, premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL2 not available");
  // RGBA32F sampling needs no extension; texelFetch with NEAREST is core WebGL2.

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("brush GL link failed:\n" + gl.getProgramInfoLog(prog));
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const U = {};
  for (const name of [
    "uResolution", "uBaseRadius", "uZoom", "uPan", "uGridSize",
    "uShowGrid", "uMode", "uTime", "uNSeg", "uSegTex",
  ]) U[name] = gl.getUniformLocation(prog, name);

  const vao = gl.createVertexArray(); // empty - positions come from gl_VertexID

  const segTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, segTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let texRows = 0;      // current texture height (allocated seg capacity)
  let buf = new Float32Array(0);

  // Pack the baked segs into the RGBA32F texture (width = 4, height = NSEG).
  function uploadSegs(segs) {
    const n = segs.length;
    if (n === 0) { return 0; }
    const need = n * TEXELS_PER_SEG * 4;
    if (buf.length < need) buf = new Float32Array(need);
    for (let i = 0; i < n; i++) {
      const s = segs[i];
      let o = i * TEXELS_PER_SEG * 4;
      // texel0: p1.xy, p2.xy
      buf[o++] = s.p1.x; buf[o++] = s.p1.y; buf[o++] = s.p2.x; buf[o++] = s.p2.y;
      // texel1: ctrl.xy, pr1, pr2
      buf[o++] = s.ctrl.x; buf[o++] = s.ctrl.y; buf[o++] = s.pr1; buf[o++] = s.pr2;
      // texel2: k, belly, hasBelly, t0
      buf[o++] = s.k; buf[o++] = s.belly; buf[o++] = s.hasBelly; buf[o++] = s.t0;
      // texel3: dur, v0, v1, (pad)
      buf[o++] = s.dur; buf[o++] = s.v0; buf[o++] = s.v1; buf[o++] = 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, segTex);
    if (n !== texRows) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TEXELS_PER_SEG, n, 0,
                    gl.RGBA, gl.FLOAT, buf, 0);
      texRows = n;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TEXELS_PER_SEG, n,
                       gl.RGBA, gl.FLOAT, buf, 0);
    }
    return n;
  }

  // params: { baseRadius, view:{zoom,panX,panY}, showGrid, gridSize,
  //           connect, timing, playhead (s | undefined) }
  function render(symbol, params) {
    const w = canvas.width, h = canvas.height;
    if (w <= 0 || h <= 0) return;

    const { segs } = bakeSegs(symbol, {
      connect: params.connect, timing: params.timing,
    });
    const n = uploadSegs(segs);

    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);

    const view = params.view || { zoom: 1, panX: 0, panY: 0 };
    gl.uniform2f(U.uResolution, w, h);
    gl.uniform1f(U.uBaseRadius, params.baseRadius ?? 0.07);
    gl.uniform1f(U.uZoom, view.zoom ?? 1);
    gl.uniform2f(U.uPan, view.panX ?? 0, view.panY ?? 0);
    gl.uniform1f(U.uGridSize, params.gridSize ?? 1.6);
    gl.uniform1i(U.uShowGrid, params.showGrid ? 1 : 0);
    gl.uniform1i(U.uMode, params.playhead === undefined ? 0 : 1);
    gl.uniform1f(U.uTime, params.playhead ?? 0);
    gl.uniform1i(U.uNSeg, n);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, segTex);
    gl.uniform1i(U.uSegTex, 0);

    if (n > 0) gl.drawArrays(gl.TRIANGLES, 0, 3);
    else { gl.clearColor(1.0, 0.988, 0.878, 1.0); gl.clear(gl.COLOR_BUFFER_BIT); }
  }

  function dispose() {
    gl.deleteTexture(segTex);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(prog);
  }

  return { render, dispose, gl };
}
