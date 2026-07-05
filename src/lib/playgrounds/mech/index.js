// RENDER ENGINE — draws procedurally generated MESHES (triangle soup), no SDF.
// The page feeds it a model ({ items: [{ positions, normals, color }] }) built
// by parts.js; vertices are already in world space, so each item is one draw
// with its own color. Camera is a simple orbit around the model's bounds.
import { createDevice, Camera, mat4 } from "$lib/engine/index.js";
import MECH_WGSL from "./shaders/mech.wgsl?raw";
import VERT from "./shaders/mech.vert.glsl?raw";
import FRAG from "./shaders/mech.frag.glsl?raw";
import GRID_WGSL from "./shaders/grid.wgsl?raw";
import GRID_VERT from "./shaders/grid.vert.glsl?raw";
import GRID_FRAG from "./shaders/grid.frag.glsl?raw";

const BG = [0.07, 0.09, 0.13, 1];
const LIGHT_R = 30, LIGHT_Y = 40;
// grid on the XZ plane through y=0 -> marks every part's local origin
const GROUND = { ext: 7, y: 0, step: 0.5, minorDiv: 5, opacity: 0.55, color: [0.45, 0.5, 0.58] };

let canvas, device, shader, gridShader, camera, disposed = false;
let items = [];                    // [{ posBuf, normBuf, count, color }]
let pending = null;                // model waiting for device init

// FIXED camera: orbit around the origin with constant defaults — no auto-fit,
// the user frames the subject with drag + wheel
const VIEW0 = { yaw: 0.7, pitch: 0.25, dist: 6 };
let dist = VIEW0.dist;
let yaw = VIEW0.yaw, pitch = VIEW0.pitch;
let dragging = false, lastX = 0, lastY = 0;
let lastT = 0;

const config = {
  spin: 0.3,        // auto-rotate speed
  lightAngle: 0.6,  // light orbit position
};

function disposeItems() {
  for (const it of items) { it.posBuf?.destroy(); it.normBuf?.destroy(); }
  items = [];
}

function rebuild(model) {
  if (!device) { pending = model; return; }
  disposeItems();
  items = model.items.map((it) => ({
    posBuf: device.buffer({ kind: "vertex", data: it.positions }),
    normBuf: device.buffer({ kind: "vertex", data: it.normals }),
    count: it.positions.length / 3,
    color: it.color,
  }));
}

function setConfig(patch) {
  if ("spin" in patch) config.spin = patch.spin;
  if ("lightAngle" in patch) config.lightAngle = patch.lightAngle;
  if ("dist" in patch) dist = patch.dist;                     // page-chosen framing, still not auto
  if (patch.resetView) { yaw = VIEW0.yaw; pitch = VIEW0.pitch; dist = patch.dist ?? VIEW0.dist; }
  if (patch.model) {
    try { rebuild(patch.model); }
    catch (e) { console.warn("[mech] invalid model", e); }
  }
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
  pitch = Math.max(-1.3, Math.min(1.3, pitch + (y - lastY) * 0.01));
  lastX = x; lastY = y;
}
function onUp() { dragging = false; }
function onWheel(e) {
  e.preventDefault();
  dist = Math.max(1.5, Math.min(60, dist * (1 + Math.sign(e.deltaY) * 0.08)));
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
    glsl: { vertex: VERT, fragment: FRAG }, wgsl: MECH_WGSL,
    buffers: [
      { stride: 12, step: "vertex", attributes: [{ name: "position", location: 0, format: "float32x3", offset: 0 }] },
      { stride: 12, step: "vertex", attributes: [{ name: "normal", location: 1, format: "float32x3", offset: 0 }] },
    ],
    uniforms: [
      { name: "uViewProj", type: "mat4" },
      { name: "uColor", type: "vec3" },
      { name: "uLightPos", type: "vec3" },
      { name: "uViewPos", type: "vec3" },
    ],
    depth: "test", blend: "none", topology: "tri", target: "screen", sampleCount: 4,
  });
  gridShader = device.shader({
    glsl: { vertex: GRID_VERT, fragment: GRID_FRAG }, wgsl: GRID_WGSL,
    uniforms: [
      { name: "uViewProj", type: "mat4" },
      { name: "uExt", type: "f32" },
      { name: "uY", type: "f32" },
      { name: "uStep", type: "f32" },
      { name: "uMinorDiv", type: "f32" },
      { name: "uOpacity", type: "f32" },
      { name: "uColor", type: "vec3" },
    ],
    depth: "none", blend: "premult", topology: "tri-strip", target: "screen", sampleCount: 4,
  });
  camera = new Camera(45, w / h, 0.05, 500);
  if (pending) { rebuild(pending); pending = null; }
  lastT = performance.now();
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("wheel", onWheel, { passive: false });
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

const _vp = mat4.create();

function render() {
  if (!device || !shader) return;
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (!dragging) yaw += config.spin * dt * 0.5;

  syncSize();
  const cp = Math.cos(pitch);
  camera.position.set(dist * cp * Math.sin(yaw), dist * Math.sin(pitch), dist * cp * Math.cos(yaw));
  camera.lookAt(0, 0, 0);
  camera.update();
  mat4.copy(_vp, device.correctViewProj(camera.viewProjMatrix));
  const eye = [camera.position.x, camera.position.y, camera.position.z];
  const la = config.lightAngle;
  const light = [Math.cos(la) * LIGHT_R, LIGHT_Y, Math.sin(la) * LIGHT_R];

  device.beginFrame();
  device.pass({ target: "screen", clear: BG, depth: true, depthClear: 1 }, (p) => {
    if (gridShader) {
      p.draw(gridShader, {
        count: 4,
        uniforms: {
          uViewProj: _vp, uExt: GROUND.ext, uY: GROUND.y, uStep: GROUND.step,
          uMinorDiv: GROUND.minorDiv, uOpacity: GROUND.opacity, uColor: GROUND.color,
        },
      });
    }
    for (const it of items) {
      p.draw(shader, {
        buffers: [it.posBuf, it.normBuf],
        count: it.count,
        uniforms: { uViewProj: _vp, uColor: it.color, uLightPos: light, uViewPos: eye },
      });
    }
  });
  device.endFrame();
}

function destroy() {
  disposed = true;
  if (canvas) {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("wheel", onWheel);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }
  disposeItems();
  shader = null;
  gridShader = null;
  if (device) { device.destroy(); device = null; }
}

export { init, render, destroy, setConfig, config };
