import { createDevice, Camera, loadDragonMesh } from "$lib/engine/index.js";
import { buildSpline } from "$lib/math/curve.js";
import DRAGON_WGSL from "./shaders/dragon.wgsl?raw";
import PATH_WGSL from "./shaders/path.wgsl?raw";
import VERT from "./shaders/dragon.vert.glsl?raw";
import FRAG from "./shaders/dragon.frag.glsl?raw";
import PATH_VERT from "./shaders/path.vert.glsl?raw";
import PATH_FRAG from "./shaders/path.frag.glsl?raw";

const CANVAS_ID = "dragon";
const DRAGON_OBJ = "/assets/obj/dragon-low.obj";
const N_FRAMES = 384;
const MAX_DRAGON = 8;

const F32 = (name) => ({ name, type: "f32" });
const VEC3 = (name) => ({ name, type: "vec3" });
const MAT4 = (name) => ({ name, type: "mat4" });

const BUF_POS = { stride: 12, step: "vertex", attributes: [{ name: "position", location: 0, format: "float32x3", offset: 0 }] };
const BUF_NRM = { stride: 12, step: "vertex", attributes: [{ name: "normal", location: 1, format: "float32x3", offset: 0 }] };
const BUF_PATH = { stride: 12, step: "vertex", attributes: [{ name: "position", location: 0, format: "float32x3", offset: 0 }] };

const config = {
  preset: "circle", points: 10, spread: 1, speed: 0.0008, showLights: false, showPath: true,
  bodyFraction: 0.25,   // body length as fraction of loop
  girthFactor: 0.0012,  // cross-section scale relative to path length
};

let canvas, device, prog, pathProg, camera, dragonPos, dragonNorm, dragonCount = 0;
let dragons = [];
let time = 0, lastT = 0;
let disposed = false;

function setConfig(patch) {
  Object.assign(config, patch);
}
function getCurrentDragonCount() {
  return dragons.length;
}

function buildPath(preset, n, s) {
  const pts = [];
  if (preset === "circle") {
    const R = 14 * s, CZ = 150 * s, CY = 12 * s; // facing camera: circle in XY plane
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push({ x: Math.cos(a) * R, y: Math.sin(a) * R + CY, z: CZ }); }
  } else if (preset === "figure8") {
    const R = 21 * s, CZ = 150 * s, CY = 12 * s; // facing camera: lemniscate in XY plane
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push({ x: Math.sin(a) * R, y: Math.sin(a * 2) * R * 0.5 + CY, z: CZ }); }
  } else if (preset === "helix") {
    const R = 55 * s;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 * 3; pts.push({ x: Math.cos(a) * R, y: (i / n - 0.5) * 120 * s, z: Math.sin(a) * R }); }
  } else {
    const MIN_X = -40 * s, VAR_X = 80 * s, MIN_Y = -40 * s, VAR_Y = 80 * s, MIN_Z = -80 * s, VAR_Z = 160 * s;
    for (let i = 0; i < n; i++) pts.push({ x: Math.random() * VAR_X + MIN_X, y: Math.random() * VAR_Y + MIN_Y, z: Math.random() * VAR_Z + MIN_Z });
  }
  return pts;
}

// sample spline into N orthonormal frames (column-major mat4 each)
function bakeFrames(points) {
  const spline = buildSpline(points);
  const total = spline.total;
  const frames = new Float32Array(N_FRAMES * 16);
  for (let i = 0; i < N_FRAMES; i++) {
    const arc = (i / N_FRAMES) * total;
    const p = spline.pos(arc);
    const tg = spline.tan(arc);
    // world-up frame. tangent near-vertical -> fall back +Z
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(tg.y) > 0.95) { ux = 0; uy = 0; uz = 1; }
    let nx = uy * tg.z - uz * tg.y;
    let ny = uz * tg.x - ux * tg.z;
    let nz = ux * tg.y - uy * tg.x;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const bx = tg.y * nz - tg.z * ny;
    const by = tg.z * nx - tg.x * nz;
    const bz = tg.x * ny - tg.y * nx;
    const o = i * 16;
    frames[o] = tg.x; frames[o + 1] = tg.y; frames[o + 2] = tg.z; frames[o + 3] = 0;
    frames[o + 4] = nx; frames[o + 5] = ny; frames[o + 6] = nz; frames[o + 7] = 0;
    frames[o + 8] = bx; frames[o + 9] = by; frames[o + 10] = bz; frames[o + 11] = 0;
    frames[o + 12] = p.x; frames[o + 13] = p.y; frames[o + 14] = p.z; frames[o + 15] = 1;
  }
  return { frames, pathLen: total };
}

function randomColor() {
  const palette = [[0.25, 0.7, 1.0], [1.0, 0.55, 0.2], [0.6, 0.9, 0.4], [0.95, 0.4, 0.5], [0.8, 0.7, 1.0]];
  return palette[Math.floor(Math.random() * palette.length)];
}

function makeDragon() {
  if (!device || !dragonCount || dragons.length >= MAX_DRAGON) return;
  const { frames, pathLen } = bakeFrames(buildPath(config.preset, config.points, config.spread));
  // append first point again to close the loop (line-strip, not line-loop)
  const pathCount = N_FRAMES + 1;
  const pathPos = new Float32Array(pathCount * 3);
  for (let i = 0; i < N_FRAMES; i++) {
    pathPos[i * 3] = frames[i * 16 + 12];
    pathPos[i * 3 + 1] = frames[i * 16 + 13];
    pathPos[i * 3 + 2] = frames[i * 16 + 14];
  }
  pathPos[N_FRAMES * 3] = frames[12];
  pathPos[N_FRAMES * 3 + 1] = frames[13];
  pathPos[N_FRAMES * 3 + 2] = frames[14];

  const tex = device.texture({ width: 4, height: N_FRAMES, format: "rgba32f", filter: "nearest", data: frames });
  const pathBuf = device.buffer({ kind: "vertex", data: pathPos });
  dragons.push({
    tex,
    pathBuf,
    pathCount,
    pathLen,
    bodyLen: pathLen * config.bodyFraction,
    girth: pathLen * config.girthFactor,
    headOffset: Math.random() * pathLen,
    color: randomColor(),
  });
}

