// WebGPU implementation of the backend-agnostic GPU device (see ./index.js).
// The screen pass is 4x MSAA + resolve, matching the antialiased default
// framebuffer the WebGL backend gets for free. Per-shader uniform-buffer RING:
// one frame is a single submit, so every draw that shares a shader needs its own
// uniform buffer (the GPU reads them all at submit time) — the ring hands out a
// fresh slot per draw and resets each frame.

import { makeWebGPUContext } from "../webgpu.js";
import { mat4 } from "../math.js";

const BLEND = {
  premult: { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } },
  accum: { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } },
  straight: { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } },
};
const TOPO = { tri: "triangle-list", "tri-strip": "triangle-strip", "line-strip": "line-strip", point: "point-list" };
const U_ALIGN = { f32: 4, i32: 4, vec2: 8, vec3: 16, vec4: 16, mat4: 16 };
const U_SIZE = { f32: 4, i32: 4, vec2: 8, vec3: 12, vec4: 16, mat4: 64 };
const align = (n, a) => Math.ceil(n / a) * a;

// std140-ish layout matching WGSL's uniform address space (vec3/vec4/mat4 align
// to 16). The WGSL uniform struct must declare the same fields in this order.
function uniformLayout(uniforms) {
  let off = 0;
  const fields = uniforms.map((u) => {
    off = align(off, U_ALIGN[u.type]);
    const f = { name: u.name, type: u.type, offset: off };
    off += U_SIZE[u.type];
    return f;
  });
  return { fields, size: Math.max(16, align(off, 16)) };
}
function packUniforms(layout, values, view) {
  for (const f of layout.fields) {
    const v = values[f.name];
    if (v == null) continue;
    const o = f.offset;
    switch (f.type) {
      case "f32": view.setFloat32(o, v, true); break;
      case "i32": view.setInt32(o, v | 0, true); break;
      case "vec2": view.setFloat32(o, v[0], true); view.setFloat32(o + 4, v[1], true); break;
      case "vec3": view.setFloat32(o, v[0], true); view.setFloat32(o + 4, v[1], true); view.setFloat32(o + 8, v[2], true); break;
      case "vec4": for (let i = 0; i < 4; i++) view.setFloat32(o + i * 4, v[i], true); break;
      case "mat4": for (let i = 0; i < 16; i++) view.setFloat32(o + i * 4, v[i], true); break;
    }
  }
}

// clip-space z remap: the camera's projection is GL convention (z in [-1, 1]);
// WebGPU clips to [0, 1], so left uncorrected the 3D dragon / composite quads get
// near-plane clipped. R * viewProj maps z' = 0.5 z + 0.5 w. (column-major)
const Z_REMAP = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 1]);

