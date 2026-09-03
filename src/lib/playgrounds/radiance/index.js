// Radiance Cascades (2D) playground. The cascade builder is expressed as
// fragment-shader "compute" passes (one texel per probe×ray) rendered into
// RGBA16F targets, so the same WGSL + engine abstraction runs on WebGPU and
// WebGL2 (no compute shaders / storage textures required).
//
// Resources:
//   sceneTex   rgba8   painted emission (rgb) + occlusion (a), uploaded on paint
//   lightTex   rgba8   moving-light accumulation buffer, cleared each frame
//   cascadeTex rgba16f one target per cascade level, coarse -> fine
import { createPlayground } from "$lib/engine/index.js";
import CASCADE from "./shaders/cascade.wgsl?shader";
import COMPOSITE from "./shaders/composite.wgsl?shader";
import LIGHTS from "./shaders/lights.wgsl?shader";

const MAX_LIGHTS = 4096;
const LIGHT_FLOATS = 6; // pos.xy, radius, color.rgb

const config = {
  // brush / scene
  color: "#ff6633",
  brushSize: 12,
  intensity: 6,
  brush: "wall", // "wall" | "light" | "moving-light"
  // cascade algorithm
  baseRays: 4,
  branching: 2,
  probeSpacing0: 4,
  baseInterval: 6,
  stepsPerRay: 24,
  bilinearFix: true,
  cascadeCount: 0, // 0 = auto-fit to screen
  // display
  exposure: 1,
  probeOverlay: false,
};

let device = null;
let canvas = null;
let W = 0,
  H = 0;

// size-dependent scene resources
let sceneMirror = null; // Uint8ClampedArray W*H*4, the CPU-side paint target
let sceneTex = null;
let lightTex = null;

// cascade resources (rebuilt on resize / grid-shape changes)
let cascadeTexs = [];
let cascadeDims = [];
let dummyTex = null;

let cascadeShader = null,
  compositeShader = null,
  lightsShader = null;
let lightsBuffer = null;
let lightsData = new Float32Array(MAX_LIGHTS * LIGHT_FLOATS);

const bouncingLights = [];
let isDrawing = false;
let paintCount = 0;
let lastSceneKey = "";
let lastBuildKey = "";

// fps / stats
let fps = 0,
  frameCount = 0,
  lastFpsTime = 0;

const hexToBytes = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const hexToRGB01 = (hex) => hexToBytes(hex).map((v) => v / 255);

// Random vivid color (HSV with full saturation/value converted to RGB).
function randomColor01() {
  const hue = Math.random();
  const i = Math.floor(hue * 6);
  const f = hue * 6 - i;
  const q = 1 - f;
  switch (i % 6) {
    case 0:
      return [1, f, 0];
    case 1:
      return [q, 1, 0];
    case 2:
      return [0, 1, f];
    case 3:
      return [0, q, 1];
    case 4:
      return [f, 0, 1];
    default:
      return [1, 0, q];
  }
}

function neededCascadeCount(w, h) {
  const diag = Math.hypot(w, h);
  const base = Math.max(2, config.branching);
  return Math.min(
    12,
    Math.max(
      4,
      Math.ceil(Math.log(diag / config.baseInterval) / Math.log(base)) + 1,
    ),
  );
}
function effectiveCascadeCount(w, h) {
  return config.cascadeCount > 0
    ? config.cascadeCount
    : neededCascadeCount(w, h);
}
function cascadeSpacing(i) {
  return config.probeSpacing0 * 2 ** i;
}
function cascadeRays(i) {
  return config.baseRays * config.branching ** i;
}
function cascadeIntervalLo(i) {
  return i > 0 ? config.baseInterval * config.branching ** (i - 1) : 0;
}
function cascadeIntervalHi(i) {
  return config.baseInterval * config.branching ** i;
}
function sceneKey(w, h) {
  return w + "x" + h;
}
function buildKey(w, h) {
  return [
    w,
    h,
    config.baseRays,
    config.branching,
    config.probeSpacing0,
    effectiveCascadeCount(w, h),
  ].join("|");
}

