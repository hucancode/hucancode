// Screen pass is 4x MSAA + resolve (unless the device opted out). Per-shader
// uniform-buffer RING: one frame = single submit, so every draw sharing a
// shader needs its own uniform buffer (GPU reads them all at submit time);
// ring hands out a fresh slot per draw.

import * as mat4 from "../../math/mat4.js";
import { uniformLayout, packUniforms } from "./std140.js";

async function makeWebGPUContext(canvas) {
  if (typeof navigator === "undefined" || !navigator.gpu)
    throw new Error("WebGPU not available");
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("no WebGPU adapter");
  // Reject software adapters (CPU render slower than WebGL2 fallback).
  if (adapter.isFallbackAdapter) throw new Error("WebGPU adapter is software (fallback)");
  const info = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null);
  const sig = info ? `${info.vendor || ""} ${info.architecture || ""} ${info.device || ""} ${info.description || ""}`.toLowerCase() : "";
  if (/swiftshader|llvmpipe|lavapipe|softpipe|software|basic render|microsoft basic/.test(sig))
    throw new Error("WebGPU adapter is software: " + sig.trim());
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("WebGPU canvas context unavailable");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });
  return { device, context, format };
}

const BLEND = {
  premult: { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } },
  straight: { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } },
};
const TOPO = { tri: "triangle-list", "tri-strip": "triangle-strip", "line-strip": "line-strip", point: "point-list" };
const CULL = { back: "back", front: "front" }; // desc.cull; CCW = front face
const align = (n, a) => Math.ceil(n / a) * a;

// clip-space z remap: camera projection is GL convention (z in [-1, 1]); WebGPU
// clips to [0, 1], so uncorrected geometry gets near-plane clipped. R * viewProj
// maps z' = 0.5 z + 0.5 w. column-major
const Z_REMAP = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 1]);

