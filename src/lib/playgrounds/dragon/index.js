// Flying dragon — standalone WebGL2 (no three.js, no animejs). The dragon mesh
// is deformed along a closed Catmull-Rom flight path entirely on the GPU: the
// path is sampled into N orthonormal frames (a column-major mat4 each) packed
// into a float texture; the vertex shader maps mesh.x along the path and bends
// the cross-section into the local frame. Advancing a head offset flies it
// forever. All curve/baking logic lives here in the scene — the engine only
// transports the data and draws.

import { makeContext, Camera, Geometry, DataTexture, mat4, loadDragonMesh } from "$lib/engine/index.js";
import { buildSpline } from "$lib/math/curve.js";

const CANVAS_ID = "dragon";
const DRAGON_OBJ = "/assets/obj/dragon-low.obj";
const N_FRAMES = 384;
const MAX_DRAGON = 8;

const VERT = `#version 300 es
in vec3 position;
in vec3 normal;
uniform sampler2D uFrames;
uniform float uN;
uniform float uPathLen;
uniform float uBodyLen;
uniform float uHeadOffset;
uniform float uGirth;
uniform mat4 uViewProj;
out vec3 vN;
mat4 fetchFrame(int i) {
  return mat4(
    texelFetch(uFrames, ivec2(0, i), 0),
    texelFetch(uFrames, ivec2(1, i), 0),
    texelFetch(uFrames, ivec2(2, i), 0),
    texelFetch(uFrames, ivec2(3, i), 0));
}
void main() {
  float N = uN;
  float u = (position.x * uBodyLen + uHeadOffset) / uPathLen * N + N;
  int lo = int(mod(floor(u), N));
  int hi = int(mod(ceil(u), N));
  float k = fract(u);
  mat4 Mlo = fetchFrame(lo);
  mat4 Mhi = fetchFrame(hi);
  vec4 p = vec4(0.0, position.yz * uGirth, 1.0);
  vec4 world = mix(Mlo * p, Mhi * p, k);
  gl_Position = uViewProj * world;
  vec4 nr = vec4(normal, 0.0);
  vN = normalize(mix((Mlo * nr).xyz, (Mhi * nr).xyz, k));
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 vN;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbient;
uniform vec3 uBaseColor;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vN);
  float d = max(dot(N, normalize(uLightDir)), 0.0);
  vec3 c = uBaseColor * (uAmbient + d * uLightColor);
  fragColor = vec4(c, 1.0);
}`;

// flight-path line: just transform the baked frame positions and draw a loop
const PATH_VERT = `#version 300 es
in vec3 position;
uniform mat4 uViewProj;
void main() { gl_Position = uViewProj * vec4(position, 1.0); }`;

const PATH_FRAG = `#version 300 es
precision highp float;
uniform vec3 uColor;
out vec4 fragColor;
void main() { fragColor = vec4(uColor, 0.5); }`;

const config = {
  preset: "circle", points: 10, spread: 1, speed: 0.0008, showLights: false, showPath: true,
  bodyFraction: 0.25,   // dragon body length as a fraction of the loop
  girthFactor: 0.0012,  // cross-section scale relative to path length
};

let canvas, gl, ctx, prog, pathProg, camera, mesh;
let dragons = []; // { tex, frames, pathLen, bodyLen, girth, headOffset, color }
let time = 0, lastT = 0;

function setConfig(patch) {
  Object.assign(config, patch);
}
function getCurrentDragonCount() {
  return dragons.length;
}

