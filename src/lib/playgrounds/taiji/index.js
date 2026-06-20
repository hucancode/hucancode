import { createDevice, Color, animate, utils, eases } from "$lib/engine/index.js";
import CLOUD_FRAG from "./shaders/cloud.frag.glsl?raw";
import BAGUA_FRAG from "./shaders/bagua.frag.glsl?raw";
import TAIJI_FRAG from "./shaders/taiji.frag.glsl?raw";
import CLOUD_WGSL from "./shaders/cloud.wgsl?raw";
import BAGUA_WGSL from "./shaders/bagua.wgsl?raw";
import TAIJI_WGSL from "./shaders/taiji.wgsl?raw";
import VERT from "./shaders/taiji.vert.glsl?raw";

const config = { taijiSpin: 0.01, cloudSpeed: 4, bitCount: 3, stroke: 0.04, dot: 0.12 };
const color1 = new Color("#ffffff");
const color2 = new Color("#000000");

const F32 = (name) => ({ name, type: "f32" });
const VEC2 = (name) => ({ name, type: "vec2" });
const VEC3 = (name) => ({ name, type: "vec3" });

let canvas, device, pCloud, pBagua, pTaiji, disposed = false;
let time = 0, rot = 0, lastT = 0;
const cloudA = { v: 0 }, baguaA = { v: 0 }, taijiA = { v: 0 };

function setConfig(patch) { Object.assign(config, patch); }
function setColors(c1, c2) { color1.set(c1); color2.set(c2); }

// half-size that keeps centered square square for any canvas aspect
function square(s, aspect) {
  return aspect >= 1 ? [s / aspect, s] : [s, s * aspect];
}

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

  pCloud = device.shader({
    glsl: { vertex: VERT, fragment: CLOUD_FRAG }, wgsl: CLOUD_WGSL,
    uniforms: [VEC2("uScale"), F32("uRot"), F32("time"), F32("alpha")],
    blend: "straight", topology: "tri", target: "screen", sampleCount: 4,
  });
  pBagua = device.shader({
    glsl: { vertex: VERT, fragment: BAGUA_FRAG }, wgsl: BAGUA_WGSL,
    uniforms: [VEC2("uScale"), F32("uRot"), F32("time"), F32("alpha"), F32("uBitCount")],
    blend: "straight", topology: "tri", target: "screen", sampleCount: 4,
  });
  pTaiji = device.shader({
    glsl: { vertex: VERT, fragment: TAIJI_FRAG }, wgsl: TAIJI_WGSL,
    uniforms: [VEC2("uScale"), F32("uRot"), F32("alpha"), F32("uStroke"), F32("uDot"), VEC3("color1"), VEC3("color2")],
    blend: "straight", topology: "tri", target: "screen", sampleCount: 4,
  });

  lastT = performance.now();
  animate(cloudA, { v: { from: 0.1, to: 1 }, duration: 1000, ease: eases.linear });
  animate(baguaA, { v: 1, duration: 1000, ease: eases.outExpo });
  animate(taijiA, { v: 1, duration: 1000, delay: 200, ease: eases.outExpo });
}

function render() {
  if (!device || !pCloud) return;
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  time += dt * config.cloudSpeed;
  rot += config.taijiSpin;

  syncSize();
  const aspect = canvas.width / canvas.height;
  const c1 = [color1.r, color1.g, color1.b];
  const c2 = [color2.r, color2.g, color2.b];

  device.beginFrame();
  device.pass({ target: "screen", clear: [0, 0, 0, 0] }, (p) => {
    p.draw(pCloud, { count: 6, uniforms: { uScale: [1, 1], uRot: 0, time, alpha: cloudA.v } });
    p.draw(pBagua, {
      count: 6,
      uniforms: { uScale: square(1.5, aspect), uRot: 0, time, alpha: baguaA.v, uBitCount: config.bitCount },
    });
    p.draw(pTaiji, {
      count: 6,
      uniforms: {
        uScale: square(0.5, aspect), uRot: rot, alpha: taijiA.v,
        uStroke: config.stroke, uDot: config.dot, color1: c1, color2: c2,
      },
    });
  });
  device.endFrame();
}

function destroy() {
  disposed = true;
  utils.remove(cloudA);
  utils.remove(baguaA);
  utils.remove(taijiA);
  pCloud = pBagua = pTaiji = null;
  if (device) { device.destroy(); device = null; }
}

export { init, render, destroy, setConfig, setColors, config };