export async function createWebGPUDevice(canvas, { msaa = true } = {}) {
  const gpu = await makeWebGPUContext(canvas);
  const device = gpu.device, context = gpu.context, format = gpu.format, queue = device.queue;
  const shaders = [];
  let encoder = null;
  let texCounter = 0; // stable id per live GPUTexture, for bind-group cache keys
  let W = canvas.width, H = canvas.height;
  let msaaTex, msaaView, depthTex, depthView;
  const vpScratch = mat4.create();

  function makeMSAA() {
    msaaTex?.destroy?.(); depthTex?.destroy?.();
    if (msaa) {
      msaaTex = device.createTexture({ size: [W, H], sampleCount: 4, format, usage: GPUTextureUsage.RENDER_ATTACHMENT });
      msaaView = msaaTex.createView();
    } else {
      msaaTex = null; msaaView = null;
    }
    depthTex = device.createTexture({ size: [W, H], sampleCount: msaa ? 4 : 1, format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT });
    depthView = depthTex.createView();
  }
  makeMSAA();

  function buffer({ kind = "vertex", data = null, size = 0, dynamic = false }) {
    const um = { vertex: GPUBufferUsage.VERTEX, index: GPUBufferUsage.INDEX, uniform: GPUBufferUsage.UNIFORM, storage: GPUBufferUsage.STORAGE };
    const usage = (um[kind] || GPUBufferUsage.VERTEX) | GPUBufferUsage.COPY_DST;
    let cap = align(data ? data.byteLength : size, 4);
    let buf = device.createBuffer({ size: Math.max(cap, 4), usage });
    if (data) queue.writeBuffer(buf, 0, data);
    return {
      get _buf() { return buf; },
      write(d, offset = 0) {
        if (offset === 0 && d.byteLength > cap) { buf.destroy(); cap = align(d.byteLength, 4); buf = device.createBuffer({ size: cap, usage }); }
        queue.writeBuffer(buf, offset, d);
      },
      destroy() { buf.destroy(); },
    };
  }

  function texture({ width, height, format: fmt = "rgba8", filter = "linear", data = null }) {
    const gfmt = fmt === "rgba32f" ? "rgba32float" : "rgba8unorm";
    const bpp = fmt === "rgba32f" ? 16 : 4;
    let w = width, h = height, tex, view, id;
    function alloc(nw, nh) {
      tex?.destroy?.();
      tex = device.createTexture({ size: [nw, nh], format: gfmt, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      view = tex.createView(); w = nw; h = nh; id = ++texCounter; // realloc -> new id invalidates cached bind groups
    }
    function upload(d, dw, dh) { if (dw !== w || dh !== h) alloc(dw, dh); queue.writeTexture({ texture: tex }, d, { bytesPerRow: w * bpp, rowsPerImage: h }, { width: w, height: h }); }
    alloc(width, height);
    if (data) upload(data, width, height);
    return {
      get _view() { return view; }, get _id() { return id; }, get width() { return w; }, get height() { return h; },
      write(d, dw = w, dh = h) { upload(d, dw, dh); },
      destroy() { tex.destroy(); },
    };
  }

  function shader(desc) {
    const mod = device.createShaderModule({ code: desc.wgsl });
    const vbuffers = (desc.buffers || []).map((b) => ({
      arrayStride: b.stride, stepMode: b.step === "instance" ? "instance" : "vertex",
      attributes: b.attributes.map((a) => ({ shaderLocation: a.location, offset: a.offset || 0, format: a.format })),
    }));
    const pdesc = {
      layout: "auto",
      vertex: { module: mod, entryPoint: "vs", buffers: vbuffers },
      fragment: { module: mod, entryPoint: "fs", targets: [{ format, blend: desc.blend ? BLEND[desc.blend] : undefined }] },
      primitive: { topology: TOPO[desc.topology || "tri"], frontFace: "ccw", cullMode: CULL[desc.cull] || "none" },
      multisample: { count: msaa ? 4 : 1 },
    };
    if (desc.depth) pdesc.depthStencil = { format: "depth24plus", depthWriteEnabled: desc.depth === "test", depthCompare: desc.depth === "test" ? "less-equal" : "always" };
    const pipeline = device.createRenderPipeline(pdesc);

    const ulayout = desc.uniforms && desc.uniforms.length ? uniformLayout(desc.uniforms) : null;
    const sh = {
      _pipeline: pipeline, desc,
      _bgl: pipeline.getBindGroupLayout(0), // resolved ONCE at load, not per draw
      _ulayout: ulayout,
      _scratch: ulayout ? new ArrayBuffer(ulayout.size) : null,
      _ubos: [], _ring: 0,
    };
    if (sh._scratch) { sh._view = new DataView(sh._scratch); sh._bytes = new Uint8Array(sh._scratch); }
    shaders.push(sh);
    return sh;
  }

  function nextUbo(sh) {
    if (sh._ring >= sh._ubos.length)
      sh._ubos.push({ buffer: device.createBuffer({ size: sh._ulayout.size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }), bgCache: new Map() });
    return sh._ubos[sh._ring++];
  }

  function drawImpl(rp, sh, args) {
    rp.setPipeline(sh._pipeline);
    const texList = sh.desc.textures || [];

    let holder, ubo = null;
    if (sh._ulayout) {
      const e = nextUbo(sh);
      sh._bytes.fill(0);
      packUniforms(sh._ulayout, args.uniforms || {}, sh._view);
      queue.writeBuffer(e.buffer, 0, sh._bytes);
      ubo = e.buffer; holder = e;
    } else {
      holder = sh._noUbo || (sh._noUbo = { bgCache: new Map() });
    }

    // Cache one bind group per texture-signature (only the bound texture set
    // varies) so steady-state draws create zero bind groups.
    let sig = "";
    for (const t of texList) { const tex = args.textures && args.textures[t.name]; sig += (tex ? tex._id : 0) + ":"; }
    let bg = holder.bgCache.get(sig);
    if (!bg) {
      const entries = [];
      if (ubo) entries.push({ binding: 0, resource: { buffer: ubo } });
      for (const t of texList) { const tex = args.textures && args.textures[t.name]; if (tex) entries.push({ binding: t.binding, resource: tex._view }); }
      bg = device.createBindGroup({ layout: sh._bgl, entries });
      holder.bgCache.set(sig, bg);
      if (holder.bgCache.size > 8) { const k = holder.bgCache.keys().next().value; holder.bgCache.delete(k); } // bound size (texture reallocs change ids)
    }
    rp.setBindGroup(0, bg);

    const buffers = args.buffers || [];
    for (let i = 0; i < buffers.length; i++) if (buffers[i]) rp.setVertexBuffer(i, buffers[i]._buf);
    if (args.index) { rp.setIndexBuffer(args.index._buf, "uint16"); rp.drawIndexed(args.count, args.instances || 1); }
    else rp.draw(args.count, args.instances || 1);
  }

  function pass(opts, fn) {
    const clear = opts.clear;
    const cv = clear ? { r: clear[0], g: clear[1], b: clear[2], a: clear[3] } : { r: 0, g: 0, b: 0, a: 1 };
    const loadOp = clear ? "clear" : "load";
    const view = context.getCurrentTexture().createView();
    const color = msaa
      ? { view: msaaView, resolveTarget: view, clearValue: cv, loadOp, storeOp: "discard" }
      : { view, clearValue: cv, loadOp, storeOp: "store" };
    const depth = opts.depth
      ? { view: depthView, depthClearValue: opts.depthClear ?? 1, depthLoadOp: "clear", depthStoreOp: "discard" }
      : undefined;
    const rp = encoder.beginRenderPass({ colorAttachments: [color], depthStencilAttachment: depth });
    fn({ draw: (sh, args) => drawImpl(rp, sh, args) });
    rp.end();
  }

  function correctViewProj(m) { mat4.multiply(vpScratch, Z_REMAP, m); return vpScratch; }

  return {
    backend: "webgpu", device,
    buffer, texture, shader, pass, correctViewProj,
    beginFrame() { encoder = device.createCommandEncoder(); for (const s of shaders) s._ring = 0; },
    endFrame() { if (encoder) { queue.submit([encoder.finish()]); encoder = null; } },
    resize(w, h) {
      // no-op on same size: callers may resize every frame; realloc only on change
      const nw = Math.max(1, w | 0), nh = Math.max(1, h | 0);
      if (nw === W && nh === H) return;
      W = nw; H = nh; makeMSAA();
    },
    destroy() { msaaTex?.destroy?.(); depthTex?.destroy?.(); device.destroy?.(); },
  };
}
