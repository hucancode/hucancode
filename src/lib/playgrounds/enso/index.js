// full-screen triangle runs ensō fragment shader, renders sumi-e brush circle
// procedurally in polar space. no mesh, no camera; every knob is a shader uniform.

import { createDevice } from "$lib/engine/index.js";
import ENSO_FRAG from "./shaders/enso.frag.glsl?raw";
import ENSO_WGSL from "./shaders/enso.wgsl?raw";
import VERT from "./shaders/enso.vert.glsl?raw";

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
  sweep: 1.0,
  opacityBleed: 1.0,
  opacityWet: 1.0,
  opacityDry: 1.0,
};
let brushColor = [0.05, 0.05, 0.07, 1.0];
let bgColor = [0.96, 0.93, 0.86, 1.0];

const F32 = (name) => ({ name, type: "f32" });
const VEC2 = (name) => ({ name, type: "vec2" });
const VEC4 = (name) => ({ name, type: "vec4" });

let canvas, device, shader, disposed = false;
let time = 0, lastT = 0;

function setConfig(patch) { Object.assign(config, patch); }
function setBrushColor(rgba) { brushColor = rgba.slice(0, 4); }
function setBgColor(rgba) { bgColor = rgba.slice(0, 4); }

function syncSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    device?.resize(w, h);
  }
}

async function init(canvasEl) {
  canvas = canvasEl;
  disposed = false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  device = await createDevice(canvas);
  if (disposed) { device.destroy(); device = null; return; }
  device.resize(canvas.width, canvas.height);
  shader = device.shader({
    glsl: { vertex: VERT, fragment: ENSO_FRAG }, wgsl: ENSO_WGSL,
    uniforms: [
      VEC2("uResolution"), F32("uClockwise"), F32("uRadius"), F32("uAngleStart"),
      F32("uLineWidth"), F32("uWobble"), F32("uStrands"), F32("uInkFlow"),
      F32("uWaterFlow"), F32("uWidthEnd"), F32("uWidthOffset"), F32("uWidthRange"),
      F32("uWidthAnchor"), F32("uSweepAmt"), F32("uOpacityBleed"), F32("uOpacityWet"),
      F32("uOpacityDry"), VEC4("uBrushColor"), VEC4("uBgColor"),
    ],
    blend: "none", topology: "tri", target: "screen", sampleCount: 4,
  });
  lastT = performance.now();
}

function render() {
  if (!device || !shader) return;
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  time += dt;

  syncSize();
  device.beginFrame();
  device.pass({ target: "screen", clear: [bgColor[0], bgColor[1], bgColor[2], 1.0] }, (p) => {
    p.draw(shader, {
      count: 3,
      uniforms: {
        uResolution: [canvas.width, canvas.height],
        uClockwise: config.clockwise ? 1 : 0,
        uRadius: config.radius, uAngleStart: config.angleStart, uLineWidth: config.lineWidth,
        uWobble: config.wobble, uStrands: config.strands, uInkFlow: config.inkFlow,
        uWaterFlow: config.waterFlow, uWidthEnd: config.widthEnd, uWidthOffset: config.widthOffset,
        uWidthRange: config.widthRange, uWidthAnchor: config.widthAnchor, uSweepAmt: config.sweep,
        uOpacityBleed: config.opacityBleed, uOpacityWet: config.opacityWet, uOpacityDry: config.opacityDry,
        uBrushColor: brushColor, uBgColor: bgColor,
      },
    });
  });
  device.endFrame();
}

function destroy() {
  disposed = true;
  shader = null;
  if (device) { device.destroy(); device = null; }
}

export { init, render, destroy, setConfig, setBrushColor, setBgColor, config };
