import { uniformLayout, packUniforms } from "./std140.js";
import { VERTEX_FMT, resolveBuffers } from "./types.js";
import * as mat4 from "../../math/mat4.js";

async function makeWebGPUContext(canvas) {
  if (typeof navigator === "undefined" || !navigator.gpu)
    throw new Error("WebGPU not available");
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance",
  });
  if (!adapter) throw new Error("no WebGPU adapter");
  if (adapter.isFallbackAdapter)
    throw new Error("WebGPU adapter is software (fallback)");
  const info =
    adapter.info ||
    (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null);
  const sig = info
    ? `${info.vendor || ""} ${info.architecture || ""} ${info.device || ""} ${info.description || ""}`.toLowerCase()
    : "";
  if (
    /swiftshader|llvmpipe|lavapipe|softpipe|software|basic render|microsoft basic/.test(
      sig,
    )
  )
    throw new Error("WebGPU adapter is software: " + sig.trim());
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("WebGPU canvas context unavailable");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });
  return { device, context, format };
}

const BLEND = {
  premult: {
    color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
  },
  straight: {
    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
  },
  additive: {
    color: { srcFactor: "one", dstFactor: "one" },
    alpha: { srcFactor: "one", dstFactor: "one" },
  },
};
const TOPO = {
  tri: "triangle-list",
  "tri-strip": "triangle-strip",
  "line-strip": "line-strip",
  point: "point-list",
};
const RENDER_FMT = {
  rgba8: "rgba8unorm",
  rgba16f: "rgba16float",
  rgba32f: "rgba32float",
};
const align = (n, a) => Math.ceil(n / a) * a;

