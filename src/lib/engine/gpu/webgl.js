// Consumes naga-generated GLSL ES 3.00 (built from the same WGSL as the WebGPU
// backend): uniforms arrive as one std140 block (all blocks bound to point 0),
// vertex attributes bind by explicit layout(location), and combined samplers
// follow naga's `_group_0_binding_<N>_{vs,fs}` naming.
import { uniformLayout, packUniforms } from "./std140.js";

const TEX = {
  rgba8: { internal: "RGBA8", format: "RGBA", type: "UNSIGNED_BYTE" },
  rgba32f: { internal: "RGBA32F", format: "RGBA", type: "FLOAT" },
};
const TOPO = {
  tri: "TRIANGLES", "tri-strip": "TRIANGLE_STRIP",
  "line-strip": "LINE_STRIP", point: "POINTS",
};
const FMT = { // vertex attribute format -> component count (all f32)
  float32: 1, float32x2: 2, float32x3: 3, float32x4: 4,
};

export function createWebGLDevice(canvas, { msaa = true } = {}) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: msaa, premultipliedAlpha: false });
  if (!gl) throw new Error("WebGL2 not available");
  let W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
      throw new Error("shader compile failed:\n" + gl.getShaderInfoLog(sh) + "\n--- src ---\n" + src);
    return sh;
  };

  function applyBlend(blend) {
    if (!blend || blend === "none") { gl.disable(gl.BLEND); return; }
    gl.enable(gl.BLEND);
    if (blend === "premult") gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else if (blend === "straight")
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  function applyDepth(depth) {
    if (depth === "test") { gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); }
    else { gl.disable(gl.DEPTH_TEST); gl.depthMask(false); }
  }
  function applyCull(cull) {
    if (cull !== "back" && cull !== "front") { gl.disable(gl.CULL_FACE); return; }
    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CCW);
    gl.cullFace(cull === "back" ? gl.BACK : gl.FRONT);
  }

  function buffer({ kind = "vertex", data = null, size = 0, dynamic = false }) {
    const target = kind === "index" ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
    const usage = dynamic ? gl.STREAM_DRAW : gl.STATIC_DRAW;
    const glb = gl.createBuffer();
    let cap = data ? data.byteLength : size;
    gl.bindBuffer(target, glb);
    gl.bufferData(target, data || size, usage);
    return {
      _glb: glb, _target: target,
      write(d, offset = 0) {
        gl.bindBuffer(target, glb);
        if (offset === 0 && d.byteLength > cap) { gl.bufferData(target, d, usage); cap = d.byteLength; }
        else gl.bufferSubData(target, offset, d);
      },
      destroy() { gl.deleteBuffer(glb); },
    };
  }

  function texture({ width, height, format = "rgba8", filter = "linear", data = null }) {
    const F = TEX[format];
    const flt = filter === "nearest" ? gl.NEAREST : gl.LINEAR;
    const tex = gl.createTexture();
    let w = width, h = height;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, flt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, flt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl[F.internal], w, h, 0, gl[F.format], gl[F.type], data);
    return {
      _tex: tex, format, get width() { return w; }, get height() { return h; },
      write(d, dw = w, dh = h) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        if (dw !== w || dh !== h) { gl.texImage2D(gl.TEXTURE_2D, 0, gl[F.internal], dw, dh, 0, gl[F.format], gl[F.type], d); w = dw; h = dh; }
        else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl[F.format], gl[F.type], d);
      },
      destroy() { gl.deleteTexture(tex); },
    };
  }

  function shader(desc) {
    const prog = gl.createProgram();
    const v = compile(gl.VERTEX_SHADER, desc.glsl.vertex);
    const f = compile(gl.FRAGMENT_SHADER, desc.glsl.fragment);
    gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error("program link failed:\n" + gl.getProgramInfoLog(prog));
    gl.deleteShader(v); gl.deleteShader(f);

    const layouts = (desc.buffers || []).map((b) => ({
      stride: b.stride, instanced: b.step === "instance",
      attrs: b.attributes.map((a) => ({ loc: a.location, comps: FMT[a.format], offset: a.offset || 0 })),
    }));

    // naga emits one uniform block per stage referencing the same struct; bind all to point 0
    const nBlocks = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORM_BLOCKS);
    for (let i = 0; i < nBlocks; i++) gl.uniformBlockBinding(prog, i, 0);
    const ulayout = desc.uniforms && desc.uniforms.length ? uniformLayout(desc.uniforms) : null;
    let ubo = null, view = null, bytes = null;
    if (ulayout) {
      ubo = gl.createBuffer();
      gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
      gl.bufferData(gl.UNIFORM_BUFFER, ulayout.size, gl.STREAM_DRAW);
      const scratch = new ArrayBuffer(ulayout.size);
      view = new DataView(scratch); bytes = new Uint8Array(scratch);
    }

    // a texture read in both stages gets one combined sampler per stage
    const samplers = (desc.textures || []).flatMap((t) =>
      ["vs", "fs"].map((st) => ({ name: t.name, loc: gl.getUniformLocation(prog, `_group_0_binding_${t.binding}_${st}`) }))
        .filter((s) => s.loc !== null));

    return { _prog: prog, _layouts: layouts, _samplers: samplers, _ulayout: ulayout, _ubo: ubo, _view: view, _bytes: bytes, desc };
  }

  function drawImpl(sh, args) {
    gl.useProgram(sh._prog);
    applyBlend(sh.desc.blend);
    applyDepth(sh.desc.depth);
    applyCull(sh.desc.cull);

    const buffers = args.buffers || [];
    for (let bi = 0; bi < sh._layouts.length; bi++) {
      const L = sh._layouts[bi];
      const buf = buffers[bi];
      if (!buf) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf._glb);
      for (const a of L.attrs) {
        gl.enableVertexAttribArray(a.loc);
        gl.vertexAttribPointer(a.loc, a.comps, gl.FLOAT, false, L.stride, a.offset);
        gl.vertexAttribDivisor(a.loc, L.instanced ? 1 : 0);
      }
    }

    if (sh._ulayout) {
      sh._bytes.fill(0);
      packUniforms(sh._ulayout, args.uniforms || {}, sh._view);
      gl.bindBuffer(gl.UNIFORM_BUFFER, sh._ubo);
      gl.bufferData(gl.UNIFORM_BUFFER, sh._bytes, gl.STREAM_DRAW);
      gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, sh._ubo);
    }

    let unit = 0;
    for (const s of sh._samplers) {
      const t = args.textures && args.textures[s.name];
      if (!t) continue;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t._tex);
      gl.uniform1i(s.loc, unit); unit++;
    }

    const mode = gl[TOPO[sh.desc.topology || "tri"]];
    const inst = args.instances || 0;
    if (args.index) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, args.index._glb);
      if (inst) gl.drawElementsInstanced(mode, args.count, gl.UNSIGNED_SHORT, 0, inst);
      else gl.drawElements(mode, args.count, gl.UNSIGNED_SHORT, 0);
    } else {
      if (inst) gl.drawArraysInstanced(mode, 0, args.count, inst);
      else gl.drawArrays(mode, 0, args.count);
    }
  }

  function pass(opts, fn) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    if (opts.clear) {
      const c = opts.clear;
      gl.clearColor(c[0], c[1], c[2], c[3]);
      let bits = gl.COLOR_BUFFER_BIT;
      if (opts.depth) { gl.clearDepth(opts.depthClear ?? 1); gl.depthMask(true); bits |= gl.DEPTH_BUFFER_BIT; }
      gl.clear(bits);
    }
    fn({ draw: (sh, args) => drawImpl(sh, args) });
  }

  // WebGL clip-space z already [-1, 1] (camera's native convention), no correction
  function correctViewProj(m) { return m; }

  return {
    backend: "webgl", gl,
    buffer, texture, shader, pass, correctViewProj,
    beginFrame() {}, endFrame() {},
    resize(w, h) { W = w; H = h; },
    destroy() {},
  };
}
