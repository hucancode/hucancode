import { createPlayground, F32, VEC2, VEC4 } from "$lib/engine/index.js";
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

let shader;

function setConfig(patch) { Object.assign(config, patch); }
function setBrushColor(rgba) { brushColor = rgba.slice(0, 4); }
function setBgColor(rgba) { bgColor = rgba.slice(0, 4); }

const { init, render, destroy } = createPlayground({
  init({ device }) {
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
  },
  frame(dt, { device, canvas }) {
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
  },
  destroy() { shader = null; },
});

export { init, render, destroy, setConfig, setBrushColor, setBgColor, config };