function setConfig(patch) {
  Object.assign(config, patch);
}

function getStats() {
  return {
    fps,
    cascades: cascadeDims.length,
    emissive: paintCount,
    lights: bouncingLights.length,
    error: null,
  };
}

// ---- painting ------------------------------------------------------------

function stampCircle(buffer, cx, cy, radius, rgb, alpha) {
  const [r, g, b] = rgb;
  const x0 = Math.max(0, Math.floor(cx - radius)),
    y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(W, Math.ceil(cx + radius)),
    y1 = Math.min(H, Math.ceil(cy + radius));
  const w = x1 - x0,
    h = y1 - y0;
  if (w <= 0 || h <= 0) return { x0, y0, w: 0, h: 0 };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x0 + x - cx,
        dy = y0 + y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const idx = ((y0 + y) * W + (x0 + x)) * 4;
      buffer[idx] = Math.min(255, r);
      buffer[idx + 1] = Math.min(255, g);
      buffer[idx + 2] = Math.min(255, b);
      buffer[idx + 3] = alpha;
    }
  }
  return { x0, y0, w, h };
}

function stampRect(buffer, x, y, w, h, rgb, alpha) {
  const [r, g, b] = rgb;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  if (x1 <= x0 || y1 <= y0) return;
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const idx = (yy * W + xx) * 4;
      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = alpha;
    }
  }
}

function paintDab(cx, cy) {
  if (!sceneMirror || !sceneTex) return;
  const radius = config.brushSize;
  const intensity = config.intensity / 6;
  const [r, g, b] = hexToBytes(config.color);
  // Emission (rgb) and occlusion (a) are independent: a wall is dark and
  // fully opaque (matching the default scene's occluders), a light is bright
  // and transparent.
  const isWall = config.brush === "wall";
  const rgb = isWall
    ? [0, 0, 0]
    : [r * intensity, g * intensity, b * intensity];
  const alpha = isWall ? 255 : 0;
  const { x0, y0, w, h } = stampCircle(sceneMirror, cx, cy, radius, rgb, alpha);
  if (w <= 0 || h <= 0) return;
  if (!isWall) paintCount += w * h;

  // upload only the touched rect, not the whole canvas
  const rectBuf = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const srcOff = ((y0 + y) * W + x0) * 4;
    rectBuf.set(sceneMirror.subarray(srcOff, srcOff + w * 4), y * w * 4);
  }
  sceneTex.writeSub(rectBuf, x0, y0, w, h);
}

function spawnBouncingLight(cx, cy) {
  const radius = config.brushSize;
  const intensity = config.intensity / 6;
  const [r, g, b] = hexToRGB01(config.color);
  const speed = 120 + Math.random() * 180;
  const angle = Math.random() * 2 * Math.PI;
  bouncingLights.push({
    x: cx,
    y: cy,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    rgb: [r * intensity, g * intensity, b * intensity],
  });
}

function spawnRandomLights(count = 100) {
  if (W <= 0 || H <= 0) return;
  const remaining = MAX_LIGHTS - bouncingLights.length;
  if (remaining <= 0) return;
  const n = Math.min(count, remaining);
  for (let i = 0; i < n; i++) {
    const radius = 3 + Math.random() * 30;
    const speed = 60 + Math.random() * 200;
    const angle = Math.random() * 2 * Math.PI;
    bouncingLights.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      rgb: randomColor01(),
    });
  }
}

