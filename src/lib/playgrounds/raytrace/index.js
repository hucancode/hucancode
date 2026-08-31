// RAY-TRACED MECH PLAYGROUND — GPU edition.
//
// Same mech model ({ items, shapes }) as the instanced raster playground, but
// rendered with a WebGPU compute tracer: analytic primitive intersection + a
// per-frame BVH, uploaded as storage buffers, traced one jittered sample per
// pixel per frame and accumulated into an rgba32f storage texture (alpha =
// sample count). A fullscreen composite pass divides by the sample count and
// applies exposure + filmic tone map + sRGB.
//
// Frame flow:
//   buildGpuScene(model, { materials, partKey })
//                          -> flat BVH/instance storage buffers (per model/material change)
//   trace compute         -> one path-traced sample per pixel per frame
//                           (Lambertian direct lighting + metal/dielectric bounces)
//   accumulate in acc0/acc1 -> ping-pong (rgba32f storage is write-only in WebGPU)
//   composite             -> upsamples the internal-res trace buffer to screen

import { createPlayground, createOrbit, F32, I32, VEC3 } from "$lib/engine/index.js";
import { buildGpuScene } from "$lib/raytrace/scene.js";
import TRACE from "./shaders/trace.wgsl?raw";
import COMPOSITE from "./shaders/composite.wgsl?raw";

const FOV = 45;
const TAN_HALF = Math.tan((FOV * Math.PI) / 360);
const MAX_SAMPLES = 64;   // freeze the progressive refine once converged
const WORKGROUP = 8;

const VIEW0 = { yaw: 0.7, pitch: 0.25, dist: 12 };

const config = {
  light: 0.6,      // light azimuth
  exposure: 1.4,
  quality: 0.6,    // internal resolution scale (client pixels, dpr-independent)
  softness: 0.08,  // area-light angular radius (rad) — width of the penumbra
};

let device = null, canvas = null, orbit = null;
let traceShader = null, compositeShader = null;
let bvhBuf = null, instBuf = null;
let acc0 = null, acc1 = null, accPing = 0, accCurrent = null;

let model = null;
let materials = {};
let partKey = (group) => (group ? group.slice(0, group.indexOf(":")) : "");
let gpu = null;             // { scene, bvhData, instData, root, nodeCount, n }
let lastSceneModel = null;
let lastMaterials = null;
let lookY = 0;
const view = { ...VIEW0 };

let W = 0, H = 0, samples = 0;
let needReset = true;
let lastSig = "";
let frameNo = 0;                  // never reset — advances the area-light sample

// stats
let fps = 0, frameCount = 0, lastFpsAt = 0;
let buildMs = 0, traceMs = 0;

function setConfig(patch) {
  if ("light" in patch) config.light = patch.light;
  if ("exposure" in patch) config.exposure = patch.exposure;
  if ("quality" in patch) config.quality = patch.quality;
  if ("softness" in patch) config.softness = patch.softness;
  if ("lookY" in patch) lookY = patch.lookY;
  if ("dist" in patch) view.dist = patch.dist;
  if (patch.resetView) {
    view.yaw = VIEW0.yaw; view.pitch = VIEW0.pitch; view.dist = patch.dist ?? VIEW0.dist;
  }
  if (orbit && ("dist" in patch || patch.resetView)) {
    orbit.yaw = view.yaw; orbit.pitch = view.pitch; orbit.dist = view.dist;
  }
  if (patch.model) model = patch.model;
  if (patch.materials) materials = patch.materials;
  if (patch.partKey) partKey = patch.partKey;
}

function halton(i, b) {
  let f = 1, r = 0;
  while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
  return r;
}

function getStats() {
  return {
    instances: gpu ? gpu.n : 0,
    nodes: gpu ? gpu.nodeCount : 0,
    buildMs, traceMs, fps,
    resolution: `${W}x${H}`,
    samples,
  };
}

