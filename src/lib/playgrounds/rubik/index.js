import { createDevice, Camera, boxGeometry, mat4, animate, stagger, utils, eases } from "$lib/engine/index.js";
import RUBIK_WGSL from "./shaders/rubik.wgsl?raw";
import VERT from "./shaders/rubik.vert.glsl?raw";
import FRAG from "./shaders/rubik.frag.glsl?raw";

const FACE_RIGHT = 0, FACE_LEFT = 1, FACE_TOP = 2, FACE_BOTTOM = 3, FACE_FRONT = 4, FACE_BACK = 5;
const FACE_TO_COLOR = [0x40a02b, 0x89b4fa, 0xf9e2af, 0xf8fafc, 0xef4444, 0xfe640b];
const BLACK = 0x181825;
const RUBIK_SIZE = 8;
const CUBE_MARGIN = 0.1;
const CELL = (1 + CUBE_MARGIN) * RUBIK_SIZE;
const CUBE_NUM_DEFAULT = 3;

const RANDOM_EASES = [
  eases.inElastic, eases.outElastic, eases.inOutElastic, eases.outInElastic,
  eases.inCubic, eases.inQuint, eases.inBack, eases.outCubic, eases.outQuint,
  eases.outBack, eases.inBounce, eases.inOutCubic, eases.inOutBack, eases.outBounce,
  eases.outInCubic, eases.outInBack, eases.outInBounce,
];

const config = { speed: 1, autoplay: true, randomEase: true };
let cubeNum = CUBE_NUM_DEFAULT;

let canvas, device, shader, camera, disposed = false;
let cubes = [];
let move = null;
let busy = false;
let running = false;

const CAM_PITCH = Math.PI / 4;
let yaw = Math.PI / 4;
let dragging = false;
let lastX = 0;
const _rot = mat4.create();
const _model = mat4.create();
const _t = mat4.create();
const _vp = mat4.create();

function setConfig(patch) {
  Object.assign(config, patch);
  if (config.autoplay) resume();
}
function setCubeSize(size) {
  cubeNum = size;
}

function colorRGB(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}
function isInFace(x, y, z, face, depth) {
  return (
    (face === FACE_TOP && y >= cubeNum - depth) ||
    (face === FACE_BOTTOM && y < depth) ||
    (face === FACE_FRONT && z >= cubeNum - depth) ||
    (face === FACE_BACK && z < depth) ||
    (face === FACE_LEFT && x < depth) ||
    (face === FACE_RIGHT && x >= cubeNum - depth)
  );
}
function faceColor(x, y, z, face) {
  return isInFace(x, y, z, face, 1) ? FACE_TO_COLOR[face] : BLACK;
}

// unit box, 6 verts/face, faces ordered +X,-X,+Y,-Y,+Z,-Z (matches faceColor index)
function makeCubeData(x, y, z) {
  const g = boxGeometry(1, 1, 1);
  const pos = g.attributes.position.array;
  const count = g.attributes.position.count;
  const color = new Float32Array(36 * 3);
  for (let face = 0; face < 6; face++) {
    const c = colorRGB(faceColor(x, y, z, face));
    for (let v = 0; v < 6; v++) {
      const o = (face * 6 + v) * 3;
      color[o] = c[0]; color[o + 1] = c[1]; color[o + 2] = c[2];
    }
  }
  return { position: pos, color, count };
}

function buildCubes() {
  cubes = [];
  const half = (cubeNum - 1) / 2;
  for (let y = 0; y < cubeNum; y++) {
    for (let x = 0; x < cubeNum; x++) {
      for (let z = 0; z < cubeNum; z++) {
        const base = mat4.create();
        mat4.compose(
          base,
          { x: (x - half) * CELL, y: (y - half) * CELL, z: (z - half) * CELL },
          { x: 0, y: 0, z: 0 },
          { x: RUBIK_SIZE, y: RUBIK_SIZE, z: RUBIK_SIZE },
        );
        const d = makeCubeData(x, y, z);
        cubes.push({
          posBuf: device.buffer({ kind: "vertex", data: d.position }),
          colorBuf: device.buffer({ kind: "vertex", data: d.color }),
          count: d.count,
          base,
          intro: { x: 0, y: 0 },
        });
      }
    }
  }
}

function disposeCubes() {
  for (const c of cubes) {
    c.posBuf?.destroy();
    c.colorBuf?.destroy();
  }
  cubes = [];
}

// recover cubelet integer grid coord from world translation
function gridOf(base) {
  const half = (cubeNum - 1) / 2;
  return {
    x: Math.round(base[12] / CELL + half),
    y: Math.round(base[13] / CELL + half),
    z: Math.round(base[14] / CELL + half),
  };
}

function rotationFor(axis, angle) {
  if (axis === 0) return mat4.rotationX(_rot, angle);
  if (axis === 1) return mat4.rotationY(_rot, angle);
  return mat4.rotationZ(_rot, angle);
}

function startMoveRandom() {
  if (busy || !running) return;
  const face = Math.floor(Math.random() * 6);
  const depth = Math.floor(Math.random() * (cubeNum - 1)) + 1;
  const magnitude = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 2) + 1);
  startMove(face, depth, magnitude);
}