export async function createWebGPUDevice(canvas) {
  const gpu = await makeWebGPUContext(canvas, { alphaMode: "premultiplied" });
  const device = gpu.device, context = gpu.context, format = gpu.format, queue = device.queue;
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const shaders = [];
  let encoder = null;
  let texCounter = 0; // stable id per live GPUTexture, for bind-group cache keys
  let W = canvas.width, H = canvas.height;
  let msaaTex, msaaView, depthTex, depthView;
  const vpScratch = mat4.create();

  function makeMSAA() {
    msaaTex?.destroy?.(); depthTex?.destroy?.();
    msaaTex = device.createTexture({ size: [W, H], sampleCount: 4, format, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    msaaView = msaaTex.createView();
    depthTex = device.createTexture({ size: [W, H], sampleCount: 4, format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT });
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

  function target({ width, height, format: fmt = "rgba8", filter = "linear" }) {
    const color = texture({ width, height, format: fmt, filter });
    return { color, get _view() { return color._view; }, width, height, destroy() { color.destroy(); } };
  }

  function shader(desc) {
    const mod = device.createShaderModule({ code: desc.wgsl });
    const vbuffers = (desc.buffers || []).map((b) => ({
      arrayStride: b.stride, stepMode: b.step === "instance" ? "instance" : "vertex",
      attributes: b.attributes.map((a) => ({ shaderLocation: a.location, offset: a.offset || 0, format: a.format })),
    }));
    const targetFormat = desc.target === "screen" ? format : "rgba8unorm";
    const pdesc = {
      layout: "auto",
      vertex: { module: mod, entryPoint: "vs", buffers: vbuffers },
      fragment: { module: mod, entryPoint: "fs", targets: [{ format: targetFormat, blend: desc.blend ? BLEND[desc.blend] : undefined }] },
      primitive: { topology: TOPO[desc.topology || "tri"], cullMode: "none" },
      multisample: { count: desc.sampleCount || 1 },
    };
    if (desc.depth) pdesc.depthStencil = { format: "depth24plus", depthWriteEnabled: desc.depth === "test", depthCompare: desc.depth === "test" ? "less-equal" : "always" };
    const pipeline = device.createRenderPipeline(pdesc);

    const ulayout = desc.uniforms && desc.uniforms.length ? uniformLayout(desc.uniforms) : null;
    const sh = {
      _pipeline: pipeline, desc,
      _bgl: pipeline.getBindGroupLayout(0), // resolved ONCE at load, not per draw
      _ulayout: ulayout,
      _uniformBinding: desc.uniformBinding ?? 0,
      _samplerBinding: desc.sampler ?? null,
      _scratch: ulayout ? new ArrayBuffer(ulayout.size) : null,
      _ubos: [], _ring: 0,
    };
    if (sh._scratch) { sh._view = new DataView(sh._scratch); sh._bytes = new Uint8Array(sh._scratch); }
    shaders.push(sh);
    return sh;
  }

  // ring slot = { buffer, bindGroup, sig }; one fresh uniform buffer per draw,
  // recycled each frame (reset in beginFrame).
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

    // Bind-group cache: the ring buffer for this slot is stable across frames; the
    // only thing that varies is the bound TEXTURE set. Cache one bind group per
    // texture-signature so even alternating texture sets (e.g. the dragon's two
    // frame buffers) reuse a cached group — zero createBindGroup in steady state.
    let sig = "";
    for (const t of texList) { const tex = args.textures && args.textures[t.name]; sig += (tex ? tex._id : 0) + ":"; }
    let bg = holder.bgCache.get(sig);
    if (!bg) {
      const entries = [];
      if (ubo) entries.push({ binding: sh._uniformBinding, resource: { buffer: ubo } });
      for (const t of texList) { const tex = args.textures && args.textures[t.name]; if (tex) entries.push({ binding: t.binding, resource: tex._view }); }
      if (sh._samplerBinding != null) entries.push({ binding: sh._samplerBinding, resource: sampler });
      bg = device.createBindGroup({ layout: sh._bgl, entries });
      holder.bgCache.set(sig, bg);
      if (holder.bgCache.size > 8) { const k = holder.bgCache.keys().next().value; holder.bgCache.delete(k); } // bound it (texture reallocs change ids)
    }
    rp.setBindGroup(0, bg);

    const buffers = args.buffers || [];
    for (let i = 0; i < buffers.length; i++) if (buffers[i]) rp.setVertexBuffer(i, buffers[i]._buf);
    if (args.index) { rp.setIndexBuffer(args.index._buf, "uint16"); rp.drawIndexed(args.count, args.instances || 1); }
    else rp.draw(args.count, args.instances || 1);
  }

  function pass(opts, fn) {
    const toScreen = !opts.target || opts.target === "screen";
    const clear = opts.clear;
    const clearValue = clear ? { r: clear[0], g: clear[1], b: clear[2], a: clear[3] } : undefined;
    let color, depth;
    if (toScreen) {
      const view = context.getCurrentTexture().createView();
      color = { view: msaaView, resolveTarget: view, clearValue: clearValue || { r: 0, g: 0, b: 0, a: 1 }, loadOp: clear ? "clear" : "load", storeOp: "discard" };
      if (opts.depth) depth = { view: depthView, depthClearValue: opts.depthClear ?? 1, depthLoadOp: "clear", depthStoreOp: "discard" };
    } else {
      color = { view: opts.target._view, clearValue: clearValue || { r: 0, g: 0, b: 0, a: 0 }, loadOp: clear ? "clear" : "load", storeOp: "store" };
    }
    const rp = encoder.beginRenderPass({ colorAttachments: [color], depthStencilAttachment: depth });
    fn({ draw: (sh, args) => drawImpl(rp, sh, args) });
    rp.end();
  }

  function correctViewProj(m) { mat4.multiply(vpScratch, Z_REMAP, m); return vpScratch; }

  return {
    backend: "webgpu", device, gpu,
    buffer, texture, target, shader, pass, correctViewProj,
    beginFrame() { encoder = device.createCommandEncoder(); for (const s of shaders) s._ring = 0; },
    endFrame() { if (encoder) { queue.submit([encoder.finish()]); encoder = null; } },
    resize(w, h) { W = Math.max(1, w | 0); H = Math.max(1, h | 0); makeMSAA(); },
    destroy() { msaaTex?.destroy?.(); depthTex?.destroy?.(); device.destroy?.(); },
  };
}
