import { createPlayground } from "$lib/engine/index.js";
import WGSL from "./shaders/radiance.wgsl?raw";

const MAX_LIGHTS = 4096;
const PARAMS_FLOATS = 12; // Params struct: vec2 + 10 f32 = 48 bytes
const PARAMS_BYTES = PARAMS_FLOATS * 4;

const config = {
  // brush / scene
  color: "#ff6633",
  brushSize: 12,
  intensity: 6,
  occluder: true,
  movingLight: false,
  // cascade algorithm
  baseRays: 4,
  branching: 2,
  probeSpacing0: 4,
  baseInterval: 6,
  stepsPerRay: 24,
  cascadeCount: 0, // 0 = auto-fit to screen
  // display
  exposure: 1,
  probeOverlay: false,
};

let canvas = null;
let gpu = null;          // raw GPUDevice
let context = null;
let format = null;
let sampler = null;
let shaderModule = null;

// size-dependent scene resources (rebuilt on resize / cascade-shape changes)
let W = 0, H = 0;
let baseTexture = null, compositeTexture = null;
let sceneMirror = null;
let cascadeDims = [], cascadeTextures = [];
let dummyTex = null;
let computeBGL = null, computePipeline = null, computeBindGroups = [];
let renderBGL = null, renderPipeline = null, renderBindGroup = null;
let paramsBuffers = [], paramsBufferFinal = null;

// constant-sized light resources
let lightBGL = null, lightPipeline = null, lightGPUBuffer = null;
let lightCPUStage = new Float32Array(MAX_LIGHTS * 8);
let lightParamsBuffer = null, lightBindGroup = null;

const bouncingLights = [];
let isDrawing = false;
let paintCount = 0;
let lastBuildKey = "";
let error = null;

// fps / stats
let fps = 0, frameCount = 0, lastFpsTime = 0;

const hexToBytes = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

function neededCascadeCount(w, h) {
  const diag = Math.hypot(w, h);
  const base = Math.max(2, config.branching);
  return Math.min(12, Math.max(4, Math.ceil(Math.log(diag / config.baseInterval) / Math.log(base)) + 1));
}
function effectiveCascadeCount(w, h) {
  return config.cascadeCount > 0 ? config.cascadeCount : neededCascadeCount(w, h);
}
function buildKey(w, h) {
  return [w, h, config.baseRays, config.branching, config.probeSpacing0, effectiveCascadeCount(w, h)].join("|");
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
    error,
  };
}

// ---- painting ------------------------------------------------------------

function stampCircle(buffer, cx, cy, radius, rgb, alpha) {
  const [r, g, b] = rgb;
  const x0 = Math.max(0, Math.floor(cx - radius)), y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(W, Math.ceil(cx + radius)), y1 = Math.min(H, Math.ceil(cy + radius));
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return { x0, y0, w: 0, h: 0 };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x0 + x) - cx, dy = (y0 + y) - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const idx = ((y0 + y) * W + (x0 + x)) * 4;
      const falloff = 1.0 - Math.pow(dist / radius, 3.0);
      const a = alpha === "falloff" ? Math.min(255, Math.floor(200 * falloff + 55)) : alpha;
      buffer[idx] = Math.min(255, r);
      buffer[idx + 1] = Math.min(255, g);
      buffer[idx + 2] = Math.min(255, b);
      buffer[idx + 3] = a;
    }
  }
  return { x0, y0, w, h };
}

function paintDab(cx, cy) {
  if (!sceneMirror || !baseTexture || !gpu) return;
  const radius = config.brushSize;
  const intensity = config.intensity / 6;
  const [r, g, b] = hexToBytes(config.color);
  // Emission (rgb) and occlusion (a) are independent: an occluder is dark and
  // opaque, a light is bright and transparent.
  const rgb = config.occluder ? [0, 0, 0] : [r * intensity, g * intensity, b * intensity];
  const alpha = config.occluder ? "falloff" : 0;
  const { x0, y0, w, h } = stampCircle(sceneMirror, cx, cy, radius, rgb, alpha);
  if (w <= 0 || h <= 0) return;
  if (!config.occluder) paintCount += w * h;

  // upload only the touched rect, not the whole canvas
  const rectBuf = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const srcOff = ((y0 + y) * W + x0) * 4;
    rectBuf.set(sceneMirror.subarray(srcOff, srcOff + w * 4), y * w * 4);
  }
  gpu.queue.writeTexture(
    { texture: baseTexture, origin: { x: x0, y: y0 } },
    rectBuf,
    { bytesPerRow: w * 4, rowsPerImage: h },
    { width: w, height: h },
  );
}

function spawnBouncingLight(cx, cy) {
  const radius = config.brushSize;
  const intensity = config.intensity / 6;
  const [r, g, b] = hexToBytes(config.color);
  const speed = 120 + Math.random() * 180;
  const angle = Math.random() * 2 * Math.PI;
  bouncingLights.push({
    x: cx, y: cy,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    rgb: [r * intensity, g * intensity, b * intensity],
  });
}

