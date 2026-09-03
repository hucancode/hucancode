// OBJ DRAGON (config D3_STYLE "obj"): the skinned dragon-low.obj mesh,
// spine-deformed along the path frame texture. Loaded via dynamic import ONLY
// when the style is active, so the default mech style pays neither bundle nor
// runtime cost for it.
import { loadDragonMesh } from "$lib/mesh/obj.js";
import DRAGON3D from "./shaders/dragon3d.wgsl?shader";

const DRAGON_OBJ = "/assets/obj/dragon-low.obj";

export async function createObjDragon(device) {
  const shader = device.program(DRAGON3D, {
    blend: "straight",
    depth: true,
    topology: "tri",
  });
  const mesh = await loadDragonMesh(DRAGON_OBJ, 1.0);
  const pos = device.buffer({ kind: "vertex", data: mesh.positions });
  const norm = device.buffer({ kind: "vertex", data: mesh.normals });
  const count = mesh.vertexCount;

  // cache one texture per frames-array identity so each is uploaded once, then just rebind
  const framesTexCache = new Map();
  function getFramesTex(d3) {
    if (!d3.frames) return null;
    let t = framesTexCache.get(d3.frames);
    if (!t) {
      t = device.texture({
        width: 4,
        height: d3.frameCount,
        format: "rgba32f",
        filter: "nearest",
      });
      t.write(d3.frames, 4, d3.frameCount);
      framesTexCache.set(d3.frames, t);
      if (framesTexCache.size > 4) {
        const k = framesTexCache.keys().next().value;
        framesTexCache.get(k).destroy();
        framesTexCache.delete(k);
      }
    }
    return t;
  }

  function draw(p, d3, opacity, vp, albedo) {
    const framesT = getFramesTex(d3);
    if (!framesT || count === 0) return;
    p.draw(shader, {
      buffers: { aPos: pos, aNormal: norm },
      count,
      bindings: { framesTex: framesT },
      uniforms: {
        uViewProj: vp,
        uN: d3.frameCount,
        uPathLen: d3.pathLen,
        uBodyLen: d3.bodyLen,
        uHeadOffset: d3.headOffset,
        uGirth: d3.girth,
        uOpacity: opacity,
        uLightBoost: 1,
        uAlbedo: albedo,
      },
    });
  }

  function destroy() {
    pos.destroy();
    norm.destroy();
    for (const t of framesTexCache.values()) t.destroy();
    framesTexCache.clear();
  }

  return { draw, destroy };
}
