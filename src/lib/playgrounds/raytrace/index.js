// RAY-TRACED MECH PLAYGROUND — GPU edition.
//
// Same mech model ({ items, shapes }) as the instanced raster playground, but
// rendered with a raster fullscreen tracer that works on WebGPU and WebGL2:
// analytic primitive intersection + a per-frame BVH, uploaded as DATA TEXTURES
// (rgba32f node refs/instances, rgba16f node boxes), traced `raycount`
// jittered rays per pixel per frame and accumulated
// into a ping-pong rgba16f render target (alpha = sample count; rgba16f keeps
// WebGL2 working with only EXT_color_buffer_half_float). A fullscreen
// composite pass divides by the sample count and applies exposure + filmic tone
// map + sRGB.
//
// Frame flow:
//   buildGpuScene(model, { materials, partKey })
//                          -> flat BVH/instance float arrays (per model/material change)
//   trace (raster)        -> `raycount` path-traced rays per pixel per frame
//                           (Lambertian direct lighting + metal/dielectric bounces)
//   accumulate in acc0/acc1 -> ping-pong rgba16f render targets
//   composite             -> upsamples the internal-res trace buffer to screen

import { createPlayground, createOrbit } from "$lib/engine/index.js";
import { buildGpuScene } from "$lib/raytrace/scene.js";
import TRACE from "./shaders/trace.wgsl?shader";
import COMPOSITE from "./shaders/composite.wgsl?shader";

const FOV = 45;
const TAN_HALF = Math.tan((FOV * Math.PI) / 360);
const MAX_SAMPLES = 128; // freeze the progressive refine once converged

const VIEW0 = { yaw: 0.7, pitch: 0.25, dist: 12 };

const config = {
  spin: 0.3, // auto-rotate yaw while not dragging (rad/s)
  light: 0.6, // light azimuth
  timeOfDay: 12, // 0..24 h — sun elevation + sky palette
  exposure: 1.4,
  quality: 0.6, // internal resolution scale (client pixels, dpr-independent)
  softness: 0.08, // area-light angular radius (rad) — width of the penumbra
  raycount: 1, // rays traced per pixel per frame (quality/speed)
};

let device = null,
  canvas = null,
  orbit = null;
let traceShader = null,
  compositeShader = null;
let bvhTex = null,
  bvhBoxTex = null,
  instTex = null;
let acc0 = null,
  acc1 = null,
  accPing = 0,
  accCurrent = null;

let model = null;
let materials = {};
let partKey = (group) => (group ? group.slice(0, group.indexOf(":")) : "");
let gpu = null; // { scene, bvhRefData, bvhBoxData, instData, root, nodeCount, n }
let lastSceneModel = null;
let lastMaterials = null;
let lookY = 0;
const view = { ...VIEW0 };

let W = 0,
  H = 0,
  samples = 0;
let needReset = true;
let lastSig = "";
let frameNo = 0; // never reset — advances the area-light sample

// stats
let fps = 0,
  frameCount = 0,
  lastFpsAt = 0;
let buildMs = 0,
  traceMs = 0;

function setConfig(patch) {
  if ("spin" in patch) config.spin = patch.spin;
  if ("light" in patch) config.light = patch.light;
  if ("timeOfDay" in patch) config.timeOfDay = patch.timeOfDay;
  if ("exposure" in patch) config.exposure = patch.exposure;
  if ("quality" in patch) config.quality = patch.quality;
  if ("softness" in patch) config.softness = patch.softness;
  if ("raycount" in patch) config.raycount = patch.raycount;
  if ("lookY" in patch) lookY = patch.lookY;
  if ("dist" in patch) view.dist = patch.dist;
  if (patch.resetView) {
    view.yaw = VIEW0.yaw;
    view.pitch = VIEW0.pitch;
    view.dist = patch.dist ?? VIEW0.dist;
  }
  if (orbit && ("dist" in patch || patch.resetView)) {
    orbit.yaw = view.yaw;
    orbit.pitch = view.pitch;
    orbit.dist = view.dist;
  }
  if (patch.model) model = patch.model;
  if (patch.materials) materials = patch.materials;
  if (patch.partKey) partKey = patch.partKey;
}

function getStats() {
  return {
    instances: gpu ? gpu.n : 0,
    nodes: gpu ? gpu.nodeCount : 0,
    buildMs,
    traceMs,
    fps,
    resolution: `${W}x${H}`,
    samples,
    raycount: config.raycount,
  };
}

