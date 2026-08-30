import { createPlayground, animate, utils, eases, F32, VEC2, VEC3 } from "$lib/engine/index.js";
import { hexToRGB } from "$lib/math/color.js";
import CLOUD from "./shaders/cloud.wgsl?shader";
import BAGUA from "./shaders/bagua.wgsl?shader";
import TAIJI from "./shaders/taiji.wgsl?shader";

const config = { taijiSpin: 0.01, cloudSpeed: 4, bitCount: 3, stroke: 0.04, dot: 0.12 };
let color1 = hexToRGB("#ffffff");
let color2 = hexToRGB("#000000");

let pCloud, pBagua, pTaiji;
let time = 0, rot = 0;
const cloudA = { v: 0 }, baguaA = { v: 0 }, taijiA = { v: 0 };

// half-size that keeps centered square square for any canvas aspect
function square(s, aspect) {
  return aspect >= 1 ? [s / aspect, s] : [s, s * aspect];
}

const { init, render, destroy, setConfig } = createPlayground({
  setConfig(patch) {
    if (patch.color1) color1 = hexToRGB(patch.color1);
    if (patch.color2) color2 = hexToRGB(patch.color2);
    Object.assign(config, patch);
  },
  init({ device }) {
    pCloud = device.shader({
      ...CLOUD,
      uniforms: [VEC2("uScale"), F32("uRot"), F32("time"), F32("alpha")],
      blend: "straight", topology: "tri",
    });
    pBagua = device.shader({
      ...BAGUA,
      uniforms: [VEC2("uScale"), F32("uRot"), F32("time"), F32("alpha"), F32("uBitCount")],
      blend: "straight", topology: "tri",
    });
    pTaiji = device.shader({
      ...TAIJI,
      uniforms: [VEC2("uScale"), F32("uRot"), F32("alpha"), F32("uStroke"), F32("uDot"), VEC3("color1"), VEC3("color2")],
      blend: "straight", topology: "tri",
    });

    animate(cloudA, { v: { from: 0.1, to: 1 }, duration: 1000, ease: eases.linear });
    animate(baguaA, { v: 1, duration: 1000, ease: eases.outExpo });
    animate(taijiA, { v: 1, duration: 1000, delay: 200, ease: eases.outExpo });
  },
  frame(dt, { device, canvas }) {
    time += dt * config.cloudSpeed;
    rot += config.taijiSpin;

    const aspect = canvas.width / canvas.height;

    device.beginFrame();
    device.pass({ clear: [0.09, 0.09, 0.11, 1] }, (p) => {
      p.draw(pCloud, { count: 6, uniforms: { uScale: [1, 1], uRot: 0, time, alpha: cloudA.v } });
      p.draw(pBagua, {
        count: 6,
        uniforms: { uScale: square(1.5, aspect), uRot: 0, time, alpha: baguaA.v, uBitCount: config.bitCount },
      });
      p.draw(pTaiji, {
        count: 6,
        uniforms: {
          uScale: square(0.5, aspect), uRot: rot, alpha: taijiA.v,
          uStroke: config.stroke, uDot: config.dot, color1, color2,
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

export { init, render, destroy, setConfig };
