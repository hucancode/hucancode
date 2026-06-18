// Thin WebGL2 toolkit. No materials, no render graph — scenes write their own
// shaders and drive their own draws. This just removes the boilerplate:
//   ctx.program(vs, fs)          compile + link, with a typed uniform setter
//   prog.set(name, value)        number / mat4 / vecN / Color / {x,y,z} / texture
//   prog.draw(geometry)          lazily builds VBOs + a per-program VAO, drawArrays
//   DataTexture                  CPU bytes a scene packs and samples in its shader
//
// Geometry is any object with `.attributes[name] = { array, itemSize, count }`
// (see geometry.js) — attribute names are matched to the shader by getAttribLocation.

export class DataTexture {
  constructor(data, width, height, opts = {}) {
    this.isTexture = true;
    this.data = data;
    this.width = width;
    this.height = height;
    this.internalFormat = opts.internalFormat || "RGBA32F";
    this.format = opts.format || "RGBA";
    this.type = opts.type || "FLOAT";
    this.filter = opts.filter || "NEAREST";
    this.needsUpdate = true;
    this._tex = null;
  }
  set(data) {
    this.data = data;
    this.needsUpdate = true;
  }
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("shader compile failed:\n" + log + "\n--- src ---\n" + src);
  }
  return sh;
}

export function makeContext(canvas, opts = {}) {
  const gl = canvas.getContext("webgl2", {
    alpha: opts.alpha ?? true,
    antialias: opts.antialias ?? true,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL2 not available");

  function bindTexture(tex, unit) {
    if (!tex._tex) tex._tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex._tex);
    if (tex.needsUpdate) {
      const f = gl[tex.filter];
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl[tex.internalFormat], tex.width, tex.height, 0,
        gl[tex.format], gl[tex.type], tex.data, 0,
      );
      tex.needsUpdate = false;
    }
  }

  function program(vs, fs) {
    const v = compile(gl, gl.VERTEX_SHADER, vs);
    const f = compile(gl, gl.FRAGMENT_SHADER, fs);
    const prog = gl.createProgram();
    gl.attachShader(prog, v);
    gl.attachShader(prog, f);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error("program link failed:\n" + gl.getProgramInfoLog(prog));
    gl.deleteShader(v);
    gl.deleteShader(f);

    const uloc = new Map();
    const aloc = new Map();
    let unit = 0;
    const uniform = (name) => {
      let l = uloc.get(name);
      if (l === undefined) { l = gl.getUniformLocation(prog, name); uloc.set(name, l); }
      return l;
    };
    const attrib = (name) => {
      let l = aloc.get(name);
      if (l === undefined) { l = gl.getAttribLocation(prog, name); aloc.set(name, l); }
      return l;
    };

    const api = {
      prog,
      use() {
        gl.useProgram(prog);
        unit = 0; // texture units reassigned per frame of draws
        return api;
      },
      set(name, value) {
        const loc = uniform(name);
        if (loc === null) return api;
        if (value == null) return api;
        if (value.isTexture) {
          bindTexture(value, unit);
          gl.uniform1i(loc, unit);
          unit++;
        } else if (typeof value === "number") {
          gl.uniform1f(loc, value);
        } else if (typeof value === "boolean") {
          gl.uniform1i(loc, value ? 1 : 0);
        } else if (value instanceof Float32Array || Array.isArray(value)) {
          const n = value.length;
          if (n === 16) gl.uniformMatrix4fv(loc, false, value);
          else if (n === 9) gl.uniformMatrix3fv(loc, false, value);
          else if (n === 2) gl.uniform2fv(loc, value);
          else if (n === 3) gl.uniform3fv(loc, value);
          else if (n === 4) gl.uniform4fv(loc, value);
        } else if (value.r !== undefined) {
          gl.uniform3f(loc, value.r, value.g, value.b);
        } else if (value.x !== undefined) {
          if (value.z !== undefined) gl.uniform3f(loc, value.x, value.y, value.z);
          else gl.uniform2f(loc, value.x, value.y);
        }
        return api;
      },
      // ensure geometry GPU buffers exist; bind a VAO specific to this program
      draw(geometry, mode = gl.TRIANGLES) {
        if (!geometry._vbos) {
          geometry._vbos = {};
          for (const name in geometry.attributes) {
            const b = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, b);
            gl.bufferData(gl.ARRAY_BUFFER, geometry.attributes[name].array, gl.STATIC_DRAW);
            geometry._vbos[name] = b;
          }
          geometry._vaos = new Map();
        }
        let vao = geometry._vaos.get(prog);
        if (!vao) {
          vao = gl.createVertexArray();
          gl.bindVertexArray(vao);
          for (const name in geometry.attributes) {
            const l = attrib(name);
            if (l < 0) continue;
            const a = geometry.attributes[name];
            gl.bindBuffer(gl.ARRAY_BUFFER, geometry._vbos[name]);
            gl.enableVertexAttribArray(l);
            gl.vertexAttribPointer(l, a.itemSize, gl.FLOAT, false, 0, 0);
          }
          geometry._vaos.set(prog, vao);
        }
        gl.bindVertexArray(vao);
        gl.drawArrays(mode, 0, geometry.attributes.position.count);
        return api;
      },
      dispose() {
        gl.deleteProgram(prog);
      },
    };
    return api;
  }

  function resize(w, h, dpr = 1) {
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
  }

  return { gl, program, resize, bindTexture };
}
