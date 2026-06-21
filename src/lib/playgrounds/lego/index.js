import {
  createDevice, Camera, mat4, Vec3, Euler, DEG2RAD,
  animate, stagger, utils, eases,
} from "$lib/engine/index.js";
import { makeSolid } from "./solid.js";
import { resolveAssembly, validateAssembly } from "./assembly.js";
import { MODEL, PALETTE, VIEW } from "./eagle.js";
import LEGO_WGSL from "./shaders/lego.wgsl?raw";
import VERT from "./shaders/lego.vert.glsl?raw";
import FRAG from "./shaders/lego.frag.glsl?raw";
import GRID_WGSL from "./shaders/grid.wgsl?raw";
import GRID_VERT from "./shaders/grid.vert.glsl?raw";
import GRID_FRAG from "./shaders/grid.frag.glsl?raw";

const GROUND = { ext: 40, y: 0, step: 4, minorDiv: 4, opacity: 0.5, color: [0.45, 0.5, 0.58] };
const FALL = 7;          // drop-in height (world units)
const STEP = 110;        // ms between piece placements
const DUR = 600;         // ms per piece drop

const config = {
  spin: 0.0,
  explode: 0,
};

let canvas, device, shader, gridShader, camera, disposed = false;
let mode = "assemble";          // "assemble" | "inspect"
let inspect = null;
let inspectSpec = null;
let activeModel = MODEL;
let pieces = [];
let centroid = new Vec3(0, 0, 0);
let yaw = 0.6, pitch = 0.35;
let dragging = false, lastX = 0, lastY = 0;
let lastT = 0;
const light = new Vec3(30, 40, 30);
const _model = mat4.create();
const _vp = mat4.create();
const _pos = new Vec3();
const _scale = new Vec3(1, 1, 1);
const _rot = new Euler();

