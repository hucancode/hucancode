// Lego — standalone WebGL2 procedural-brick showcase (no three.js, no animejs).
// One brick is generated from tunable parameters (stud counts, body depth, wall
// thickness, stud size); the playground rebuilds it live as the user drags the
// sliders. A small in-scene toon shader (one point light + banded diffuse) gives
// it the classic plastic look. The brick auto-spins so its 3D form reads.

import {
  makeContext, Camera, mat4, Vec3, Euler,
  boxGeometry, cylinderGeometry, mergeGeometries,
} from "$lib/engine/index.js";

const VERT = `#version 300 es
in vec3 position;
in vec3 normal;
uniform mat4 uProj;
uniform mat4 uModelView;
uniform mat4 uModel;
uniform mat4 uNormal;
out vec3 vN;
out vec3 vW;
void main() {
  vN = mat3(uNormal) * normal;
  vW = (uModel * vec4(position, 1.0)).xyz;
  gl_Position = uProj * uModelView * vec4(position, 1.0);
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec3 vN;
in vec3 vW;
uniform vec3 uColor;
uniform vec3 uLightPos;
uniform float uSteps;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vN);
  vec3 L = normalize(uLightPos - vW);
  float d = max(dot(N, L), 0.0);
  d = floor(d * uSteps) / uSteps;           // toon banding
  vec3 col = uColor * (0.3 + 0.7 * d);
  fragColor = vec4(col, 1.0);
}`;

const GRADIENT_STEP = 5;

// Tunable, procedural-generation parameters driven by the playground page.
const config = {
  width: 4,        // studs along X
  height: 2,       // studs along Z
  depth: 1,        // body height
  thickness: 0.2,  // wall thickness
  studRadius: 0.4,
  studHeight: 0.3,
  color: "#fab387",
  spin: 1,         // auto-rotation speed
};

let canvas, gl, ctx, prog, camera;
let brick = null;
let color = [0.98, 0.7, 0.53];
let yaw = 0.6, pitch = 0.5;
let dragging = false, lastX = 0, lastY = 0;
let lastT = 0;
const light = new Vec3(30, 40, 30);
const _model = mat4.create();
const _mv = mat4.create();
const _nm = mat4.create();
const _origin = new Vec3(0, 0, 0);
const _scale = new Vec3(1, 1, 1);
const _rot = new Euler();

function colorRGB(hex) {
  if (typeof hex === "string") hex = parseInt(hex.replace("#", ""), 16);
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

// build one brick: four walls + a top plank + a grid of stud cylinders, merged
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
  if (!brick || !gl) return;
  if (brick._vbos) for (const k in brick._vbos) gl.deleteBuffer(brick._vbos[k]);
  if (brick._vaos) for (const v of brick._vaos.values()) gl.deleteVertexArray(v);
  brick = null;
}

function rebuild() {
  disposeBrick();
  brick = makeLegoPiece();
  // frame the brick: camera distance scales with its largest footprint
  camera._dist = Math.max(config.width, config.height, 3) * 2.4;
}

function setConfig(patch) {
  const structural = ["width", "height", "depth", "thickness", "studRadius", "studHeight"];
  const needsRebuild = structural.some((k) => k in patch);
  Object.assign(config, patch);
  if ("color" in patch) color = colorRGB(config.color);
  if (needsRebuild && gl) rebuild();
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

function init(canvasEl) {
  canvas = canvasEl;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx = makeContext(canvas);
  gl = ctx.gl;
  ctx.resize(w, h, dpr);
  gl.enable(gl.DEPTH_TEST);
  prog = ctx.program(VERT, FRAG);
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
  if (canvas.width === Math.floor(w * dpr) && canvas.height === Math.floor(h * dpr)) return;
  ctx.resize(w, h, dpr);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function render() {
  if (!gl || !brick) return;
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (!dragging) yaw += config.spin * dt * 0.4;

  syncSize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const d = camera._dist || 12, cp = Math.cos(pitch);
  camera.position.set(d * cp * Math.sin(yaw), d * Math.sin(pitch), d * cp * Math.cos(yaw));
  camera.lookAt(0, 0, 0);
  camera.update();

  mat4.compose(_model, _origin, _rot, _scale);
  mat4.multiply(_mv, camera.viewMatrix, _model);
  mat4.normalFromMat4(_nm, _model);
  prog.use();
  prog.set("uProj", camera.projectionMatrix)
    .set("uModelView", _mv).set("uModel", _model).set("uNormal", _nm)
    .set("uColor", color).set("uLightPos", light).set("uSteps", GRADIENT_STEP);
  prog.draw(brick);
}

function destroy() {
  if (canvas) {
    canvas.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }
  disposeBrick();
  if (prog) prog.dispose();
  gl = null;
}

export { init, render, destroy, setConfig, config };
