import { m3InvT } from "../math/mat3.js";
// SHARED INSTANCED RENDER PATH for procedural models ({ items, meshes } from a kit
// or a rig). One place owns the instance layout, the shading program and the
// buffers, so every mech playground renders identically.
//
// Per instance: 3 model matrix rows (vec4 = linear row + translation in w), 3 normal
// matrix rows (inverse-transpose, for non-uniform scale and mirroring), and color
// (alpha = the item's `a`, the assembly fade).
import INSTANCED from "./shaders/instanced.wgsl?shader";

const INST_FLOATS = 28; // 3 model rows + 3 normal rows + color, vec4 each

// shader module + vertex-buffer grouping shared by every consumer; spread opts
// and add pipeline state (depth/blend/topology). Locations 2..8 are the
// per-instance block (one tightly-packed buffer).
export const INSTANCED_MODULE = INSTANCED;
export const INSTANCED_OPTS = {
  cull: "back",
  layout: {
    instance: {
      inputs: ["iM0", "iM1", "iM2", "iN0", "iN1", "iN2", "iColor"],
      step: "instance",
    },
  },
};

// write one item's 28 floats at offset o
function packInstance(data, o, it) {
  const m = it.m,
    t = it.t,
    n = m3InvT(m),
    c = it.color;
  data[o] = m[0];
  data[o + 1] = m[1];
  data[o + 2] = m[2];
  data[o + 3] = t[0];
  data[o + 4] = m[3];
  data[o + 5] = m[4];
  data[o + 6] = m[5];
  data[o + 7] = t[1];
  data[o + 8] = m[6];
  data[o + 9] = m[7];
  data[o + 10] = m[8];
  data[o + 11] = t[2];
  data[o + 12] = n[0];
  data[o + 13] = n[1];
  data[o + 14] = n[2];
  data[o + 15] = 0;
  data[o + 16] = n[3];
  data[o + 17] = n[4];
  data[o + 18] = n[5];
  data[o + 19] = 0;
  data[o + 20] = n[6];
  data[o + 21] = n[7];
  data[o + 22] = n[8];
  data[o + 23] = 0;
  data[o + 24] = c[0];
  data[o + 25] = c[1];
  data[o + 26] = c[2];
  data[o + 27] = it.a ?? 1;
}

// sign of det(m): a mirrored instance (negative determinant) flips triangle
// winding in screen space, so back-face culling must cull the OTHER side
function mirrored(m) {
  return (
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
      m[1] * (m[3] * m[8] - m[5] * m[6]) +
      m[2] * (m[3] * m[7] - m[4] * m[6]) <
    0
  );
}

// Instanced drawer: groups items by unit-mesh key, ONE instanced draw per
// key. Vertex buffers are created once per key (unit meshes are immutable);
// the per-instance buffer is a capacity-grown dynamic buffer rewritten every
// draw. Mirrored items (negative-determinant matrix) go in a sibling group
// drawn with the opposite cull face — they need their own instance buffer
// because all buffer writes land before the frame's single submit.
export function createInstancedDrawer(device) {
  const meshBufs = new Map(); // mesh key -> { pos, norm, count }
  const groups = new Map(); // list key (mesh key | mesh key + "\0m") -> { inst, cap, data }
  const lists = new Map(); // per-draw grouping scratch (list key -> items)
  const baseCull = INSTANCED_OPTS.cull || "none";

  function draw(p, shader, items, meshes, uniforms) {
    for (const list of lists.values()) list.length = 0;
    for (const it of items) {
      const lk = mirrored(it.m) ? it.key + "\0m" : it.key;
      let list = lists.get(lk);
      if (!list) lists.set(lk, (list = []));
      list.push(it);
    }
    for (const [lk, list] of lists) {
      if (list.length === 0) continue;
      const flip = lk.endsWith("\0m");
      const key = flip ? lk.slice(0, -2) : lk;
      let mb = meshBufs.get(key);
      if (!mb) {
        const mesh = meshes?.[key];
        if (!mesh) continue;
        mb = {
          pos: device.buffer({ kind: "vertex", data: mesh.positions }),
          norm: device.buffer({ kind: "vertex", data: mesh.normals }),
          count: mesh.positions.length / 3,
        };
        meshBufs.set(key, mb);
      }
      let g = groups.get(lk);
      if (!g) {
        g = {
          inst: device.buffer({ kind: "vertex", size: 0, dynamic: true }),
          cap: 0,
          data: null,
        };
        groups.set(lk, g);
      }
      if (g.cap < list.length) {
        g.cap = list.length;
        g.data = new Float32Array(g.cap * INST_FLOATS);
      }
      for (let i = 0; i < list.length; i++)
        packInstance(g.data, i * INST_FLOATS, list[i]);
      g.inst.write(g.data.subarray(0, list.length * INST_FLOATS));
      p.draw(shader, {
        buffers: { position: mb.pos, normal: mb.norm, instance: g.inst },
        count: mb.count,
        instances: list.length,
        uniforms,
        // mirrored instances invert winding, so cull the opposite face
        cull: flip
          ? baseCull === "back"
            ? "front"
            : baseCull === "front"
              ? "back"
              : "none"
          : undefined,
      });
    }
  }

  function destroy() {
    for (const mb of meshBufs.values()) {
      mb.pos.destroy();
      mb.norm.destroy();
    }
    for (const g of groups.values()) g.inst.destroy();
    meshBufs.clear();
    groups.clear();
    lists.clear();
  }

  return { draw, destroy };
}