function clearDragon() {
  for (const d of dragons) {
    d.tex?.destroy();
    d.pathBuf?.destroy();
  }
  dragons = [];
}

function regenerate() {
  const count = Math.max(1, dragons.length);
  clearDragon();
  for (let i = 0; i < count; i++) makeDragon();
}

async function init() {
  canvas = document.getElementById(CANVAS_ID);
  disposed = false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  device = await createDevice(canvas);
  if (disposed) { device.destroy(); device = null; return; }
  device.resize(canvas.width, canvas.height);

  prog = device.shader({
    glsl: { vertex: VERT, fragment: FRAG }, wgsl: DRAGON_WGSL,
    buffers: [BUF_POS, BUF_NRM],
    uniforms: [
      F32("uN"), F32("uPathLen"), F32("uBodyLen"), F32("uHeadOffset"), F32("uGirth"),
      MAT4("uViewProj"), VEC3("uLightDir"), VEC3("uLightColor"), VEC3("uAmbient"), VEC3("uBaseColor"),
    ],
    textures: [{ name: "uFrames", binding: 1 }],
    blend: "none", depth: "test", topology: "tri", target: "screen", sampleCount: 4,
  });
  pathProg = device.shader({
    glsl: { vertex: PATH_VERT, fragment: PATH_FRAG }, wgsl: PATH_WGSL,
    buffers: [BUF_PATH],
    uniforms: [MAT4("uViewProj"), VEC3("uColor")],
    blend: "straight", depth: "none", topology: "line-strip", target: "screen", sampleCount: 4,
  });

  camera = new Camera(45, w / h, 1, 2000);
  camera.position.set(0, 20, 200);
  camera.lookAt(0, 0, 0);
  camera.update();

  const m = await loadDragonMesh(DRAGON_OBJ, 1.0); // x normalised to [0,1]
  if (disposed) { device.destroy(); device = null; return; }
  dragonPos = device.buffer({ kind: "vertex", data: m.positions });
  dragonNorm = device.buffer({ kind: "vertex", data: m.normals });
  dragonCount = m.vertexCount;
  makeDragon();
  lastT = performance.now();
}

function syncSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const cw = Math.max(1, Math.floor(w * dpr)), ch = Math.max(1, Math.floor(h * dpr));
  if (canvas.width === cw && canvas.height === ch) return;
  canvas.width = cw; canvas.height = ch;
  device.resize(cw, ch);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  camera.update();
}

function render() {
  if (!device || !dragonCount) return;
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  time += dt;

  syncSize();
  // copy shared scratch before reusing across draws
  const vp = device.correctViewProj(camera.viewProjMatrix).slice();

  let lightDir, lightColor, ambient;
  if (config.showLights) {
    lightDir = [Math.sin(time * 0.7) * 0.6 + 0.2, Math.cos(time * 0.5) * 0.8 + 0.6, Math.cos(time * 0.3) * 0.6 + 0.3];
    lightColor = [(Math.sin(time * 0.3) + 1) * 0.5, (Math.sin(time * 0.7) + 1) * 0.5, (Math.sin(time * 0.2) + 1) * 0.5];
    ambient = [(Math.sin(time * 0.1) + 1) * 0.25, (Math.sin(time * 0.07) + 1) * 0.25, (Math.sin(time * 0.03) + 1) * 0.3];
  } else {
    lightDir = [0.3, 1.0, 0.5];
    lightColor = [1, 1, 1];
    ambient = [0.25, 0.28, 0.35];
  }

  device.beginFrame();
  device.pass({ target: "screen", clear: [0.09, 0.09, 0.11, 1], depth: true, depthClear: 1 }, (p) => {
    for (const d of dragons) {
      // wrap by pathLen so offset stays bounded over long runs
      d.headOffset = (d.headOffset + config.speed * d.pathLen) % d.pathLen;
      p.draw(prog, {
        buffers: [dragonPos, dragonNorm], count: dragonCount, textures: { uFrames: d.tex },
        uniforms: {
          uViewProj: vp, uN: N_FRAMES, uPathLen: d.pathLen, uBodyLen: d.bodyLen,
          uHeadOffset: d.headOffset, uGirth: d.girth,
          uLightDir: lightDir, uLightColor: lightColor, uAmbient: ambient, uBaseColor: d.color,
        },
      });
    }
    if (config.showPath) {
      for (const d of dragons) {
        p.draw(pathProg, { buffers: [d.pathBuf], count: d.pathCount, uniforms: { uViewProj: vp, uColor: d.color } });
      }
    }
  });
  device.endFrame();
}

function destroy() {
  disposed = true;
  clearDragon();
  dragonPos?.destroy(); dragonNorm?.destroy();
  dragonPos = dragonNorm = null;
  dragonCount = 0;
  prog = pathProg = null;
  if (device) { device.destroy(); device = null; }
}

export {
  CANVAS_ID, init, render, destroy,
  getCurrentDragonCount, clearDragon, makeDragon, regenerate, setConfig, config,
};
