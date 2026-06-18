// Ensō — standalone WebGL2 flat-shader showcase (no three.js). A single
// full-screen quad runs the ensō fragment shader, which renders the sumi-e
// brush circle procedurally in polar space. No mesh, no camera — every knob is
// a shader uniform driven by the controls panel.

import { makeContext, Geometry } from "$lib/engine/index.js";
import ENSO_FRAG from "./shaders/enso.frag.glsl?raw";

const VERT = `#version 300 es
in vec2 position;   // -1..1 quad corners
out vec2 vUV;
void main() {
  vUV = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const config = {
  radius: 0.55,
  angleStart: 0.0,
  lineWidth: 0.28,
  wobble: 0.5,
  strands: 1.5,
  inkFlow: 1.0,
  waterFlow: 0.7,
  widthEnd: 0.15,
  widthOffset: 0.55,
  widthRange: 1.5,
  widthAnchor: 1.0,
  clockwise: true,
  sweep: 1.0,        // used when autoSweep is off
  autoSweep: true,   // breathe the sweep with time (the Shadertoy default)
};
let brushColor = [0.05, 0.05, 0.07, 1.0];
let bgColor = [0.96, 0.93, 0.86, 1.0];

let canvas, gl, ctx, quad, prog;
let time = 0, lastT = 0;

function setConfig(patch) {
  Object.assign(config, patch);
}
function setBrushColor(rgba) { brushColor = rgba.slice(0, 4); }
function setBgColor(rgba) { bgColor = rgba.slice(0, 4); }

function init(canvasEl) {
  canvas = canvasEl;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx = makeContext(canvas, { alpha: false });
  gl = ctx.gl;
  ctx.resize(canvas.clientWidth, canvas.clientHeight, dpr);
  quad = new Geometry().setAttribute(
    "position",
    new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
    2,
  );
  prog = ctx.program(VERT, ENSO_FRAG);
  lastT = performance.now();
}

function syncSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr))
    ctx.resize(w, h, dpr);
}

function render() {
  if (!gl) return;
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  time += dt;

  syncSize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.clearColor(bgColor[0], bgColor[1], bgColor[2], 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const sweep = config.autoSweep ? 0.65 + 0.35 * Math.sin(time * 0.6) : config.sweep;

  prog.use()
    .set("uResolution", [canvas.width, canvas.height])
    .set("uClockwise", config.clockwise ? 1 : 0)
    .set("uRadius", config.radius)
    .set("uAngleStart", config.angleStart)
    .set("uLineWidth", config.lineWidth)
    .set("uWobble", config.wobble)
    .set("uStrands", config.strands)
    .set("uInkFlow", config.inkFlow)
    .set("uWaterFlow", config.waterFlow)
    .set("uWidthEnd", config.widthEnd)
    .set("uWidthOffset", config.widthOffset)
    .set("uWidthRange", config.widthRange)
    .set("uWidthAnchor", config.widthAnchor)
    .set("uSweepAmt", sweep)
    .set("uBrushColor", brushColor)
    .set("uBgColor", bgColor);
  prog.draw(quad);
}

function destroy() {
  if (prog) prog.dispose();
  gl = null;
}

export { init, render, destroy, setConfig, setBrushColor, setBgColor, config };
