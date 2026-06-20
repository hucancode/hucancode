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

export function createWebGLDevice(canvas) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: true, premultipliedAlpha: false });
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
    else if (blend === "accum" || blend === "straight")
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  function applyDepth(depth) {
    if (depth === "test") { gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); }
    else { gl.disable(gl.DEPTH_TEST); gl.depthMask(false); }
  }

  function buffer({ kind = "vertex", data = null, size = 0, dynamic = false }) {
    const target = kind === "index" ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
    const usage = dynamic ? gl.STREAM_DRAW : gl.STATIC_DRAW;
    const glb = gl.createBuffer();
    let cap = data ? data.byteLength : size;
    gl.bindBuffer(target, glb);
    gl.bufferData(target, data || size, usage);
    return {
      _glb: glb, _target: target, kind,
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

  function target({ width, height, format = "rgba8", filter = "linear" }) {
    const color = texture({ width, height, format, filter });
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color._tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { color, _fb: fb, width, height, destroy() { color.destroy(); gl.deleteFramebuffer(fb); } };
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
      attrs: b.attributes.map((a) => ({ loc: gl.getAttribLocation(prog, a.name), comps: FMT[a.format], offset: a.offset || 0 })),
    }));
    const uniforms = (desc.uniforms || []).map((u) => ({ name: u.name, type: u.type, loc: gl.getUniformLocation(prog, u.name) }));
    const samplers = (desc.textures || []).map((t) => ({ name: t.name, loc: gl.getUniformLocation(prog, t.name) }));
    const vao = gl.createVertexArray();
    return { _prog: prog, _layouts: layouts, _uniforms: uniforms, _samplers: samplers, _vao: vao, desc };
  }

  function setUniform(u, val) {
    if (u.loc === null || val == null) return;
    switch (u.type) {
      case "f32": gl.uniform1f(u.loc, val); break;
      case "i32": gl.uniform1i(u.loc, val | 0); break;
      case "vec2": gl.uniform2fv(u.loc, val); break;
      case "vec3": gl.uniform3fv(u.loc, val); break;
      case "vec4": gl.uniform4fv(u.loc, val); break;
      case "mat4": gl.uniformMatrix4fv(u.loc, false, val); break;
    }
  }

  function drawImpl(sh, args) {
    gl.useProgram(sh._prog);
    applyBlend(sh.desc.blend);
    applyDepth(sh.desc.depth);
    gl.bindVertexArray(sh._vao);

    const buffers = args.buffers || [];
    for (let bi = 0; bi < sh._layouts.length; bi++) {
      const L = sh._layouts[bi];
      const buf = buffers[bi];
      if (!buf) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf._glb);
      for (const a of L.attrs) {
        if (a.loc < 0) continue;
        gl.enableVertexAttribArray(a.loc);
        gl.vertexAttribPointer(a.loc, a.comps, gl.FLOAT, false, L.stride, a.offset);
        gl.vertexAttribDivisor(a.loc, L.instanced ? 1 : 0);
      }
    }

    if (args.uniforms) for (const u of sh._uniforms) setUniform(u, args.uniforms[u.name]);
    let unit = 0;
    if (args.textures) for (const s of sh._samplers) {
      const t = args.textures[s.name];
      if (!t || s.loc === null) continue;
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
    const toScreen = !opts.target || opts.target === "screen";
    gl.bindFramebuffer(gl.FRAMEBUFFER, toScreen ? null : opts.target._fb);
    const w = toScreen ? W : opts.target.width, h = toScreen ? H : opts.target.height;
    gl.viewport(0, 0, w, h);
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
    buffer, texture, target, shader, pass, correctViewProj,
    beginFrame() {}, endFrame() {},
    resize(w, h) { W = w; H = h; },
    destroy() {},
  };
}
