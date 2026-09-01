import { TYPE_ALIGN, TYPE_SIZE } from "./types.js";

const align = (n, a) => Math.ceil(n / a) * a;

export function uniformLayout(uniforms) {
  let off = 0;
  const fields = uniforms.map((u) => {
    off = align(off, TYPE_ALIGN[u.type]);
    const f = { name: u.name, type: u.type, offset: off };
    off += TYPE_SIZE[u.type];
    return f;
  });
  return { fields, size: Math.max(16, align(off, 16)) };
}

export function packUniforms(layout, values, view) {
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
