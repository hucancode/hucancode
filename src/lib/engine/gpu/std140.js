// std140-ish uniform packing shared by both backends. WGSL uniform-address
// layout and GLSL std140 agree for the flat scalar/vector/mat4 structs we use:
// vec3/vec4/mat4 align to 16, vec2 to 8, f32/i32 to 4. The WGSL uniform struct
// (and the naga-generated GLSL block) MUST declare the same fields in the same
// order as the descriptor's `uniforms` list.
const U_ALIGN = { f32: 4, i32: 4, vec2: 8, vec3: 16, vec4: 16, mat4: 16 };
const U_SIZE = { f32: 4, i32: 4, vec2: 8, vec3: 12, vec4: 16, mat4: 64 };
const align = (n, a) => Math.ceil(n / a) * a;

export function uniformLayout(uniforms) {
  let off = 0;
  const fields = uniforms.map((u) => {
    off = align(off, U_ALIGN[u.type]);
    const f = { name: u.name, type: u.type, offset: off };
    off += U_SIZE[u.type];
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
