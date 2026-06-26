// RENDER ENGINE — knows only render primitives (SDF nodes + CSG) and how to draw
// them. It has no concept of "mech" or design rules; the page feeds it a model
// ({ nodes, floorY, midY, dist }) produced by the design engine.
import { createDevice } from "$lib/engine/index.js";
import { pack } from "./sdf.js";
import MECH_WGSL from "./shaders/mech.wgsl?raw";
import VERT from "./shaders/mech.vert.glsl?raw";
import FRAG from "./shaders/mech.frag.glsl?raw";

// fixed three-point-ish lighting; warm key + cool fill reads as "industrial"
const KEY = [1.0, 0.93, 0.82];
const FILL = [0.34, 0.4, 0.52];
const BG_TOP = [0.07, 0.09, 0.13];
const BG_BOT = [0.16, 0.14, 0.13];
const FOV = 42;

let canvas, device, shader, disposed = false;
let nodeTex = null, nodeCount = 0;
// empty until the page supplies a model — render engine ships no content of its own
let model = { nodes: [], floorY: -2, midY: 0.9, dist: 9.5 };
let floorY = model.floorY, midY = model.midY;

let yaw = 0.7, pitch = 0.12, dist = model.dist;
let dragging = false, lastX = 0, lastY = 0;
let lastT = 0, time = 0;

const config = {
  spin: 0.0,      // auto-rotate speed
  stage: 3,       // max pipeline stage shown (1..3)
  selected: -1,   // highlighted node row (-1 = none)
  shadow: 0,      // soft shadows on/off (quality), off by default
  ground: 0,      // implicit ground plane on/off, off by default
  lightAngle: 0.6,
};

function rebuild(m = model) {
  model = m;
  floorY = model.floorY ?? -2;
  midY = model.midY ?? 0.8;
  if (model.dist) dist = model.dist;
  if (!device) return;
  const { data, count, width } = pack(model);
  nodeCount = count;
  if (!nodeTex) nodeTex = device.texture({ width, height: Math.max(1, count), format: "rgba32f", filter: "nearest", data });
  else nodeTex.write(data, width, Math.max(1, count));
}

function setConfig(patch) {
  if ("spin" in patch) config.spin = patch.spin;
  if ("stage" in patch) config.stage = patch.stage;
  if ("selected" in patch) config.selected = patch.selected;
  if ("shadow" in patch) config.shadow = patch.shadow;
  if ("ground" in patch) config.ground = patch.ground;
  if ("lightAngle" in patch) config.lightAngle = patch.lightAngle;
  if ("dist" in patch) dist = patch.dist;
  if (patch.resetView) { yaw = 0.7; pitch = 0.12; dist = model.dist ?? 9.5; }
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
  dist = Math.max(3.5, Math.min(24, dist * (1 + Math.sign(e.deltaY) * 0.08)));
}

async function init(canvasEl) {
  canvas = canvasEl;
  disposed = false;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  device = await createDevice(canvas);
  if (disposed) { device.destroy(); device = null; return; }
  device.resize(canvas.width, canvas.height);
  shader = device.shader({
    glsl: { vertex: VERT, fragment: FRAG }, wgsl: MECH_WGSL,
    textures: [{ name: "nodeTex", binding: 1 }],
    uniforms: [
      { name: "uCamPos", type: "vec3" },
      { name: "uCamRight", type: "vec3" },
      { name: "uCamUp", type: "vec3" },
      { name: "uCamFwd", type: "vec3" },
      { name: "uLightDir", type: "vec3" },
      { name: "uKeyColor", type: "vec3" },
      { name: "uFillColor", type: "vec3" },
      { name: "uBgTop", type: "vec3" },
      { name: "uBgBot", type: "vec3" },
      { name: "uFloorY", type: "f32" },
      { name: "uCount", type: "f32" },
      { name: "uStage", type: "f32" },
      { name: "uSelected", type: "f32" },
      { name: "uTime", type: "f32" },
      { name: "uShadow", type: "f32" },
      { name: "uGround", type: "f32" },
    ],
    depth: "none", blend: "none", topology: "tri", target: "screen", sampleCount: 4,
  });
  rebuild(model);
  lastT = performance.now();
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function syncSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const tw = Math.max(1, Math.floor(w * dpr)), th = Math.max(1, Math.floor(h * dpr));
  if (canvas.width === tw && canvas.height === th) return;
  canvas.width = tw; canvas.height = th;
  device.resize(tw, th);
}

// camera basis -> ray-generation uniforms (prescaled by fov/aspect so the shader
// just does fwd + uv.x*right + uv.y*up).
function cameraUniforms() {
  const aspect = canvas.width / canvas.height;
  const cp = Math.cos(pitch);
  const px = dist * cp * Math.sin(yaw);
  const py = midY + dist * Math.sin(pitch);
  const pz = dist * cp * Math.cos(yaw);
  // forward = target - pos
  let fx = -px, fy = midY - py, fz = -pz;
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  // right = normalize(cross(fwd, worldUp)), worldUp = (0,1,0) -> (-fz, 0, fx)
  let rx = -fz, ry = 0, rz = fx;
  const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
  // up = cross(right, fwd)
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const tanHalf = Math.tan((FOV * Math.PI) / 180 / 2);
  const sR = tanHalf * aspect, sU = tanHalf;
  return {
    pos: [px, py, pz],
    right: [rx * sR, ry * sR, rz * sR],
    up: [ux * sU, uy * sU, uz * sU],
    fwd: [fx, fy, fz],
  };
}

function render() {
  if (!device || !shader || !nodeTex) return;
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now; time += dt;
  if (!dragging) yaw += config.spin * dt * 0.5;

  syncSize();
  const cam = cameraUniforms();
  const la = config.lightAngle;
  const lightDir = [Math.cos(la) * 0.7, 0.85, Math.sin(la) * 0.7];

  device.beginFrame();
  device.pass({ target: "screen", clear: [0.07, 0.09, 0.13, 1] }, (p) => {
    p.draw(shader, {
      count: 3,
      textures: { nodeTex },
      uniforms: {
        uCamPos: cam.pos, uCamRight: cam.right, uCamUp: cam.up, uCamFwd: cam.fwd,
        uLightDir: lightDir, uKeyColor: KEY, uFillColor: FILL,
        uBgTop: BG_TOP, uBgBot: BG_BOT,
        uFloorY: floorY, uCount: nodeCount, uStage: config.stage,
        uSelected: config.selected, uTime: time, uShadow: config.shadow,
        uGround: config.ground,
      },
    });
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
  nodeTex?.destroy(); nodeTex = null;
  shader = null;
  if (device) { device.destroy(); device = null; }
}

export { init, render, destroy, setConfig, config };