// ---- time-of-day sky --------------------------------------------------------
// `timeOfDay` (0..24 h) drives the sun's elevation and the whole sky palette:
// cool moonlit navy at night, warm orange at dawn/dusk, neutral blue at noon.
// Keyframes interpolate linearly; the sun rides a solar arc capped at 70° and,
// below the horizon, the light hands off to a moon on the opposite side.
const DEG = Math.PI / 180;
const SUN_MAX_ELEV = 70 * DEG;

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const SKY_KEY = [
  { t: 0,  zenith: [0.02, 0.03, 0.08], horizon: [0.09, 0.10, 0.17], glow: [0.55, 0.58, 0.75], ambSky: [0.05, 0.055, 0.11], ambGround: [0.04, 0.04, 0.055], light: [0.30, 0.33, 0.45] },
  { t: 6,  zenith: [0.30, 0.24, 0.40], horizon: [1.05, 0.55, 0.25], glow: [2.20, 1.00, 0.40], ambSky: [0.60, 0.45, 0.42], ambGround: [0.28, 0.21, 0.15], light: [1.80, 1.05, 0.50] },
  { t: 12, zenith: [0.14, 0.20, 0.33], horizon: [0.52, 0.56, 0.66], glow: [1.50, 1.15, 0.70], ambSky: [0.55, 0.60, 0.72], ambGround: [0.28, 0.26, 0.24], light: [1.35, 1.25, 1.05] },
  { t: 18, zenith: [0.30, 0.24, 0.40], horizon: [1.05, 0.55, 0.25], glow: [2.20, 1.00, 0.40], ambSky: [0.60, 0.45, 0.42], ambGround: [0.28, 0.21, 0.15], light: [1.80, 1.05, 0.50] },
  { t: 24, zenith: [0.02, 0.03, 0.08], horizon: [0.09, 0.10, 0.17], glow: [0.55, 0.58, 0.75], ambSky: [0.05, 0.055, 0.11], ambGround: [0.04, 0.04, 0.055], light: [0.30, 0.33, 0.45] },
];

function skyPalette(tod) {
  const t = ((tod % 24) + 24) % 24;
  let a = SKY_KEY[0];
  let b = SKY_KEY[SKY_KEY.length - 1];
  for (let i = 0; i < SKY_KEY.length - 1; i++) {
    if (t >= SKY_KEY[i].t && t <= SKY_KEY[i + 1].t) {
      a = SKY_KEY[i];
      b = SKY_KEY[i + 1];
      break;
    }
  }
  const f = (t - a.t) / (b.t - a.t || 1);
  return {
    zenith: lerp3(a.zenith, b.zenith, f),
    horizon: lerp3(a.horizon, b.horizon, f),
    glow: lerp3(a.glow, b.glow, f),
    ambSky: lerp3(a.ambSky, b.ambSky, f),
    ambGround: lerp3(a.ambGround, b.ambGround, f),
    light: lerp3(a.light, b.light, f),
  };
}

// unit light direction at `tod` hours, `azimuth` rad. Below the horizon the sun
// hands off to a moon: same mirrored elevation, opposite azimuth.
function lightDirection(tod, azimuth) {
  const el = Math.sin(((tod - 6) / 12) * Math.PI) * SUN_MAX_ELEV;
  const y = Math.sin(el);
  const h = Math.cos(el);
  if (y >= 0) return [Math.cos(azimuth) * h, y, Math.sin(azimuth) * h];
  const maz = azimuth + Math.PI;
  return [Math.cos(maz) * h, -y, Math.sin(maz) * h];
}

