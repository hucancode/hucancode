import { createDevice } from "$lib/engine/index.js";
import FLOWER_FRAG from "./shaders/flower.frag.glsl?raw";
import FLOWER_WGSL from "./shaders/flower.wgsl?raw";
import VERT from "./shaders/flower.vert.glsl?raw";

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

const F32 = (name) => ({ name, type: "f32" });
const VEC2 = (name) => ({ name, type: "vec2" });
const VEC4 = (name) => ({ name, type: "vec4" });

let canvas, device, shader, disposed = false;

function setConfig(patch) { Object.assign(config, patch); }
function setInkColor(rgba) { inkColor = rgba.slice(0, 4); }
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
    glsl: { vertex: VERT, fragment: FLOWER_FRAG }, wgsl: FLOWER_WGSL,
    uniforms: [
      VEC2("uResolution"), F32("uPetals"), F32("uLayers"), F32("uLength"), F32("uWidth"),
      F32("uTipSharp"), F32("uTipNotch"), F32("uBaseBias"), F32("uLayerScale"),
      F32("uLayerTwist"), F32("uSwirl"), F32("uInkFlow"), F32("uWaterFlow"),
      VEC4("uInkColor"), VEC4("uBgColor"),
    ],
    blend: "none", topology: "tri", target: "screen", sampleCount: 4,
  });
}

function render() {
  if (!device || !shader) return;
  syncSize();
  device.beginFrame();
  device.pass({ target: "screen", clear: [bgColor[0], bgColor[1], bgColor[2], 1.0] }, (p) => {
    p.draw(shader, {
      count: 3,
      uniforms: {
        uResolution: [canvas.width, canvas.height],
        uPetals: config.petals, uLayers: config.layers, uLength: config.length, uWidth: config.width,
        uTipSharp: config.tipSharp, uTipNotch: config.tipNotch, uBaseBias: config.baseBias,
        uLayerScale: config.layerScale, uLayerTwist: config.layerTwist, uSwirl: config.swirl,
        uInkFlow: config.inkFlow, uWaterFlow: config.waterFlow,
        uInkColor: inkColor, uBgColor: bgColor,
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

export { init, render, destroy, setConfig, setInkColor, setBgColor, config };
