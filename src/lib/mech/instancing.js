// SHARED INSTANCED RENDER PATH for procedural models ({ items, meshes } from
// parts.js / rig.js). One place owns the instance layout, the shading program
// and the buffer management, so every playground drawing mech parts renders
// identically and can show assembly alpha.
//
// Per-instance data = 3 model matrix rows (vec4: linear row + translation in
// w), 3 normal matrix rows (inverse-transpose, handles non-uniform scale +
// mirroring) and color (alpha = per-item `a`, assembly fade).
import INSTANCED_WGSL from "./shaders/instanced.wgsl?raw";
import INSTANCED_VERT from "./shaders/instanced.vert.glsl?raw";
import INSTANCED_FRAG from "./shaders/instanced.frag.glsl?raw";

export const INST_FLOATS = 28; // 3 model rows + 3 normal rows + color, vec4 each

// shader descriptor shared by every consumer; spread and add pipeline state
// (depth/blend/topology/target/sampleCount). blend "straight" honors the
// instance alpha (assembly fade-ins).
export const INSTANCED_PROGRAM = {
  glsl: { vertex: INSTANCED_VERT, fragment: INSTANCED_FRAG },
  wgsl: INSTANCED_WGSL,
  buffers: [
    { stride: 12, step: "vertex", attributes: [{ name: "position", location: 0, format: "float32x3", offset: 0 }] },
    { stride: 12, step: "vertex", attributes: [{ name: "normal", location: 1, format: "float32x3", offset: 0 }] },
    { stride: INST_FLOATS * 4, step: "instance", attributes: [
      { name: "iM0", location: 2, format: "float32x4", offset: 0 },
      { name: "iM1", location: 3, format: "float32x4", offset: 16 },
      { name: "iM2", location: 4, format: "float32x4", offset: 32 },
      { name: "iN0", location: 5, format: "float32x4", offset: 48 },
      { name: "iN1", location: 6, format: "float32x4", offset: 64 },
      { name: "iN2", location: 7, format: "float32x4", offset: 80 },
      { name: "iColor", location: 8, format: "float32x4", offset: 96 },
    ] },
  ],
  uniforms: [
    { name: "uViewProj", type: "mat4" },
    { name: "uLightPos", type: "vec3" },
    { name: "uViewPos", type: "vec3" },
    { name: "uOpacity", type: "f32" },
  ],
};

// inverse-transpose of a row-major 3x3 = cofactor matrix / det
export function invT3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  return [
    A / det, B / det, C / det,
    (c * h - b * i) / det, (a * i - c * g) / det, (b * g - a * h) / det,
    (b * f - c * e) / det, (c * d - a * f) / det, (a * e - b * d) / det,
  ];
}

// write one item's 28 floats at offset o
export function packInstance(data, o, it) {
  const m = it.m, t = it.t, n = invT3(m), c = it.color;
  data[o] = m[0]; data[o + 1] = m[1]; data[o + 2] = m[2]; data[o + 3] = t[0];
  data[o + 4] = m[3]; data[o + 5] = m[4]; data[o + 6] = m[5]; data[o + 7] = t[1];
  data[o + 8] = m[6]; data[o + 9] = m[7]; data[o + 10] = m[8]; data[o + 11] = t[2];
  data[o + 12] = n[0]; data[o + 13] = n[1]; data[o + 14] = n[2]; data[o + 15] = 0;
  data[o + 16] = n[3]; data[o + 17] = n[4]; data[o + 18] = n[5]; data[o + 19] = 0;
  data[o + 20] = n[6]; data[o + 21] = n[7]; data[o + 22] = n[8]; data[o + 23] = 0;
  data[o + 24] = c[0]; data[o + 25] = c[1]; data[o + 26] = c[2]; data[o + 27] = it.a ?? 1;
}

// Instanced drawer: groups items by unit-mesh key, ONE instanced draw per
// key. Vertex buffers are created once per key (unit meshes are immutable);
// the per-instance buffer is a capacity-grown dynamic buffer rewritten every
// draw.
export function createInstancedDrawer(device) {
  const groups = new Map(); // mesh key -> { pos, norm, inst, count, cap, data }
  const lists = new Map();  // per-draw grouping scratch (key -> items)

  function draw(p, shader, items, meshes, uniforms) {
    for (const list of lists.values()) list.length = 0;
    for (const it of items) {
      let list = lists.get(it.key);
      if (!list) lists.set(it.key, (list = []));
      list.push(it);
    }
    for (const [key, list] of lists) {
      if (list.length === 0) continue;
      let g = groups.get(key);
      if (!g) {
        const mesh = meshes?.[key];
        if (!mesh) continue;
        g = {
          pos: device.buffer({ kind: "vertex", data: mesh.positions }),
          norm: device.buffer({ kind: "vertex", data: mesh.normals }),
          inst: device.buffer({ kind: "vertex", size: 0, dynamic: true }),
          count: mesh.positions.length / 3,
          cap: 0, data: null,
        };
        groups.set(key, g);
      }
      if (g.cap < list.length) { g.cap = list.length; g.data = new Float32Array(g.cap * INST_FLOATS); }
      for (let i = 0; i < list.length; i++) packInstance(g.data, i * INST_FLOATS, list[i]);
      g.inst.write(g.data.subarray(0, list.length * INST_FLOATS));
      p.draw(shader, {
        buffers: [g.pos, g.norm, g.inst],
        count: g.count,
        instances: list.length,
        uniforms,
      });
    }
  }

  function destroy() {
    for (const g of groups.values()) { g.pos.destroy(); g.norm.destroy(); g.inst.destroy(); }
    groups.clear();
    lists.clear();
  }

  return { draw, destroy };
}