function updateBouncingLights(dt) {
  for (const l of bouncingLights) {
    l.x += l.vx * dt;
    l.y += l.vy * dt;
    if (l.x - l.radius < 0) {
      l.x = l.radius;
      l.vx = Math.abs(l.vx);
    } else if (l.x + l.radius > W) {
      l.x = W - l.radius;
      l.vx = -Math.abs(l.vx);
    }
    if (l.y - l.radius < 0) {
      l.y = l.radius;
      l.vy = Math.abs(l.vy);
    } else if (l.y + l.radius > H) {
      l.y = H - l.radius;
      l.vy = -Math.abs(l.vy);
    }
  }
}

function clear() {
  paintCount = 0;
  bouncingLights.length = 0;
  if (!sceneMirror || !sceneTex) return;
  sceneMirror.fill(0);
  sceneTex.write(sceneMirror);
}

// Load the default demo scene: a single light in the center and four short
// occluder bars around it, one in front of each canvas side, so the cascades
// cast four distinct shadows outward.
function loadDefaultScene() {
  if (!sceneMirror || !sceneTex || W <= 0 || H <= 0) return;

  sceneMirror.fill(0);
  bouncingLights.length = 0;
  paintCount = 0;

  const cx = W / 2,
    cy = H / 2;
  const lightRadius = Math.max(10, Math.min(30, Math.min(W, H) * 0.06));
  const gap = lightRadius * 2.2;
  const barLen = lightRadius * 2.8;
  const barThick = Math.max(6, Math.round(lightRadius * 0.4));
  const occluder = [0, 0, 0];

  // central light: bright emissive and transparent (it does not occlude)
  stampCircle(sceneMirror, cx, cy, lightRadius, [255, 205, 140], 0);
  paintCount += Math.round(Math.PI * lightRadius * lightRadius);

  // four short bars, each blocking the light toward one side of the canvas
  stampRect(
    sceneMirror,
    cx - barLen / 2,
    cy - gap - barThick / 2,
    barLen,
    barThick,
    occluder,
    255,
  ); // top
  stampRect(
    sceneMirror,
    cx - barLen / 2,
    cy + gap - barThick / 2,
    barLen,
    barThick,
    occluder,
    255,
  ); // bottom
  stampRect(
    sceneMirror,
    cx - gap - barThick / 2,
    cy - barLen / 2,
    barThick,
    barLen,
    occluder,
    255,
  ); // left
  stampRect(
    sceneMirror,
    cx + gap - barThick / 2,
    cy - barLen / 2,
    barThick,
    barLen,
    occluder,
    255,
  ); // right

  sceneTex.write(sceneMirror);
}

// ---- pointer -------------------------------------------------------------

const canvasCoords = (e) => {
  const rect = canvas.getBoundingClientRect();
  return [
    (e.clientX - rect.left) * (canvas.width / rect.width),
    (e.clientY - rect.top) * (canvas.height / rect.height),
  ];
};

function onPointerDown(e) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  try {
    canvas.setPointerCapture?.(e.pointerId);
  } catch {
    /* ignore */
  }
  const [x, y] = canvasCoords(e);
  if (config.brush === "moving-light") spawnBouncingLight(x, y);
  else {
    isDrawing = true;
    paintDab(x, y);
  }
}
function onPointerMove(e) {
  if (isDrawing && config.brush !== "moving-light")
    paintDab(...canvasCoords(e));
}
function onPointerUp() {
  isDrawing = false;
}

// ---- resource lifecycle --------------------------------------------------

function cascadeParams(cascadeIdx, cascadeCnt) {
  const d = cascadeDims[cascadeIdx];
  return {
    sceneSize: [W, H],
    spacing: d.spacing,
    rays: d.rays,
    intervalLo: d.intervalLo,
    intervalHi: d.intervalHi,
    stepsPerRay: config.stepsPerRay,
    branching: config.branching,
    hasCoarser: cascadeIdx < cascadeCnt - 1 ? 1 : 0,
    bilinearFix: config.bilinearFix ? 1 : 0,
  };
}
function compositeParams(cascadeCnt) {
  return {
    sceneSize: [W, H],
    probeSpacing0: config.probeSpacing0,
    raysBase: config.baseRays,
    cascadeCnt,
    exposure: config.exposure,
    probeOverlay: config.probeOverlay ? 1 : 0,
  };
}

