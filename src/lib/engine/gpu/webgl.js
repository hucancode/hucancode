import { uniformLayout, packUniforms } from "./std140.js";
import { TYPE_COMP, resolveBuffers } from "./types.js";
import * as mat4 from "../../math/mat4.js";

const TEX = {
  rgba8: { internal: "RGBA8", format: "RGBA", type: "UNSIGNED_BYTE" },
  rgba16f: { internal: "RGBA16F", format: "RGBA", type: "HALF_FLOAT" },
  rgba32f: { internal: "RGBA32F", format: "RGBA", type: "FLOAT" },
};
const TOPO = {
  tri: "TRIANGLES",
  "tri-strip": "TRIANGLE_STRIP",
  "line-strip": "LINE_STRIP",
  point: "POINTS",
};

export function createWebGLDevice(canvas, { msaa = true } = {}) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: msaa,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL2 not available");
  gl.getExtension("EXT_color_buffer_float") ||
    gl.getExtension("EXT_color_buffer_half_float");
  let W = gl.drawingBufferWidth,
    H = gl.drawingBufferHeight;
  const resources = new Set();

  const bufNative = new WeakMap();
  const texNative = new WeakMap();
  // WebGL2 guarantees at least 16 generic vertex attributes. Attribute ENABLE
  // state is global to the GL context (shared across devices bound to the same
  // canvas), so every draw clears it and enables only what it consumes.
  const MAX_ATTRIBS = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
      throw new Error(
        "shader compile failed:\n" +
          gl.getShaderInfoLog(sh) +
          "\n--- src ---\n" +
          src,
      );
    return sh;
  };

  function applyBlend(blend) {
    if (!blend || blend === "none") {
      gl.disable(gl.BLEND);
      return;
    }
    gl.enable(gl.BLEND);
    if (blend === "premult")
      gl.blendFuncSeparate(
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
      );
    else if (blend === "straight")
      gl.blendFuncSeparate(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
      );
    else if (blend === "additive")
      gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
  }
  function applyDepth(depth) {
    if (depth) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
    } else {
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
    }
  }
  function applyCull(cull) {
    if (cull !== "back" && cull !== "front") {
      gl.disable(gl.CULL_FACE);
      return;
    }
    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CCW);
    gl.cullFace(cull === "back" ? gl.BACK : gl.FRONT);
  }

  function buffer({
    kind = "vertex",
    data = null,
    size = 0,
    dynamic = false,
  } = {}) {
    if (kind !== "vertex" && kind !== "index")
      throw new Error(`unknown buffer kind "${kind}"`);
    const target = kind === "index" ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
    const usage = dynamic ? gl.STREAM_DRAW : gl.STATIC_DRAW;
    const glb = gl.createBuffer();
    let cap = data ? data.byteLength : size;
    gl.bindBuffer(target, glb);
    gl.bufferData(target, data || size, usage);
    const handle = {
      write(d, offset = 0) {
        gl.bindBuffer(target, glb);
        if (offset === 0 && d.byteLength > cap) {
          gl.bufferData(target, d, usage);
          cap = d.byteLength;
        } else gl.bufferSubData(target, offset, d);
      },
      destroy() {
        gl.deleteBuffer(glb);
        resources.delete(handle);
      },
    };
    bufNative.set(handle, { glb, target });
    resources.add(handle);
    return handle;
  }

  function texture({
    width,
    height,
    format = "rgba8",
    filter = "linear",
    data = null,
  } = {}) {
    const F = TEX[format];
    const flt = filter === "nearest" ? gl.NEAREST : gl.LINEAR;
    const tex = gl.createTexture();
    let w = width,
      h = height;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, flt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, flt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl[F.internal],
      w,
      h,
      0,
      gl[F.format],
      gl[F.type],
      data,
    );
    const handle = {
      get width() {
        return w;
      },
      get height() {
        return h;
      },
      get format() {
        return format;
      },
      write(d, dw = w, dh = h) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        if (dw !== w || dh !== h) {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl[F.internal],
            dw,
            dh,
            0,
            gl[F.format],
            gl[F.type],
            d,
          );
          w = dw;
          h = dh;
        } else
          gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            w,
            h,
            gl[F.format],
            gl[F.type],
            d,
          );
      },
      writeSub(d, x, y, sw, sh) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          x,
          y,
          sw,
          sh,
          gl[F.format],
          gl[F.type],
          d,
        );
      },
      destroy() {
        gl.deleteTexture(tex);
        resources.delete(handle);
      },
    };
    texNative.set(handle, { tex });
    resources.add(handle);
    return handle;
  }

  function program(module, opts = {}) {
    const R = module.reflect;
    if (!R.vertexEntry || !R.fragmentEntry)
      throw new Error(
        "shader has no vertex/fragment entry (render engine is raster-only)",
      );

    const f = compile(gl.FRAGMENT_SHADER, module.glsl.fragment);

    function link(vertexSrc) {
      const v = compile(gl.VERTEX_SHADER, vertexSrc);
      const prog = gl.createProgram();
      gl.attachShader(prog, v);
      gl.attachShader(prog, f);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
        throw new Error("program link failed:\n" + gl.getProgramInfoLog(prog));
      gl.deleteShader(v);

      const nBlocks = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORM_BLOCKS);
      for (let i = 0; i < nBlocks; i++) gl.uniformBlockBinding(prog, i, 0);

      // sampler uniform names come from naga's actual output (glsl.samplers),
      // never from a hard-coded naming convention.
      const samplers = [];
      for (const t of R.textures) {
        for (const st of ["vs", "fs"]) {
          const name = module.glsl.samplers[st]?.[t.binding];
          if (!name) continue;
          const loc = gl.getUniformLocation(prog, name);
          if (loc !== null) samplers.push({ name: t.name, loc });
        }
      }
      return { _prog: prog, _samplers: samplers };
    }

    const normal = link(module.glsl.vertex);
    const flipped = module.glsl.vertexFlipped
      ? link(module.glsl.vertexFlipped)
      : normal;
    gl.deleteShader(f);

    const buffers = resolveBuffers(R.vertexInputs, opts.layout);

    const ulayout = R.uniforms.length ? uniformLayout(R.uniforms) : null;
    let ubo = null,
      view = null,
      bytes = null;
    if (ulayout) {
      ubo = gl.createBuffer();
      gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
      gl.bufferData(gl.UNIFORM_BUFFER, ulayout.size, gl.STREAM_DRAW);
      const scratch = new ArrayBuffer(ulayout.size);
      view = new DataView(scratch);
      bytes = new Uint8Array(scratch);
    }

    return {
      _normal: normal,
      _flipped: flipped,
      _buffers: buffers,
      _ulayout: ulayout,
      _ubo: ubo,
      _view: view,
      _bytes: bytes,
      _opts: opts,
    };
  }

  function drawImpl(sh, args, flip) {
    const info = flip ? sh._flipped : sh._normal;
    gl.useProgram(info._prog);
    applyBlend(sh._opts.blend);
    applyDepth(sh._opts.depth);
    applyCull(args.cull ?? sh._opts.cull);

    const buffers = args.buffers || {};

    // Clear attribute ENABLE state (global to the context — see MAX_ATTRIBS)
    // before enabling only what this draw consumes.
    for (let i = 0; i < MAX_ATTRIBS; i++) gl.disableVertexAttribArray(i);

    for (const L of sh._buffers) {
      const buf = buffers[L.key];
      if (!buf) throw new Error(`draw missing vertex buffer "${L.key}"`);
      const { glb } = bufNative.get(buf);
      gl.bindBuffer(gl.ARRAY_BUFFER, glb);
      for (const a of L.attributes) {
        gl.enableVertexAttribArray(a.location);
        gl.vertexAttribPointer(
          a.location,
          TYPE_COMP[a.type],
          gl.FLOAT,
          false,
          L.stride,
          a.offset,
        );
        gl.vertexAttribDivisor(a.location, L.step === "instance" ? 1 : 0);
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
    for (const s of info._samplers) {
      const t = args.bindings && args.bindings[s.name];
      if (!t) continue;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texNative.get(t).tex);
      gl.uniform1i(s.loc, unit);
      unit++;
    }

    const mode = gl[TOPO[sh._opts.topology || "tri"]];
    const inst = args.instances ?? 1;
    if (args.index) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufNative.get(args.index).glb);
      gl.drawElementsInstanced(mode, args.count, gl.UNSIGNED_SHORT, 0, inst);
    } else {
      gl.drawArraysInstanced(mode, 0, args.count, inst);
    }
  }

  function render(opts = {}, fn) {
    const clear = opts.clear || null;
    const clearColor = clear?.color ?? null;
    const clearDepth = clear?.depth;

    if (opts.target) {
      const fbo = fboFor(opts.target);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texNative.get(opts.target).tex,
        0,
      );
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        throw new Error(
          "FBO incomplete (float color buffer extension unavailable?)",
        );
      gl.viewport(0, 0, opts.target.width, opts.target.height);
      if (clearColor) {
        gl.clearColor(
          clearColor[0],
          clearColor[1],
          clearColor[2],
          clearColor[3],
        );
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      fn({ draw: (sh, args) => drawImpl(sh, args, true) });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    if (clearColor || clearDepth !== undefined) {
      if (clearColor)
        gl.clearColor(
          clearColor[0],
          clearColor[1],
          clearColor[2],
          clearColor[3],
        );
      let bits = clearColor ? gl.COLOR_BUFFER_BIT : 0;
      if (clearDepth !== undefined) {
        gl.clearDepth(clearDepth);
        gl.depthMask(true);
        bits |= gl.DEPTH_BUFFER_BIT;
      }
      if (bits) gl.clear(bits);
    }
    fn({ draw: (sh, args) => drawImpl(sh, args, false) });
  }

  const fbos = new WeakMap();
  function fboFor(tex) {
    let fbo = fbos.get(tex);
    if (!fbo) {
      fbo = gl.createFramebuffer();
      fbos.set(tex, fbo);
    }
    return fbo;
  }

  return {
    backend: "webgl",
    perspective(out, fovy, aspect, near, far) {
      mat4.perspective(out, fovy, aspect, near, far);
      return out;
    },
    buffer,
    texture,
    program,
    render,
    resize(w, h) {
      W = w;
      H = h;
    },
    destroy() {
      for (const r of [...resources]) r.destroy();
      resources.clear();
    },
  };
}
