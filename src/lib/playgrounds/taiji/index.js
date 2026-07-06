import { createPlayground, Color, animate, utils, eases, F32, VEC2, VEC3 } from "$lib/engine/index.js";
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

let pCloud, pBagua, pTaiji;
let time = 0, rot = 0;
const cloudA = { v: 0 }, baguaA = { v: 0 }, taijiA = { v: 0 };

function setConfig(patch) {
  if (patch.color1) color1.setStyle(patch.color1);
  if (patch.color2) color2.setStyle(patch.color2);
  Object.assign(config, patch);
}

// half-size that keeps centered square square for any canvas aspect
function square(s, aspect) {
  return aspect >= 1 ? [s / aspect, s] : [s, s * aspect];
}

const { init, render, destroy } = createPlayground({
  init({ device }) {
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

    animate(cloudA, { v: { from: 0.1, to: 1 }, duration: 1000, ease: eases.linear });
    animate(baguaA, { v: 1, duration: 1000, ease: eases.outExpo });
    animate(taijiA, { v: 1, duration: 1000, delay: 200, ease: eases.outExpo });
  },
  frame(dt, { device, canvas }) {
    time += dt * config.cloudSpeed;
    rot += config.taijiSpin;

    const aspect = canvas.width / canvas.height;
    const c1 = [color1.r, color1.g, color1.b];
    const c2 = [color2.r, color2.g, color2.b];

    device.beginFrame();
    device.pass({ target: "screen", clear: [0.09, 0.09, 0.11, 1] }, (p) => {
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
  },
  destroy() {
    utils.remove(cloudA);
    utils.remove(baguaA);
    utils.remove(taijiA);
    pCloud = pBagua = pTaiji = null;
  },
});

export { init, render, destroy, setConfig, config };