// scene resources: the painted emission/occlusion layer and the moving-light
// accumulation buffer. These only depend on screen size.
// nearest-neighbour resample of the painted scene buffer so a canvas resize
// (e.g. collapsing the control panel) keeps the artwork instead of going black.
function resampleScene(src, sw, sh, dw, dh) {
  const dst = new Uint8ClampedArray(dw * dh * 4);
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return dst;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, ((y * sh) / dh) | 0);
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, ((x * sw) / dw) | 0);
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }
  return dst;
}

function rebuildScene(w, h) {
  const pw = W,
    ph = H;
  const prev = sceneMirror;
  const scaleX = pw > 0 ? w / pw : 1;
  const scaleY = ph > 0 ? h / ph : 1;

  sceneTex?.destroy();
  sceneTex = null;
  lightTex?.destroy();
  lightTex = null;

  W = w;
  H = h;
  sceneMirror =
    prev && pw > 0 && ph > 0
      ? resampleScene(prev, pw, ph, w, h)
      : new Uint8ClampedArray(w * h * 4);

  // keep bouncing embers in the same relative spots after a resize
  if (pw > 0 && ph > 0) {
    const s = Math.min(scaleX, scaleY);
    for (const l of bouncingLights) {
      l.x *= scaleX;
      l.y *= scaleY;
      l.radius = Math.max(1, l.radius * s);
    }
  }

  isDrawing = false;
  // recompute the emissive-pixel stat from the resampled buffer
  paintCount = 0;
  for (let i = 0; i < sceneMirror.length; i += 4) {
    if (
      sceneMirror[i + 3] === 0 &&
      (sceneMirror[i] || sceneMirror[i + 1] || sceneMirror[i + 2])
    )
      paintCount++;
  }

  sceneTex = device.texture({
    width: W,
    height: H,
    format: "rgba8",
    data: sceneMirror,
  });
  lightTex = device.texture({ width: W, height: H, format: "rgba8" });
  lastSceneKey = sceneKey(W, H);
}

// cascade resources: depend on grid shape (rays/branching/spacing/levels) and
// screen size. Rebuilt when either changes, without touching the painted scene.
function rebuildCascades(w, h) {
  W = w;
  H = h;
  for (const t of cascadeTexs) t.destroy();
  cascadeTexs = [];
  dummyTex?.destroy();
  dummyTex = null;

  const count = effectiveCascadeCount(W, H);
  cascadeDims = [];
  for (let i = 0; i < count; i++) {
    const spacing = cascadeSpacing(i);
    const probesX = Math.ceil(W / spacing),
      probesY = Math.ceil(H / spacing);
    const rays = cascadeRays(i);
    cascadeDims.push({
      width: Math.max(1, probesX * rays),
      height: Math.max(1, probesY),
      probesX,
      probesY,
      rays,
      spacing,
      intervalLo: cascadeIntervalLo(i),
      intervalHi: cascadeIntervalHi(i),
    });
  }
  cascadeTexs = cascadeDims.map((d) =>
    device.texture({
      width: d.width,
      height: d.height,
      format: "rgba16f",
      filter: "nearest",
    }),
  );
  dummyTex = device.texture({
    width: 1,
    height: 1,
    format: "rgba16f",
    filter: "nearest",
  });
  lastBuildKey = buildKey(W, H);
}

// ---- lifecycle -----------------------------------------------------------