const { init, render, destroy } = createPlayground({
  device: { msaa: false }, // fullscreen composite; no engine MSAA resolve target
  init({ device: dev, canvas: canvasEl }) {
    device = dev;
    canvas = canvasEl;
    orbit = createOrbit(canvas, { ...view, wheel: true });

    traceShader = device.program(TRACE, { blend: "none", topology: "tri" });
    compositeShader = device.program(COMPOSITE, {
      blend: "none",
      topology: "tri",
    });

    // BVH refs = 1 texel/node (rgba32f, exact ints), BVH boxes = 3 texels/node
    // (rgba16f, both children's bounds), instances = 8 texels/prim (rgba32f)
    bvhTex = device.texture({
      width: 1,
      height: 1,
      format: "rgba32f",
      filter: "nearest",
    });
    bvhBoxTex = device.texture({
      width: 3,
      height: 1,
      format: "rgba16f",
      filter: "nearest",
    });
    instTex = device.texture({
      width: 8,
      height: 1,
      format: "rgba32f",
      filter: "nearest",
    });
    acc0 = device.texture({
      width: 1,
      height: 1,
      format: "rgba16f",
      filter: "nearest",
    });
    acc1 = device.texture({
      width: 1,
      height: 1,
      format: "rgba16f",
      filter: "nearest",
    });
    accPing = 0;
    accCurrent = acc0;
    // initialize both accumulators (WebGPU rejects reads of uninitialized textures)
    device.render({ target: acc0, clear: { color: [0, 0, 0, 0] } }, () => {});
    device.render({ target: acc1, clear: { color: [0, 0, 0, 0] } }, () => {});

    // Start with a valid empty scene so the first frame(s) before the page
    // hands us a model still trace cleanly (sky + ground plane only).
    gpu = buildGpuScene(null, { materials, partKey });
    lastSceneModel = null;
    lastMaterials = materials;
    bvhTex.write(gpu.bvhRefData, 1, Math.max(1, gpu.nodeCount));
    bvhBoxTex.write(gpu.bvhBoxData, 3, Math.max(1, gpu.nodeCount));
    instTex.write(gpu.instData, 8, Math.max(1, gpu.n));

    lastFpsAt = performance.now();
  },
  frame(dt) {
    // turntable spin while the pointer is up (matches the raster renderer)
    if (!orbit.dragging) orbit.yaw += config.spin * dt * 0.5;
    // camera basis (pinhole), from the orbit state
    const cp = Math.cos(orbit.pitch);
    const ox = orbit.dist * cp * Math.sin(orbit.yaw);
    const oy = lookY + orbit.dist * Math.sin(orbit.pitch);
    const oz = orbit.dist * cp * Math.cos(orbit.yaw);
    let fx = -ox,
      fy = lookY - oy,
      fz = -oz;
    let fl = 1 / Math.hypot(fx, fy, fz);
    fx *= fl;
    fy *= fl;
    fz *= fl;
    let rx = -fz,
      ry = 0,
      rz = fx; // forward x up
    let rl = 1 / Math.hypot(rx, ry, rz);
    rx *= rl;
    ry *= rl;
    rz *= rl;
    const ux = ry * fz - rz * fy,
      uy = rz * fx - rx * fz,
      uz = rx * fy - ry * fx; // up = right x forward

    const cw = canvas.clientWidth || canvas.width;
    const chh = canvas.clientHeight || canvas.height;
    const aspect = cw / chh;

    // light: time-of-day sun/moon direction + sky palette keyed off the slider
    const pal = skyPalette(config.timeOfDay);
    const [lx, ly, lz] = lightDirection(config.timeOfDay, config.light);
    const ll = 1 / Math.hypot(lx, ly, lz);

    // rebuild the BVH only when the model actually changed (i.e. every frame
    // of an animation, and not at all while the figure holds still)
    const modelChanged = model !== lastSceneModel;
    const materialsChanged = materials !== lastMaterials;
    if (modelChanged || materialsChanged) {
      const t0 = performance.now();
      gpu = buildGpuScene(model, { materials, partKey });
      buildMs = performance.now() - t0;
      lastSceneModel = model;
      lastMaterials = materials;
      bvhTex.write(gpu.bvhRefData, 1, Math.max(1, gpu.nodeCount));
      bvhBoxTex.write(gpu.bvhBoxData, 3, Math.max(1, gpu.nodeCount));
      instTex.write(gpu.instData, 8, Math.max(1, gpu.n));
    }

    // internal trace resolution
    const scale = Math.max(0.1, Math.min(1, config.quality));
    const nw = Math.max(16, Math.round(cw * scale));
    const nh = Math.max(16, Math.round(chh * scale));
    if (nw !== W || nh !== H) {
      W = nw;
      H = nh;
      acc0?.destroy();
      acc1?.destroy();
      acc0 = device.texture({
        width: W,
        height: H,
        format: "rgba16f",
        filter: "nearest",
      });
      acc1 = device.texture({
        width: W,
        height: H,
        format: "rgba16f",
        filter: "nearest",
      });
      accPing = 0;
      accCurrent = acc0;
      samples = 0;
      needReset = true;
      device.render({ target: acc0, clear: { color: [0, 0, 0, 0] } }, () => {});
      device.render({ target: acc1, clear: { color: [0, 0, 0, 0] } }, () => {});
    }

    // reset accumulation whenever the IMAGE would change: model, camera, or
    // any image-affecting config. Exposure is post-process only, so it stays
    // live without a re-trace.
    const sig =
      orbit.yaw.toFixed(3) +
      "|" +
      orbit.pitch.toFixed(3) +
      "|" +
      orbit.dist.toFixed(3) +
      "|" +
      lookY.toFixed(3) +
      "|" +
      config.light.toFixed(3) +
      "|" +
      config.timeOfDay.toFixed(3) +
      "|" +
      config.softness.toFixed(4) +
      "|" +
      config.quality.toFixed(3);
    if (modelChanged || materialsChanged || sig !== lastSig) {
      lastSig = sig;
      samples = 0;
      needReset = true;
    }

    const t0 = performance.now();
    const rays = Math.min(Math.max(1, config.raycount), MAX_SAMPLES - samples);
    if (rays > 0) {
      const readTex = accPing === 0 ? acc0 : acc1;
      const writeTex = accPing === 0 ? acc1 : acc0;
      // accumulate `rays` samples per pixel into the ping-pong target; the
      // clear is a safety net — the fullscreen pass overwrites every texel
      device.render(
        { target: writeTex, clear: { color: [0, 0, 0, 0] } },
        (p) => {
          p.draw(traceShader, {
            count: 6,
            uniforms: {
              camOrigin: [ox, oy, oz],
              camFwd: [fx, fy, fz],
              camRight: [rx, ry, rz],
              camUp: [ux, uy, uz],
              lightDir: [lx * ll, ly * ll, lz * ll],
              lightColor: pal.light,
              zenith: pal.zenith,
              horizon: pal.horizon,
              sunGlow: pal.glow,
              ambSky: pal.ambSky,
              ambGround: pal.ambGround,
              tanHalf: TAN_HALF,
              aspect,
              softness: config.softness,
              reset: needReset ? 1 : 0,
              raycount: rays,
              sampleBase: samples + 1,
              frameNo,
              width: W,
              height: H,
              root: gpu.root,
            },
            bindings: { bvhTex, bvhBoxTex, instTex, accPrev: readTex },
          });
        },
      );
      traceMs = performance.now() - t0;
      accPing = 1 - accPing;
      accCurrent = writeTex;
      samples += rays;
      needReset = false;
    } else {
      traceMs = 0;
    }
    frameNo++;

    device.render({ clear: { color: [0, 0, 0, 1] } }, (p) => {
      p.draw(compositeShader, {
        count: 6,
        uniforms: { exposure: config.exposure },
        bindings: { accTex: accCurrent },
      });
    });

    frameCount++;
    const now = performance.now();
    if (now - lastFpsAt >= 500) {
      fps = Math.round((frameCount * 1000) / (now - lastFpsAt));
      frameCount = 0;
      lastFpsAt = now;
    }
  },
  destroy() {
    orbit?.detach();
    orbit = null;
    bvhTex?.destroy();
    bvhTex = null;
    bvhBoxTex?.destroy();
    bvhBoxTex = null;
    instTex?.destroy();
    instTex = null;
    acc0?.destroy();
    acc0 = null;
    acc1?.destroy();
    acc1 = null;
    accCurrent = null;
    accPing = 0;
    traceShader = compositeShader = null;
    gpu = null;
    lastSceneModel = null;
    lastMaterials = null;
    model = null;
    materials = {};
    device = canvas = null;
    // reset per-session accumulation/camera state so a re-init starts clean
    // (the canvas host can swap this renderer in more than once)
    W = 0;
    H = 0;
    samples = 0;
    needReset = true;
    lastSig = "";
    frameNo = 0;
    lookY = 0;
    view.yaw = VIEW0.yaw;
    view.pitch = VIEW0.pitch;
    view.dist = VIEW0.dist;
    fps = 0;
    frameCount = 0;
    buildMs = 0;
    traceMs = 0;
  },
});

export { init, render, destroy, setConfig, getStats };