// flight-path presets -> array of {x,y,z} control points
function buildPath(preset, n, s) {
  const pts = [];
  if (preset === "circle") {
    const R = 14 * s, CZ = 150 * s, CY = 12 * s; // facing camera: circle in the XY plane
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push({ x: Math.cos(a) * R, y: Math.sin(a) * R + CY, z: CZ }); }
  } else if (preset === "figure8") {
    const R = 21 * s, CZ = 150 * s, CY = 12 * s; // facing camera: lemniscate in the XY plane
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

// sample the spline into N orthonormal frames (column-major mat4 each), packed
// into a Float32Array(N*16) for the RGBA32F frame texture
function bakeFrames(points) {
  const spline = buildSpline(points);
  const total = spline.total;
  const frames = new Float32Array(N_FRAMES * 16);
  for (let i = 0; i < N_FRAMES; i++) {
    const arc = (i / N_FRAMES) * total;
    const p = spline.pos(arc);
    const tg = spline.tan(arc);
    // world-up frame; fall back to +Z when the tangent runs near-vertical
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
  if (!mesh || dragons.length >= MAX_DRAGON) return;
  const { frames, pathLen } = bakeFrames(buildPath(config.preset, config.points, config.spread));
  // pull the frame origins out as a closed line loop for the path overlay
  const pathPos = new Float32Array(N_FRAMES * 3);
  for (let i = 0; i < N_FRAMES; i++) {
    pathPos[i * 3] = frames[i * 16 + 12];
    pathPos[i * 3 + 1] = frames[i * 16 + 13];
    pathPos[i * 3 + 2] = frames[i * 16 + 14];
  }
  dragons.push({
    tex: new DataTexture(frames, 4, N_FRAMES),
    path: new Geometry().setAttribute("position", pathPos, 3),
    pathLen,
    bodyLen: pathLen * config.bodyFraction,
    girth: pathLen * config.girthFactor,
    headOffset: Math.random() * pathLen,
    color: randomColor(),
  });
}

function clearDragon() {
  for (const d of dragons) {
    if (gl && d.tex._tex) gl.deleteTexture(d.tex._tex);
    if (gl && d.path && d.path._vbos) {
      for (const k in d.path._vbos) gl.deleteBuffer(d.path._vbos[k]);
      if (d.path._vaos) for (const v of d.path._vaos.values()) gl.deleteVertexArray(v);
    }
  }
  dragons = [];
}

// rebuild every dragon onto a freshly generated path (knob change / "new path")
function regenerate() {
  const count = Math.max(1, dragons.length);
  clearDragon();
  for (let i = 0; i < count; i++) makeDragon();
}

async function init() {
  canvas = document.getElementById(CANVAS_ID);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx = makeContext(canvas);
  gl = ctx.gl;
  ctx.resize(w, h, dpr);
  gl.enable(gl.DEPTH_TEST);
  prog = ctx.program(VERT, FRAG);
  pathProg = ctx.program(PATH_VERT, PATH_FRAG);
  camera = new Camera(45, w / h, 1, 2000);
  camera.position.set(0, 20, 200);
  camera.lookAt(0, 0, 0);
  const m = await loadDragonMesh(DRAGON_OBJ, 1.0); // x normalised to [0,1]
  mesh = new Geometry()
    .setAttribute("position", m.positions, 3)
    .setAttribute("normal", m.normals, 3);
  makeDragon();
  lastT = performance.now();
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
  if (!gl || !mesh) return;
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  time += dt;

  syncSize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  camera.update();

  // lights: animated coloured key light, or steady white from above
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

  for (const d of dragons) {
    // wrap by pathLen (closed loop) so the offset stays bounded over long runs
    d.headOffset = (d.headOffset + config.speed * d.pathLen) % d.pathLen;
    prog.use(); // resets texture-unit assignment for this dragon's frame sampler
    prog.set("uViewProj", camera.viewProjMatrix).set("uN", N_FRAMES)
      .set("uLightDir", lightDir).set("uLightColor", lightColor).set("uAmbient", ambient)
      .set("uFrames", d.tex).set("uPathLen", d.pathLen).set("uBodyLen", d.bodyLen)
      .set("uHeadOffset", d.headOffset).set("uGirth", d.girth).set("uBaseColor", d.color);
    prog.draw(mesh);
  }

  // optional flight-path overlay
  if (config.showPath) {
    pathProg.use().set("uViewProj", camera.viewProjMatrix);
    for (const d of dragons) {
      pathProg.set("uColor", d.color);
      pathProg.draw(d.path, gl.LINE_LOOP);
    }
  }
}

function destroy() {
  clearDragon();
  if (prog) prog.dispose();
  if (pathProg) pathProg.dispose();
  mesh = null;
  gl = null;
}

export {
  CANVAS_ID, init, render, destroy,
  getCurrentDragonCount, clearDragon, makeDragon, regenerate, setConfig, config,
};