const { init, render, destroy } = createPlayground({
  device: { msaa: false }, // fullscreen passes; no engine MSAA resolve target

  init({ device: dev, canvas: canvasEl }) {
    device = dev;
    canvas = canvasEl;

    cascadeShader = device.program(CASCADE, { blend: "none", topology: "tri" });
    compositeShader = device.program(COMPOSITE, {
      blend: "none",
      topology: "tri",
    });
    lightsShader = device.program(LIGHTS, {
      blend: "additive",
      topology: "tri",
      layout: {
        instance: { inputs: ["lPos", "lRadius", "lColor"], step: "instance" },
      },
    });
    lightsBuffer = device.buffer({
      kind: "vertex",
      size: MAX_LIGHTS * LIGHT_FLOATS * 4,
      dynamic: true,
    });

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    rebuildScene(canvas.width, canvas.height);
    rebuildCascades(canvas.width, canvas.height);
    loadDefaultScene();
    lastFpsTime = performance.now();
  },

  frame(dt) {
    const w = canvas.width,
      h = canvas.height;
    if (w <= 0 || h <= 0) return;
    if (sceneKey(w, h) !== lastSceneKey) rebuildScene(w, h);
    if (buildKey(w, h) !== lastBuildKey) rebuildCascades(w, h);

    updateBouncingLights(dt);

    const n = Math.min(bouncingLights.length, MAX_LIGHTS);
    for (let i = 0; i < n; i++) {
      const l = bouncingLights[i];
      const o = i * LIGHT_FLOATS;
      lightsData[o] = l.x;
      lightsData[o + 1] = l.y;
      lightsData[o + 2] = l.radius;
      lightsData[o + 3] = l.rgb[0];
      lightsData[o + 4] = l.rgb[1];
      lightsData[o + 5] = l.rgb[2];
    }
    if (n > 0) lightsBuffer.write(lightsData.subarray(0, n * LIGHT_FLOATS));

    // moving lights -> lightTex (cleared each frame, additive accumulation)
    device.render({ target: lightTex, clear: { color: [0, 0, 0, 0] } }, (p) => {
      if (n > 0) {
        p.draw(lightsShader, {
          buffers: { instance: lightsBuffer },
          count: 6,
          instances: n,
          uniforms: { dims: [W, H], pad0: 0, pad1: 0 },
        });
      }
    });

    // cascade levels, coarse -> fine (each reads the coarser cascade above it)
    const count = cascadeDims.length;
    for (let i = count - 1; i >= 0; i--) {
      const cascadeIn = i < count - 1 ? cascadeTexs[i + 1] : dummyTex;
      device.render(
        { target: cascadeTexs[i], clear: { color: [0, 0, 0, 0] } },
        (p) => {
          p.draw(cascadeShader, {
            count: 6,
            uniforms: cascadeParams(i, count),
            bindings: { sceneTex, lightTex, cascadeIn },
          });
        },
      );
    }

    // upsample finest cascade + painted scene -> screen
    device.render({ clear: { color: [0, 0, 0, 1] } }, (p) => {
      p.draw(compositeShader, {
        count: 6,
        uniforms: compositeParams(count),
        bindings: { sceneTex, cascade0: cascadeTexs[0], lightTex },
      });
    });

    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 500) {
      fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
      frameCount = 0;
      lastFpsTime = now;
    }
  },

  destroy() {
    canvas?.removeEventListener?.("pointerdown", onPointerDown);
    canvas?.removeEventListener?.("pointermove", onPointerMove);
    canvas?.removeEventListener?.("pointerup", onPointerUp);
    canvas?.removeEventListener?.("pointercancel", onPointerUp);

    sceneTex?.destroy();
    sceneTex = null;
    lightTex?.destroy();
    lightTex = null;
    for (const t of cascadeTexs) t.destroy();
    cascadeTexs = [];
    dummyTex?.destroy();
    dummyTex = null;
    lightsBuffer?.destroy();
    lightsBuffer = null;
    lightsData = new Float32Array(0);

    cascadeShader = compositeShader = lightsShader = null;
    device = canvas = null;
  },
});

export {
  init,
  render,
  destroy,
  setConfig,
  clear,
  loadDefaultScene,
  spawnRandomLights,
  getStats,
};