export async function createWebGPUDevice(canvas, { msaa = true } = {}) {
  const gpu = await makeWebGPUContext(canvas);
  const device = gpu.device,
    context = gpu.context,
    format = gpu.format,
    queue = device.queue;
  const resources = new Set();
  const shaders = [];

  const bufNative = new WeakMap();
  const texNative = new WeakMap();

  let texCounter = 0,
    bufCounter = 0;
  let W = canvas.width,
    H = canvas.height;
  let msaaTex, msaaView, depthTex, depthView;

  function makeMSAA() {
    msaaTex?.destroy?.();
    depthTex?.destroy?.();
    if (msaa) {
      msaaTex = device.createTexture({
        size: [W, H],
        sampleCount: 4,
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      msaaView = msaaTex.createView();
    } else {
      msaaTex = null;
      msaaView = null;
    }
    depthTex = device.createTexture({
      size: [W, H],
      sampleCount: msaa ? 4 : 1,
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    depthView = depthTex.createView();
  }
  makeMSAA();

  let linearSampler = null,
    nearestSampler = null;
  function samplerFor(filter) {
    if (filter === "nearest") {
      nearestSampler ??= device.createSampler({
        magFilter: "nearest",
        minFilter: "nearest",
      });
      return nearestSampler;
    }
    linearSampler ??= device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
    return linearSampler;
  }

  function buffer({
    kind = "vertex",
    data = null,
    size = 0,
    dynamic = false,
  } = {}) {
    if (kind !== "vertex" && kind !== "index")
      throw new Error(`unknown buffer kind "${kind}"`);
    const usage =
      (kind === "index" ? GPUBufferUsage.INDEX : GPUBufferUsage.VERTEX) |
      GPUBufferUsage.COPY_DST;
    let cap = align(data ? data.byteLength : size, 4);
    let buf = device.createBuffer({ size: Math.max(cap, 4), usage });
    if (data) queue.writeBuffer(buf, 0, data);
    const rec = { buf, id: ++bufCounter };
    const handle = {
      write(d, offset = 0) {
        if (offset === 0 && d.byteLength > cap) {
          buf.destroy();
          cap = align(d.byteLength, 4);
          buf = device.createBuffer({ size: cap, usage });
          rec.buf = buf;
          rec.id = ++bufCounter;
        }
        queue.writeBuffer(rec.buf, offset, d);
      },
      destroy() {
        buf.destroy();
        resources.delete(handle);
      },
    };
    bufNative.set(handle, rec);
    resources.add(handle);
    return handle;
  }

  function texture({
    width,
    height,
    format: fmt = "rgba8",
    filter = "linear",
    data = null,
  } = {}) {
    const gfmt = RENDER_FMT[fmt] || fmt;
    const bpp = fmt === "rgba32f" ? 16 : fmt === "rgba16f" ? 8 : 4;
    const usage =
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT;
    const rec = { tex: null, view: null, id: 0, gfmt, bpp, filter };
    let w = 0,
      h = 0;
    function alloc(nw, nh) {
      rec.tex?.destroy?.();
      rec.tex = device.createTexture({ size: [nw, nh], format: gfmt, usage });
      rec.view = rec.tex.createView();
      w = nw;
      h = nh;
      rec.id = ++texCounter;
    }
    function upload(d, dw, dh) {
      if (dw !== w || dh !== h) alloc(dw, dh);
      queue.writeTexture(
        { texture: rec.tex },
        d,
        { bytesPerRow: w * bpp, rowsPerImage: h },
        { width: w, height: h },
      );
    }
    alloc(width, height);
    if (data) upload(data, width, height);
    const handle = {
      get width() {
        return w;
      },
      get height() {
        return h;
      },
      get format() {
        return fmt;
      },
      write(d, dw = w, dh = h) {
        upload(d, dw, dh);
      },
      writeSub(d, x, y, sw, sh) {
        queue.writeTexture(
          { texture: rec.tex, origin: { x, y } },
          d,
          { bytesPerRow: sw * bpp, rowsPerImage: sh },
          { width: sw, height: sh },
        );
      },
      destroy() {
        rec.tex.destroy();
        resources.delete(handle);
      },
    };
    texNative.set(handle, rec);
    resources.add(handle);
    return handle;
  }

  function program(module, opts = {}) {
    const R = module.reflect;
    if (!R.vertexEntry || !R.fragmentEntry)
      throw new Error(
        "shader has no vertex/fragment entry (render engine is raster-only)",
      );

    const mod = device.createShaderModule({ code: module.wgsl });
    const buffers = resolveBuffers(R.vertexInputs, opts.layout);
    const sh = {
      _mod: mod,
      _R: R,
      _opts: opts,
      _buffers: buffers,
      _pipelines: new Map(),
      _bgl: null,
      _ulayout: R.uniforms.length ? uniformLayout(R.uniforms) : null,
      _hasBindings: !!(R.uniforms.length || R.textures.length),
      _scratch: null,
      _view: null,
      _bytes: null,
      _ubos: [],
      _ring: 0,
      _noUbo: null,
    };
    if (sh._ulayout) {
      sh._scratch = new ArrayBuffer(sh._ulayout.size);
      sh._view = new DataView(sh._scratch);
      sh._bytes = new Uint8Array(sh._scratch);
    }
    shaders.push(sh);
    return sh;
  }

  function pipelineFor(sh, targetFormat, sampleCount, hasDepth, cullOverride) {
    const cull = (cullOverride ?? sh._opts.cull) || "none";
    const key =
      targetFormat + ":" + sampleCount + ":" + (hasDepth ? 1 : 0) + ":" + cull;
    let p = sh._pipelines.get(key);
    if (p) return p;
    const R = sh._R,
      o = sh._opts;
    const vbuffers = sh._buffers.map((b) => ({
      arrayStride: b.stride,
      stepMode: b.step === "instance" ? "instance" : "vertex",
      attributes: b.attributes.map((a) => ({
        shaderLocation: a.location,
        offset: a.offset,
        format: VERTEX_FMT[a.type],
      })),
    }));
    const pdesc = {
      layout: "auto",
      vertex: { module: sh._mod, entryPoint: R.vertexEntry, buffers: vbuffers },
      fragment: {
        module: sh._mod,
        entryPoint: R.fragmentEntry,
        targets: [
          {
            format: targetFormat,
            blend: o.blend && o.blend !== "none" ? BLEND[o.blend] : undefined,
          },
        ],
      },
      primitive: {
        topology: TOPO[o.topology || "tri"],
        frontFace: "ccw",
        cullMode: cull,
      },
      multisample: { count: sampleCount },
    };
    if (hasDepth)
      pdesc.depthStencil = {
        format: "depth24plus",
        depthWriteEnabled: !!o.depth,
        depthCompare: o.depth ? "less-equal" : "always",
      };
    p = device.createRenderPipeline(pdesc);
    sh._pipelines.set(key, p);
    if (sh._hasBindings && !sh._bgl) sh._bgl = p.getBindGroupLayout(0);
    return p;
  }

  function holderFor(sh, args) {
    if (!sh._ulayout) return sh._noUbo || (sh._noUbo = { bgCache: new Map() });
    if (sh._ring >= sh._ubos.length)
      sh._ubos.push({
        buffer: device.createBuffer({
          size: sh._ulayout.size,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        }),
        bgCache: new Map(),
      });
    const e = sh._ubos[sh._ring++];
    sh._bytes.fill(0);
    packUniforms(sh._ulayout, args.uniforms || {}, sh._view);
    queue.writeBuffer(e.buffer, 0, sh._bytes);
    return e;
  }

  function buildBindGroup(sh, holder, args) {
    const R = sh._R;
    const bindings = args.bindings || {};
    let sig = holder.buffer ? "u" : "";
    for (const t of R.textures) {
      const tex = bindings[t.name];
      sig += (tex ? texNative.get(tex).id : 0) + ":";
    }
    let bg = holder.bgCache.get(sig);
    if (bg) return bg;
    const entries = [];
    if (holder.buffer)
      entries.push({ binding: 0, resource: { buffer: holder.buffer } });
    for (const t of R.textures) {
      const tex = bindings[t.name];
      if (tex)
        entries.push({ binding: t.binding, resource: texNative.get(tex).view });
    }
    for (const s of R.samplers) {
      const tex = s.texture && bindings[s.texture];
      entries.push({
        binding: s.binding,
        resource: samplerFor(tex ? texNative.get(tex).filter : "linear"),
      });
    }
    bg = device.createBindGroup({ layout: sh._bgl, entries });
    holder.bgCache.set(sig, bg);
    if (holder.bgCache.size > 8) {
      const k = holder.bgCache.keys().next().value;
      holder.bgCache.delete(k);
    }
    return bg;
  }

  function drawImpl(rp, sh, args, targetFormat, sampleCount, hasDepth) {
    rp.setPipeline(
      pipelineFor(sh, targetFormat, sampleCount, hasDepth, args.cull),
    );
    if (sh._hasBindings)
      rp.setBindGroup(0, buildBindGroup(sh, holderFor(sh, args), args));
    const buffers = args.buffers || {};
    for (let i = 0; i < sh._buffers.length; i++) {
      const L = sh._buffers[i];
      if (!buffers[L.key])
        throw new Error(`draw missing vertex buffer "${L.key}"`);
      rp.setVertexBuffer(i, bufNative.get(buffers[L.key]).buf);
    }
    if (args.index) {
      rp.setIndexBuffer(bufNative.get(args.index).buf, "uint16");
      rp.drawIndexed(args.count, args.instances ?? 1);
    } else rp.draw(args.count, args.instances ?? 1);
  }

  function render(opts = {}, fn) {
    for (const s of shaders) s._ring = 0;

    const target = opts.target;
    const clear = opts.clear || null;
    const clearColor = clear?.color ?? null;
    const clearDepth = clear?.depth;
    const targetFormat = target ? texNative.get(target).gfmt : format;
    const sampleCount = target ? 1 : msaa ? 4 : 1;
    const hasDepth = !target;
    const cv = clearColor
      ? {
          r: clearColor[0],
          g: clearColor[1],
          b: clearColor[2],
          a: clearColor[3],
        }
      : { r: 0, g: 0, b: 0, a: 1 };

    const encoder = device.createCommandEncoder();
    let rp;
    if (target) {
      rp = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: texNative.get(target).view,
            clearValue: cv,
            loadOp: clearColor ? "clear" : "load",
            storeOp: "store",
          },
        ],
      });
    } else {
      const view = context.getCurrentTexture().createView();
      const loadOp = clearColor ? "clear" : "load";
      const color = msaa
        ? {
            view: msaaView,
            resolveTarget: view,
            clearValue: cv,
            loadOp,
            storeOp: "discard",
          }
        : { view, clearValue: cv, loadOp, storeOp: "store" };
      const depth = {
        view: depthView,
        depthClearValue: clearDepth ?? 1,
        depthLoadOp: clearDepth !== undefined ? "clear" : "load",
        depthStoreOp: "discard",
      };
      rp = encoder.beginRenderPass({
        colorAttachments: [color],
        depthStencilAttachment: depth,
      });
    }
    fn({
      draw: (sh, args) =>
        drawImpl(rp, sh, args, targetFormat, sampleCount, hasDepth),
    });
    rp.end();
    queue.submit([encoder.finish()]);
  }

  return {
    backend: "webgpu",
    perspective(out, fovy, aspect, near, far) {
      mat4.perspective(out, fovy, aspect, near, far);
      mat4.clipZ0to1(out, out);
      return out;
    },
    buffer,
    texture,
    program,
    render,
    resize(w, h) {
      const nw = Math.max(1, w | 0),
        nh = Math.max(1, h | 0);
      if (nw === W && nh === H) return;
      W = nw;
      H = nh;
      makeMSAA();
    },
    destroy() {
      for (const r of [...resources]) r.destroy();
      resources.clear();
      msaaTex?.destroy?.();
      depthTex?.destroy?.();
      device.destroy?.();
    },
  };
}
