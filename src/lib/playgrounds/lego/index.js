import {
  createDevice, Camera, mat4, Vec3, Euler,
  boxGeometry, cylinderGeometry, mergeGeometries,
} from "$lib/engine/index.js";
import LEGO_WGSL from "./shaders/lego.wgsl?raw";
import VERT from "./shaders/lego.vert.glsl?raw";
import FRAG from "./shaders/lego.frag.glsl?raw";

const GRADIENT_STEP = 5;

const config = {
  width: 4,
  height: 2,
  depth: 1,
  thickness: 0.2,
  studRadius: 0.4,
  studHeight: 0.3,
  color: "#fab387",
  spin: 1,
};

let canvas, device, shader, camera, disposed = false;
let brick = null;
let color = [0.98, 0.7, 0.53];
let yaw = 0.6, pitch = 0.5;
let dragging = false, lastX = 0, lastY = 0;
let lastT = 0;
const light = new Vec3(30, 40, 30);
const _model = mat4.create();
const _vp = mat4.create();
const _origin = new Vec3(0, 0, 0);
const _scale = new Vec3(1, 1, 1);
const _rot = new Euler();

function colorRGB(hex) {
  if (typeof hex === "string") hex = parseInt(hex.replace("#", ""), 16);
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

function makeLegoPiece() {
  const width = Math.max(1, Math.round(config.width));
  const height = Math.max(1, Math.round(config.height));
  const depth = Math.max(0.4, config.depth);
  const t = Math.max(0.05, config.thickness);
  const R = Math.max(0.05, config.studRadius);
  const BH = Math.max(0.05, config.studHeight);
  const hh = (height - t) / 2;
  const hw = (width - t) / 2;
  const parts = [
    boxGeometry(width, depth, t).translate(0, 0, -hh),
    boxGeometry(t, depth, height).translate(hw, 0, 0),
    boxGeometry(width, depth, t).translate(0, 0, hh),
    boxGeometry(t, depth, height).translate(-hw, 0, 0),
    boxGeometry(width, t, height).translate(0, depth / 2, 0),
  ];
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      parts.push(
        cylinderGeometry(R, R, BH, 20).translate(
          i - (width - 1) / 2, depth / 2 + BH / 2, j - (height - 1) / 2,
        ),
      );
    }
  }
  return mergeGeometries(parts);
}

function disposeBrick() {
  if (!brick) return;
  brick.posBuf?.destroy();
  brick.normBuf?.destroy();
  brick = null;
}

function rebuild() {
  disposeBrick();
  const g = makeLegoPiece();
  brick = {
    posBuf: device.buffer({ kind: "vertex", data: g.attributes.position.array }),
    normBuf: device.buffer({ kind: "vertex", data: g.attributes.normal.array }),
    count: g.attributes.position.count,
  };
  camera._dist = Math.max(config.width, config.height, 3) * 2.4;
}

function setConfig(patch) {
  const structural = ["width", "height", "depth", "thickness", "studRadius", "studHeight"];
  const needsRebuild = structural.some((k) => k in patch);
  Object.assign(config, patch);
  if ("color" in patch) color = colorRGB(config.color);
  if (needsRebuild && device) rebuild();
}

function onDown(e) {
  dragging = true;
  lastX = e.touches ? e.touches[0].clientX : e.clientX;
  lastY = e.touches ? e.touches[0].clientY : e.clientY;
}
function onMove(e) {
  if (!dragging) return;
  const x = e.touches ? e.touches[0].clientX : e.clientX;
  const y = e.touches ? e.touches[0].clientY : e.clientY;
  yaw -= (x - lastX) * 0.01;
  pitch = Math.max(-1.2, Math.min(1.2, pitch - (y - lastY) * 0.01));
  lastX = x; lastY = y;
}
function onUp() {
  dragging = false;
}

async function init(canvasEl) {
  canvas = canvasEl;
  disposed = false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  device = await createDevice(canvas);
  if (disposed) { device.destroy(); device = null; return; }
  device.resize(canvas.width, canvas.height);
  shader = device.shader({
    glsl: { vertex: VERT, fragment: FRAG }, wgsl: LEGO_WGSL,
    buffers: [
      { stride: 12, step: "vertex", attributes: [{ name: "position", location: 0, format: "float32x3", offset: 0 }] },
      { stride: 12, step: "vertex", attributes: [{ name: "normal", location: 1, format: "float32x3", offset: 0 }] },
    ],
    uniforms: [
      { name: "uViewProj", type: "mat4" },
      { name: "uModel", type: "mat4" },
      { name: "uColor", type: "vec3" },
      { name: "uLightPos", type: "vec3" },
      { name: "uSteps", type: "f32" },
    ],
    depth: "test", blend: "none", topology: "tri", target: "screen", sampleCount: 4,
  });
  camera = new Camera(45, w / h, 0.1, 2000);
  camera.up.set(0, 1, 0);
  color = colorRGB(config.color);
  rebuild();
  lastT = performance.now();
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function syncSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const tw = Math.max(1, Math.floor(w * dpr)), th = Math.max(1, Math.floor(h * dpr));
  if (canvas.width === tw && canvas.height === th) return;
  canvas.width = tw; canvas.height = th;
  device.resize(tw, th);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function render() {
  if (!device || !shader || !brick) return;
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (!dragging) yaw += config.spin * dt * 0.4;

  syncSize();

  const d = camera._dist || 12, cp = Math.cos(pitch);
  camera.position.set(d * cp * Math.sin(yaw), d * Math.sin(pitch), d * cp * Math.cos(yaw));
  camera.lookAt(0, 0, 0);
  camera.update();
  // viewProj through camera seam (WebGPU remaps clip z to [0,1])
  mat4.copy(_vp, device.correctViewProj(camera.viewProjMatrix));

  mat4.compose(_model, _origin, _rot, _scale);

  device.beginFrame();
  device.pass({ target: "screen", clear: [0, 0, 0, 0], depth: true, depthClear: 1 }, (p) => {
    p.draw(shader, {
      buffers: [brick.posBuf, brick.normBuf],
      count: brick.count,
      uniforms: {
        uViewProj: _vp, uModel: _model,
        uColor: color, uLightPos: [light.x, light.y, light.z], uSteps: GRADIENT_STEP,
      },
    });
  });
  device.endFrame();
}

function destroy() {
  disposed = true;
  if (canvas) {
    canvas.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }
  disposeBrick();
  shader = null;
  if (device) { device.destroy(); device = null; }
}

export { init, render, destroy, setConfig, config };
