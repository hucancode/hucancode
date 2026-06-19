// Sumi-e ink flower — standalone WebGL2 flat-shader showcase (no three.js). A
// single full-screen quad runs the flower fragment shader, which renders petals
// procedurally in polar space. No mesh, no camera — every knob is a shader
// uniform driven by the controls panel.

import { makeContext, Geometry } from "$lib/engine/index.js";
import FLOWER_FRAG from "./shaders/flower.frag.glsl?raw";

const VERT = `#version 300 es
in vec2 position;   // -1..1 quad corners
out vec2 vUV;
void main() {
  vUV = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const config = {
  petals: 8,
  layers: 1,
  length: 1.0,
  width: 0.2,
  tipSharp: 1.5,
  tipNotch: 0.1,
  baseBias: 1.4,
  layerScale: 0.66,
  layerTwist: 0.4,
  swirl: 0.0,
  inkFlow: 1.0,
  waterFlow: 0.6,
};
let inkColor = [0.07, 0.06, 0.09, 1.0];
let bgColor = [0.96, 0.93, 0.86, 1.0];

let canvas, gl, ctx, quad, prog;

function setConfig(patch) {
  Object.assign(config, patch);
}
function setInkColor(rgba)  { inkColor = rgba.slice(0, 4); }
function setBgColor(rgba)   { bgColor = rgba.slice(0, 4); }

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
  prog = ctx.program(VERT, FLOWER_FRAG);
}

function syncSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr))
    ctx.resize(w, h, dpr);
}

function render() {
  if (!gl) return;
  syncSize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.clearColor(bgColor[0], bgColor[1], bgColor[2], 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  prog.use()
    .set("uResolution", [canvas.width, canvas.height])
    .set("uPetals", config.petals)
    .set("uLayers", config.layers)
    .set("uLength", config.length)
    .set("uWidth", config.width)
    .set("uTipSharp", config.tipSharp)
    .set("uTipNotch", config.tipNotch)
    .set("uBaseBias", config.baseBias)
    .set("uLayerScale", config.layerScale)
    .set("uLayerTwist", config.layerTwist)
    .set("uSwirl", config.swirl)
    .set("uInkFlow", config.inkFlow)
    .set("uWaterFlow", config.waterFlow)
    .set("uInkColor", inkColor)
    .set("uBgColor", bgColor);
  prog.draw(quad);
}

function destroy() {
  if (prog) prog.dispose();
  gl = null;
}

export { init, render, destroy, setConfig, setInkColor, setBgColor, config };