function startMove(face, depth, magnitude) {
  const axis = face === FACE_LEFT || face === FACE_RIGHT ? 0
    : face === FACE_TOP || face === FACE_BOTTOM ? 1 : 2;
  const idx = [];
  for (let i = 0; i < cubes.length; i++) {
    const g = gridOf(cubes[i].base);
    if (isInFace(g.x, g.y, g.z, face, depth)) idx.push(i);
  }
  const target = (Math.PI / 2) * magnitude;
  const ease = config.randomEase
    ? RANDOM_EASES[Math.floor(Math.random() * RANDOM_EASES.length)]
    : eases.inOutCubic;
  const spd = config.speed || 1;
  busy = true;
  move = { idx, axis, angle: { v: 0 }, target };
  animate(move.angle, {
    v: target,
    duration: (600 * Math.abs(magnitude)) / spd,
    delay: 200 / spd,
    ease,
    onComplete: () => {
      const R = rotationFor(axis, target);
      for (const i of idx) {
        mat4.multiply(cubes[i].base, R, cubes[i].base);
        snap(cubes[i].base);
      }
      move = null;
      busy = false;
      if (config.autoplay && running) startMoveRandom();
    },
  });
}

// re-quantize translation to exact grid centres; kills accumulated float drift
function snap(base) {
  const half = (cubeNum - 1) / 2;
  base[12] = (Math.round(base[12] / CELL + half) - half) * CELL;
  base[13] = (Math.round(base[13] / CELL + half) - half) * CELL;
  base[14] = (Math.round(base[14] / CELL + half) - half) * CELL;
}

function resume() {
  if (!busy && config.autoplay && running) startMoveRandom();
}
function step() {
  if (!busy) startMoveRandom();
}

function entrance() {
  const targets = cubes.map((c) => c.intro);
  for (const c of cubes) {
    c.intro.x = -5 * CELL;
    c.intro.y = -20 * CELL;
  }
  animate(targets, {
    x: 0,
    y: { to: 0, ease: eases.outElastic },
    duration: 1000,
    delay: stagger(20),
    ease: eases.outSine,
    onComplete: () => {
      running = true;
      if (config.autoplay) startMoveRandom();
    },
  });
}

function onDown(e) {
  dragging = true;
  lastX = e.touches ? e.touches[0].clientX : e.clientX;
}
function onMove(e) {
  if (!dragging) return;
  const x = e.touches ? e.touches[0].clientX : e.clientX;
  yaw += (x - lastX) * 0.01;
  lastX = x;
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
    glsl: { vertex: VERT, fragment: FRAG }, wgsl: RUBIK_WGSL,
    buffers: [
      { stride: 12, step: "vertex", attributes: [{ name: "position", location: 0, format: "float32x3", offset: 0 }] },
      { stride: 12, step: "vertex", attributes: [{ name: "color", location: 1, format: "float32x3", offset: 0 }] },
    ],
    uniforms: [
      { name: "uViewProj", type: "mat4" },
      { name: "uModel", type: "mat4" },
    ],
    depth: "test", blend: "none", topology: "tri", target: "screen", sampleCount: 4,
  });
  camera = new Camera(45, w / h, 1, 2000);
  camera.up.set(0, 1, 0);
  buildCubes();
  entrance();
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function placeCamera() {
  const r = (cubeNum * CELL) * 2.2 + RUBIK_SIZE * 2, cp = Math.cos(CAM_PITCH);
  camera.position.set(r * cp * Math.cos(yaw), r * Math.sin(CAM_PITCH), r * cp * Math.sin(yaw));
  camera.lookAt(0, 0, 0);
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
  if (!device || !shader) return;
  syncSize();
  placeCamera();
  camera.update();
  mat4.copy(_vp, device.correctViewProj(camera.viewProjMatrix));

  device.beginFrame();
  device.pass({ target: "screen", clear: [0.09, 0.09, 0.11, 1], depth: true, depthClear: 1 }, (p) => {
    for (let i = 0; i < cubes.length; i++) {
      const cube = cubes[i];
      let model = cube.base;
      if (move && move.idx.includes(i)) {
        mat4.multiply(_model, rotationFor(move.axis, move.angle.v), cube.base);
        model = _model;
      }
      mat4.translation(_t, cube.intro.x, cube.intro.y, 0);
      mat4.multiply(_t, _t, model);
      p.draw(shader, {
        buffers: [cube.posBuf, cube.colorBuf],
        count: cube.count,
        uniforms: { uViewProj: _vp, uModel: _t },
      });
    }
  });
  device.endFrame();
}

function destroy() {
  disposed = true;
  running = false;
  busy = false;
  if (move) utils.remove(move.angle);
  utils.remove(cubes.map((c) => c.intro));
  move = null;
  if (canvas) {
    canvas.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }
  disposeCubes();
  shader = null;
  if (device) { device.destroy(); device = null; }
}

export { init, render, destroy, setConfig, setCubeSize, step, resume, config };