function updateBouncingLights(dt) {
  for (const l of bouncingLights) {
    l.x += l.vx * dt;
    l.y += l.vy * dt;
    if (l.x - l.radius < 0) { l.x = l.radius; l.vx = Math.abs(l.vx); }
    else if (l.x + l.radius > W) { l.x = W - l.radius; l.vx = -Math.abs(l.vx); }
    if (l.y - l.radius < 0) { l.y = l.radius; l.vy = Math.abs(l.vy); }
    else if (l.y + l.radius > H) { l.y = H - l.radius; l.vy = -Math.abs(l.vy); }
  }
}

function clear() {
  if (!sceneMirror || !gpu || !baseTexture) { paintCount = 0; bouncingLights.length = 0; return; }
  sceneMirror.fill(0);
  gpu.queue.writeTexture({ texture: baseTexture }, sceneMirror, { bytesPerRow: W * 4, rowsPerImage: H }, { width: W, height: H });
  bouncingLights.length = 0;
  paintCount = 0;
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
  try { canvas.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
  const [x, y] = canvasCoords(e);
  if (config.movingLight) spawnBouncingLight(x, y);
  else { isDrawing = true; paintDab(x, y); }
}
function onPointerMove(e) {
  if (isDrawing && !config.movingLight) paintDab(...canvasCoords(e));
}
function onPointerUp() { isDrawing = false; }

// ---- resource lifecycle --------------------------------------------------

function writeParams(buffer, values) {
  gpu.queue.writeBuffer(buffer, 0, new Float32Array(values));
}
function paramsFor(cascadeIdx, count) {
  return [
    W, H,
    cascadeIdx, count,
    config.baseRays, config.branching,
    config.baseInterval, config.probeSpacing0,
    config.stepsPerRay, config.exposure,
    config.probeOverlay ? 1 : 0, 0,
  ];
}

function destroySizeResources() {
  baseTexture?.destroy(); baseTexture = null;
  compositeTexture?.destroy(); compositeTexture = null;
  for (const t of cascadeTextures) t.destroy();
  cascadeTextures = [];
  dummyTex?.destroy(); dummyTex = null;
  lightParamsBuffer?.destroy(); lightParamsBuffer = null;
  for (const b of paramsBuffers) b.destroy();
  paramsBuffers = [];
  paramsBufferFinal?.destroy(); paramsBufferFinal = null;
  computeBindGroups = [];
  renderBindGroup = null;
  lightBindGroup = null;
}

function rebuild(w, h) {
  W = w; H = h;
  destroySizeResources();

  sceneMirror = new Uint8ClampedArray(W * H * 4);
  bouncingLights.length = 0;
  paintCount = 0;
  isDrawing = false;

  baseTexture = gpu.createTexture({
    size: [W, H], format: "rgba8unorm",
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
  });
  compositeTexture = gpu.createTexture({
    size: [W, H], format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  gpu.queue.writeTexture({ texture: baseTexture }, sceneMirror, { bytesPerRow: W * 4, rowsPerImage: H }, { width: W, height: H });

  const count = effectiveCascadeCount(W, H);
  cascadeDims = [];
  for (let i = 0; i < count; i++) {
    const spacing = config.probeSpacing0 * 2 ** i;
    const probesX = Math.ceil(W / spacing), probesY = Math.ceil(H / spacing);
    const rays = config.baseRays * config.branching ** i;
    cascadeDims.push({ width: Math.max(1, probesX * rays), height: Math.max(1, probesY), probesX, probesY, rays, spacing });
  }
  cascadeTextures = cascadeDims.map((d) => gpu.createTexture({
    size: [d.width, d.height], format: "rgba16float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
  }));
  dummyTex = gpu.createTexture({
    size: [1, 1], format: "rgba16float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
  });

  paramsBuffers = cascadeDims.map(() => gpu.createBuffer({ size: PARAMS_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
  paramsBufferFinal = gpu.createBuffer({ size: PARAMS_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

  computeBindGroups = cascadeDims.map((_, i) => gpu.createBindGroup({
    layout: computeBGL,
    entries: [
      { binding: 0, resource: { buffer: paramsBuffers[i] } },
      { binding: 1, resource: compositeTexture.createView() },
      { binding: 2, resource: sampler },
      { binding: 3, resource: (i < count - 1 ? cascadeTextures[i + 1] : dummyTex).createView() },
      { binding: 4, resource: cascadeTextures[i].createView() },
    ],
  }));

  renderBindGroup = gpu.createBindGroup({
    layout: renderBGL,
    entries: [
      { binding: 0, resource: { buffer: paramsBufferFinal } },
      { binding: 1, resource: compositeTexture.createView() },
      { binding: 2, resource: sampler },
      { binding: 3, resource: cascadeTextures[0].createView() },
    ],
  });

  lightParamsBuffer = gpu.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  gpu.queue.writeBuffer(lightParamsBuffer, 0, new Float32Array([W, H, 0, 0]));
  lightBindGroup = gpu.createBindGroup({
    layout: lightBGL,
    entries: [
      { binding: 0, resource: { buffer: lightParamsBuffer } },
      { binding: 1, resource: { buffer: lightGPUBuffer } },
    ],
  });

  lastBuildKey = buildKey(W, H);
}

// ---- lifecycle -----------------------------------------------------------

const { init, render, destroy } = createPlayground({
  device: { msaa: false }, // we render our own fullscreen pass; no engine MSAA target
  init({ device, canvas: canvasEl }) {
    canvas = canvasEl;
    if (device.backend !== "webgpu" || !device.device) {
      error = "Radiance Cascades needs a WebGPU browser.";
      return;
    }
    gpu = device.device;
    format = navigator.gpu.getPreferredCanvasFormat();
    context = canvas.getContext("webgpu");
    sampler = gpu.createSampler({ magFilter: "linear", minFilter: "linear" });
    shaderModule = gpu.createShaderModule({ code: WGSL });

    computeBGL = gpu.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: {} },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, sampler: {} },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: {} },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rgba16float" } },
    ]});
    computePipeline = gpu.createComputePipeline({
      layout: gpu.createPipelineLayout({ bindGroupLayouts: [computeBGL] }),
      compute: { module: shaderModule, entryPoint: "buildCascade" },
    });

    renderBGL = gpu.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ]});
    renderPipeline = gpu.createRenderPipeline({
      layout: gpu.createPipelineLayout({ bindGroupLayouts: [renderBGL] }),
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: { module: shaderModule, entryPoint: "fsMain", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });

    lightBGL = gpu.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
    ]});
    lightPipeline = gpu.createRenderPipeline({
      layout: gpu.createPipelineLayout({ bindGroupLayouts: [lightBGL] }),
      vertex: { module: shaderModule, entryPoint: "vsLight" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsLight",
        targets: [{
          format: "rgba8unorm",
          // additive: bouncers add light without erasing painted occlusion below
          blend: {
            color: { srcFactor: "one", dstFactor: "one" },
            alpha: { srcFactor: "one", dstFactor: "one" },
          },
        }],
      },
      primitive: { topology: "triangle-list" },
    });
    lightGPUBuffer = gpu.createBuffer({
      size: MAX_LIGHTS * 2 * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    rebuild(canvas.width, canvas.height);
    lastFpsTime = performance.now();
  },

  frame(dt) {
    if (!gpu || error) return;
    const w = canvas.width, h = canvas.height;
    if (w <= 0 || h <= 0) return;
    if (w !== W || h !== H || buildKey(w, h) !== lastBuildKey) rebuild(w, h);

    updateBouncingLights(dt);

    const count = cascadeDims.length;
    for (let i = 0; i < count; i++) writeParams(paramsBuffers[i], paramsFor(i, count));
    writeParams(paramsBufferFinal, paramsFor(0, count));

    const n = Math.min(bouncingLights.length, MAX_LIGHTS);
    for (let i = 0; i < n; i++) {
      const l = bouncingLights[i];
      const o = i * 8;
      lightCPUStage[o] = l.x; lightCPUStage[o + 1] = l.y; lightCPUStage[o + 2] = l.radius; lightCPUStage[o + 3] = 0;
      lightCPUStage[o + 4] = l.rgb[0] / 255; lightCPUStage[o + 5] = l.rgb[1] / 255; lightCPUStage[o + 6] = l.rgb[2] / 255; lightCPUStage[o + 7] = 0;
    }
    if (n > 0) gpu.queue.writeBuffer(lightGPUBuffer, 0, lightCPUStage, 0, n * 8);

    const encoder = gpu.createCommandEncoder();
    encoder.copyTextureToTexture({ texture: baseTexture }, { texture: compositeTexture }, [W, H]);
    if (n > 0) {
      const lightPass = encoder.beginRenderPass({
        colorAttachments: [{ view: compositeTexture.createView(), loadOp: "load", storeOp: "store" }],
      });
      lightPass.setPipeline(lightPipeline);
      lightPass.setBindGroup(0, lightBindGroup);
      lightPass.draw(6, n);
      lightPass.end();
    }
    for (let i = count - 1; i >= 0; i--) {
      const pass = encoder.beginComputePass();
      pass.setPipeline(computePipeline);
      pass.setBindGroup(0, computeBindGroups[i]);
      const d = cascadeDims[i];
      pass.dispatchWorkgroups(Math.ceil(d.probesX * d.rays / 8), Math.ceil(d.probesY / 8), 1);
      pass.end();
    }
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store" }],
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, renderBindGroup);
    renderPass.draw(6);
    renderPass.end();
    gpu.queue.submit([encoder.finish()]);

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
    destroySizeResources();
    lightGPUBuffer?.destroy(); lightGPUBuffer = null;
    lightCPUStage = new Float32Array(0);
    shaderModule = computePipeline = renderPipeline = lightPipeline = null;
    computeBGL = renderBGL = lightBGL = null;
    gpu = context = canvas = null;
  },
});

export { init, render, destroy, setConfig, clear, getStats };