function colorRGB(hex) {
  if (typeof hex === "string") hex = parseInt(hex.replace("#", ""), 16);
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

function disposePieces() {
  for (const p of pieces) { p.posBuf?.destroy(); p.normBuf?.destroy(); }
  pieces = [];
}

function buildEagle(model = activeModel) {
  activeModel = model;
  utils.remove(pieces);
  disposePieces();
  const cache = new Map();
  const { pieces: placed, centroid: cen } = resolveAssembly(model);
  if (model.validate) {
    const rep = validateAssembly(model);
    if (!rep.ok) console.info("[lego] assembly report", rep);
  }
  pieces = placed.map((pl) => {
    const key = JSON.stringify(pl.spec);
    let geom = cache.get(key);
    if (!geom) {
      const g = makeSolid(pl.spec);
      geom = {
        posBuf: device.buffer({ kind: "vertex", data: g.attributes.position.array }),
        normBuf: device.buffer({ kind: "vertex", data: g.attributes.normal.array }),
        count: g.attributes.position.count,
      };
      cache.set(key, geom);
    }
    return {
      posBuf: geom.posBuf, normBuf: geom.normBuf, count: geom.count,
      color: colorRGB(PALETTE[pl.color] ?? pl.color),
      model: pl.model,           // world transform (column-major mat4)
      cx: pl.center[0], cy: pl.center[1], cz: pl.center[2],
      _p: 0,
    };
  });
  centroid.set(cen[0], cen[1], cen[2]);
}

function disposeInspect() {
  if (inspect) { inspect.posBuf?.destroy(); inspect.normBuf?.destroy(); inspect = null; }
}

// build one isolated, origin-centered piece from a live spec
function buildInspect(spec) {
  inspectSpec = spec;            // remember even if device not ready yet
  if (!device) return;
  disposeInspect();
  const g = makeSolid(spec);
  inspect = {
    posBuf: device.buffer({ kind: "vertex", data: g.attributes.position.array }),
    normBuf: device.buffer({ kind: "vertex", data: g.attributes.normal.array }),
    count: g.attributes.position.count,
    color: colorRGB(PALETTE[spec.color] ?? spec.color ?? "#cccccc"),
    rx: (spec.rx ?? 0) * DEG2RAD,
    ry: (spec.ry ?? 0) * DEG2RAD,
    rz: (spec.rz ?? 0) * DEG2RAD,
  };
}

function play() {
  utils.remove(pieces);
  for (const p of pieces) p._p = 0;
  animate(pieces, {
    _p: 1, duration: DUR, delay: stagger(STEP), ease: eases.outBounce,
  });
}

// manual scrub: reveal fraction of the build (last piece drops in partially)
function setProgress(frac) {
  utils.remove(pieces);
  const n = frac * pieces.length;
  pieces.forEach((p, i) => { p._p = Math.max(0, Math.min(1, n - i)); });
}

function setConfig(patch) {
  if ("spin" in patch) config.spin = patch.spin;
  if ("explode" in patch) config.explode = patch.explode;
  if ("mode" in patch) {
    mode = patch.mode;
    if (mode === "inspect") buildInspect(inspectSpec ?? Object.values(MODEL.parts)[0]);
  }
  if (patch.spec) buildInspect(patch.spec);
  if (patch.model) {                                              // live edit: show fully assembled
    try { buildEagle(patch.model); setProgress(1); }
    catch (e) { console.warn("[lego] invalid model", e); }
  }
  if ("progress" in patch && pieces.length) setProgress(patch.progress);
  if (patch.replay && pieces.length) play();
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
  pitch = Math.max(-1.2, Math.min(1.2, pitch + (y - lastY) * 0.01));
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
  camera = new Camera(45, w / h, 0.1, 2000);
  camera.up.set(0, 1, 0);
  camera._dist = VIEW.dist;
  buildEagle();
  play();
  if (mode === "inspect") buildInspect(inspectSpec ?? Object.values(MODEL.parts)[0]);
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
  if (!device || !shader) return;
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (!dragging) yaw += config.spin * dt * 0.4;

  syncSize();

  const inspecting = mode === "inspect" && inspect;
  const lookY = inspecting ? 0 : VIEW.lookY;
  const d = (inspecting ? 6 : camera._dist) || 15, cp = Math.cos(pitch);
  camera.position.set(
    d * cp * Math.sin(yaw),
    lookY + d * Math.sin(pitch),
    d * cp * Math.cos(yaw),
  );
  camera.lookAt(0, lookY, 0);
  camera.update();
  mat4.copy(_vp, device.correctViewProj(camera.viewProjMatrix));
  const eye = [camera.position.x, camera.position.y, camera.position.z];

  device.beginFrame();
  device.pass({ target: "screen", clear: [0.11, 0.11, 0.17, 1], depth: true, depthClear: 1 }, (p) => {
    if (inspecting) {
      _pos.set(0, 0, 0);
      _rot.set(inspect.rx, inspect.ry, inspect.rz);
      mat4.compose(_model, _pos, _rot, _scale);
      p.draw(shader, {
        buffers: [inspect.posBuf, inspect.normBuf],
        count: inspect.count,
        uniforms: {
          uViewProj: _vp, uModel: _model,
          uColor: inspect.color, uLightPos: [light.x, light.y, light.z], uViewPos: eye,
        },
      });
      return;
    }
    if (gridShader) {
      p.draw(gridShader, {
        count: 4,
        uniforms: {
          uViewProj: _vp, uExt: GROUND.ext, uY: GROUND.y, uStep: GROUND.step,
          uMinorDiv: GROUND.minorDiv, uOpacity: GROUND.opacity, uColor: GROUND.color,
        },
      });
    }
    const ex = config.explode;
    for (const pc of pieces) {
      if (pc._p <= 0) continue;                 // not yet placed
      const drop = (1 - pc._p) * FALL;
      // start from the piece's resolved world matrix, then offset translation
      // for the drop-in animation and explode view
      mat4.copy(_model, pc.model);
      _model[12] += (pc.cx - centroid.x) * ex;
      _model[13] += drop + (pc.cy - centroid.y) * ex;
      _model[14] += (pc.cz - centroid.z) * ex;
      p.draw(shader, {
        buffers: [pc.posBuf, pc.normBuf],
        count: pc.count,
        uniforms: {
          uViewProj: _vp, uModel: _model,
          uColor: pc.color, uLightPos: [light.x, light.y, light.z], uViewPos: eye,
        },
      });
    }
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
  utils.remove(pieces);
  disposeInspect();
  // pieces share cached buffers; destroy each unique buffer once
  const seen = new Set();
  for (const p of pieces) {
    if (seen.has(p.posBuf)) continue;
    seen.add(p.posBuf);
    p.posBuf?.destroy(); p.normBuf?.destroy();
  }
  pieces = [];
  shader = null;
  gridShader = null;
  if (device) { device.destroy(); device = null; }
}

export { init, render, destroy, setConfig, config };