const { init, render, destroy } = createPlayground({
  device: { msaa: false },  // fullscreen composite; no engine MSAA resolve target
  setConfig,
  init({ device: dev, canvas: canvasEl }) {
    device = dev;
    canvas = canvasEl;
    if (device.backend !== "webgpu") {
      throw new Error("the raytrace playground requires a WebGPU device");
    }
    orbit = createOrbit(canvas, { ...view, wheel: true });

    traceShader = device.computeShader({
      wgsl: TRACE,
      uniforms: [
        VEC3("camOrigin"), VEC3("camFwd"), VEC3("camRight"), VEC3("camUp"), VEC3("lightDir"),
        F32("tanHalf"), F32("aspect"), F32("softness"), F32("reset"), F32("jx"), F32("jy"),
        I32("frameNo"), I32("width"), I32("height"), I32("root"), I32("nodeCount"), I32("instanceCount"),
      ],
      storage: [
        { name: "bvh", binding: 1 },
        { name: "inst", binding: 2 },
      ],
      textures: [{ name: "accPrev", binding: 3 }],
      storageTextures: [{ name: "accNext", binding: 4 }],
    });
    compositeShader = device.shader({
      wgsl: COMPOSITE,
      uniforms: [F32("exposure")],
      textures: [{ name: "accTex", binding: 1 }],
      blend: "none", topology: "tri",
    });

    bvhBuf = device.buffer({ kind: "storage", size: 8 * 4, dynamic: true });
    instBuf = device.buffer({ kind: "storage", size: 32 * 4, dynamic: true });
    acc0 = device.texture({ width: 1, height: 1, format: "rgba32f", storage: true });
    acc1 = device.texture({ width: 1, height: 1, format: "rgba32f", storage: true });
    accPing = 0;
    accCurrent = acc0;

    // Start with a valid empty scene so the first frame(s) before the page
    // hands us a model still trace cleanly (sky + ground plane only).
    gpu = buildGpuScene(null, { materials, partKey });
    lastSceneModel = null;
    lastMaterials = materials;
    bvhBuf.write(gpu.bvhData);
    instBuf.write(gpu.instData);

    lastFpsAt = performance.now();
  },
  frame(dt) {
    // camera basis (pinhole), from the orbit state
    const cp = Math.cos(orbit.pitch);
    const ox = orbit.dist * cp * Math.sin(orbit.yaw);
    const oy = lookY + orbit.dist * Math.sin(orbit.pitch);
    const oz = orbit.dist * cp * Math.cos(orbit.yaw);
    let fx = -ox, fy = lookY - oy, fz = -oz;
    let fl = 1 / Math.hypot(fx, fy, fz); fx *= fl; fy *= fl; fz *= fl;
    let rx = -fz, ry = 0, rz = fx;                 // forward x up
    let rl = 1 / Math.hypot(rx, ry, rz); rx *= rl; ry *= rl; rz *= rl;
    const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx; // up = right x forward

    const cw = canvas.clientWidth || canvas.width;
    const chh = canvas.clientHeight || canvas.height;
    const aspect = cw / chh;

    // light: directional sun with an angular radius (area light)
    const la = config.light;
    const lx = Math.cos(la), ly = 1.3, lz = Math.sin(la);
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
      bvhBuf.write(gpu.bvhData);
      instBuf.write(gpu.instData);
    }

    // internal trace resolution
    const scale = Math.max(0.1, Math.min(1, config.quality));
    const nw = Math.max(16, Math.round(cw * scale));
    const nh = Math.max(16, Math.round(chh * scale));
    if (nw !== W || nh !== H) {
      W = nw; H = nh;
      acc0?.destroy();
      acc1?.destroy();
      acc0 = device.texture({ width: W, height: H, format: "rgba32f", storage: true });
      acc1 = device.texture({ width: W, height: H, format: "rgba32f", storage: true });
      accPing = 0;
      accCurrent = acc0;
      samples = 0;
      needReset = true;
    }

    // reset accumulation whenever the IMAGE would change: model, camera, or
    // any image-affecting config. Exposure is post-process only, so it stays
    // live without a re-trace.
    const sig = orbit.yaw.toFixed(3) + "|" + orbit.pitch.toFixed(3) + "|" + orbit.dist.toFixed(3) + "|" + lookY.toFixed(3)
      + "|" + config.light.toFixed(3) + "|" + config.softness.toFixed(4) + "|" + config.quality.toFixed(3);
    if (modelChanged || materialsChanged || sig !== lastSig) {
      lastSig = sig;
      samples = 0;
      needReset = true;
    }

    device.beginFrame();

    const t0 = performance.now();
    if (samples < MAX_SAMPLES) {
      const readTex = accPing === 0 ? acc0 : acc1;
      const writeTex = accPing === 0 ? acc1 : acc0;
      traceShader.dispatch(Math.ceil(W / WORKGROUP), Math.ceil(H / WORKGROUP), 1, {
        uniforms: {
          camOrigin: [ox, oy, oz],
          camFwd: [fx, fy, fz],
          camRight: [rx, ry, rz],
          camUp: [ux, uy, uz],
          lightDir: [lx * ll, ly * ll, lz * ll],
          tanHalf: TAN_HALF,
          aspect,
          softness: config.softness,
          reset: needReset ? 1 : 0,
          jx: halton(samples + 1, 2),
          jy: halton(samples + 1, 3),
          frameNo,
          width: W,
          height: H,
          root: gpu.root,
          nodeCount: gpu.nodeCount,
          instanceCount: gpu.n,
        },
        buffers: { bvh: bvhBuf, inst: instBuf },
        textures: { accPrev: readTex },
        storageTextures: { accNext: writeTex },
      });
      traceMs = performance.now() - t0;
      accPing = 1 - accPing;
      accCurrent = writeTex;
      samples++;
      needReset = false;
    } else {
      traceMs = 0;
    }
    frameNo++;

    device.pass({ clear: [0, 0, 0, 1] }, (p) => {
      p.draw(compositeShader, {
        count: 6,
        uniforms: { exposure: config.exposure },
        textures: { accTex: accCurrent },
      });
    });

    device.endFrame();

    frameCount++;
    const now = performance.now();
    if (now - lastFpsAt >= 500) {
      fps = Math.round((frameCount * 1000) / (now - lastFpsAt));
      frameCount = 0; lastFpsAt = now;
    }
  },
  destroy() {
    orbit?.detach(); orbit = null;
    bvhBuf?.destroy(); bvhBuf = null;
    instBuf?.destroy(); instBuf = null;
    acc0?.destroy(); acc0 = null;
    acc1?.destroy(); acc1 = null;
    accCurrent = null; accPing = 0;
    traceShader = compositeShader = null;
    gpu = null; lastSceneModel = null;
    lastMaterials = null;
    model = null;
    materials = {};
    device = canvas = null;
    // reset per-session accumulation/camera state so a re-init starts clean
    // (the canvas host can swap this renderer in more than once)
    W = 0; H = 0; samples = 0; needReset = true; lastSig = "";
    frameNo = 0; lookY = 0;
    view.yaw = VIEW0.yaw; view.pitch = VIEW0.pitch; view.dist = VIEW0.dist;
    fps = 0; frameCount = 0; buildMs = 0; traceMs = 0;
  },
});

export { init, render, destroy, setConfig, getStats };
