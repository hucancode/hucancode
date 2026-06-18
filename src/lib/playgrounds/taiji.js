// Taiji — standalone WebGL2 flat shader showcase (no three.js, no animejs, no
// camera). Three full-screen-ish quads layered with alpha: a cloud/ink paper
// background, the bagua ring, and the spinning taiji symbol. Each is just the
// existing fragment shader drawn on a quad; the vertex shader rotates the sampled
// coords (for the disc spin) and keeps the symbol square regardless of aspect.

import { makeContext, Geometry, Color, animate, utils, eases } from "$lib/engine/index.js";
import CLOUD_FRAG from "$lib/playgrounds/shaders/cloud.frag.glsl?raw";
import BAGUA_FRAG from "$lib/playgrounds/shaders/bagua.frag.glsl?raw";
import TAIJI_FRAG from "$lib/playgrounds/shaders/taiji.frag.glsl?raw";

const VERT = `#version 300 es
in vec2 position;        // -1..1 quad corners
uniform vec2 uScale;     // clip-space half-size
uniform float uRot;      // rotate the sampled pattern (disc spin)
out vec2 vUV;
void main() {
  float c = cos(uRot), s = sin(uRot);
  vec2 r = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
  vUV = r * 0.5 + 0.5;
  gl_Position = vec4(position * uScale, 0.0, 1.0);
}`;

const config = { taijiSpin: 0.01, cloudSpeed: 4, bitCount: 3, stroke: 0.04, dot: 0.12 };
const color1 = new Color("#ffffff");
const color2 = new Color("#000000");

let canvas, gl, ctx, quad, pCloud, pBagua, pTaiji;
let time = 0, rot = 0, lastT = 0;
const cloudA = { v: 0 }, baguaA = { v: 0 }, taijiA = { v: 0 };

function setConfig(patch) {
  Object.assign(config, patch);
}
function setColors(c1, c2) {
  color1.set(c1);
  color2.set(c2);
}

// half-size that keeps a centered square actually square for any canvas aspect
function square(s, aspect) {
  return aspect >= 1 ? [s / aspect, s] : [s, s * aspect];
}

function init(canvasEl) {
  canvas = canvasEl;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx = makeContext(canvas);
  gl = ctx.gl;
  ctx.resize(canvas.clientWidth, canvas.clientHeight, dpr);
  quad = new Geometry().setAttribute(
    "position",
    new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
    2,
  );
  pCloud = ctx.program(VERT, CLOUD_FRAG);
  pBagua = ctx.program(VERT, BAGUA_FRAG);
  pTaiji = ctx.program(VERT, TAIJI_FRAG);
  lastT = performance.now();
  // entrance fades
  animate(cloudA, { v: { from: 0.1, to: 1 }, duration: 1000, ease: eases.linear });
  animate(baguaA, { v: 1, duration: 1000, ease: eases.outExpo });
  animate(taijiA, { v: 1, duration: 1000, delay: 200, ease: eases.outExpo });
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
  time += dt * config.cloudSpeed;
  rot += config.taijiSpin;

  syncSize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const aspect = canvas.width / canvas.height;

  // paper / cloud background (fills the frame)
  pCloud.use().set("uScale", [1, 1]).set("uRot", 0).set("time", time).set("alpha", cloudA.v);
  pCloud.draw(quad);
  // bagua ring
  pBagua.use().set("uScale", square(1.5, aspect)).set("uRot", 0).set("time", time)
    .set("alpha", baguaA.v).set("uBitCount", config.bitCount);
  pBagua.draw(quad);
  // taiji symbol (spins)
  pTaiji.use().set("uScale", square(0.5, aspect)).set("uRot", rot)
    .set("color1", color1).set("color2", color2).set("alpha", taijiA.v)
    .set("uStroke", config.stroke).set("uDot", config.dot);
  pTaiji.draw(quad);
}

function destroy() {
  utils.remove(cloudA);
  utils.remove(baguaA);
  utils.remove(taijiA);
  if (pCloud) pCloud.dispose();
  if (pBagua) pBagua.dispose();
  if (pTaiji) pTaiji.dispose();
  gl = null;
}

export { init, render, destroy, setConfig, setColors, config };
