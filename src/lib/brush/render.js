// Ink renderer for calligraphy playground, over engine GPU device: one renderer
// vs device.shader/pass runs on WebGPU (preferred) or WebGL2 (fallback).
// baked Seg[] table streamed to GPU as RGBA32F texture so edited glyph re-renders
// live (no shader recompile, no const arrays). bake (dense arc-length/belly/timing
// loops) is expensive CPU step -> CACHED: during playback symbol unchanged, only
// playhead uniform moves, so re-bake/re-upload nothing.

import { createDevice } from "$lib/engine/index.js";
import FRAG from "$lib/brush/shaders/caligraphy-playground.frag.glsl?raw";
import WGSL from "$lib/brush/shaders/caligraphy-playground.wgsl?raw";
import VERT from "$lib/brush/shaders/caligraphy-playground.vert.glsl?raw";
import { bakeSegs } from "./bake";

const TEXELS_PER_SEG = 5; // 5 RGBA32F texels = header + geometry (see packSegs)

const F32 = (name) => ({ name, type: "f32" });
const I32 = (name) => ({ name, type: "i32" });
const VEC2 = (name) => ({ name, type: "vec2" });

export async function makeRenderer(canvas) {
  const device = await createDevice(canvas);

  const shader = device.shader({
    glsl: { vertex: VERT, fragment: FRAG }, wgsl: WGSL,
    uniforms: [
      VEC2("uResolution"), F32("uBaseRadius"), F32("uZoom"), VEC2("uPan"),
      F32("uGridSize"), I32("uShowGrid"), I32("uMode"), F32("uTime"), I32("uNSeg"),
    ],
    textures: [{ name: "uSegTex", binding: 1 }],
    blend: "none", topology: "tri", target: "screen", sampleCount: 4,
  });

  const segTex = device.texture({ width: TEXELS_PER_SEG, height: 1, format: "rgba32f", filter: "nearest" });

  let buf = new Float32Array(0);
  let nSeg = 0;               // last uploaded seg count
  let bakeKey = "";          // cache key for last bake/upload

  // pack baked segs into RGBA32F texture (width=5, height=NSEG). texel 0 is HEADER
  // (center.xy, hullRadius, t0) so shader can reject a segment with single fetch.
  function packSegs(segs) {
    const n = segs.length;
    if (n === 0) return 0;
    const need = n * TEXELS_PER_SEG * 4;
    if (buf.length < need) buf = new Float32Array(need);
    for (let i = 0; i < n; i++) {
      const s = segs[i];
      const cx = (s.p1.x + s.p2.x) * 0.5;
      const cy = (s.p1.y + s.p2.y) * 0.5;
      const d1 = Math.hypot(s.p1.x - cx, s.p1.y - cy);
      const dc = Math.hypot(s.ctrl.x - cx, s.ctrl.y - cy);
      const hullR = Math.max(d1, dc);
      let o = i * TEXELS_PER_SEG * 4;
      // texel0 header, texel1 p1/p2, texel2 ctrl/pr1/pr2, texel3 k/belly/hasBelly/dur, texel4 v0/v1/pad
      buf[o++] = cx; buf[o++] = cy; buf[o++] = hullR; buf[o++] = s.t0;
      buf[o++] = s.p1.x; buf[o++] = s.p1.y; buf[o++] = s.p2.x; buf[o++] = s.p2.y;
      buf[o++] = s.ctrl.x; buf[o++] = s.ctrl.y; buf[o++] = s.pr1; buf[o++] = s.pr2;
      buf[o++] = s.k; buf[o++] = s.belly; buf[o++] = s.hasBelly; buf[o++] = s.dur;
      buf[o++] = s.v0; buf[o++] = s.v1; buf[o++] = 0; buf[o++] = 0;
    }
    segTex.write(buf.subarray(0, need), TEXELS_PER_SEG, n);
    return n;
  }

  // params: { baseRadius, view:{zoom,panX,panY}, showGrid, gridSize,
  //           connect, timing, playhead (s | undefined) }
  function render(symbol, params) {
    const w = canvas.width, h = canvas.height;
    if (w <= 0 || h <= 0) return;

    // re-bake + re-upload only when symbol or bake-affecting params change
    const key = JSON.stringify([symbol, params.connect, params.timing]);
    if (key !== bakeKey) {
      const { segs } = bakeSegs(symbol, { connect: params.connect, timing: params.timing });
      nSeg = packSegs(segs);
      bakeKey = key;
    }

    const view = params.view || { zoom: 1, panX: 0, panY: 0 };
    device.beginFrame();
    device.pass({ target: "screen", clear: [1.0, 0.988, 0.878, 1.0] }, (p) => {
      if (nSeg <= 0) return; // cleared paper is enough
      p.draw(shader, {
        count: 3,
        textures: { uSegTex: segTex },
        uniforms: {
          uResolution: [w, h],
          uBaseRadius: params.baseRadius ?? 0.07,
          uZoom: view.zoom ?? 1,
          uPan: [view.panX ?? 0, view.panY ?? 0],
          uGridSize: params.gridSize ?? 1.6,
          uShowGrid: params.showGrid ? 1 : 0,
          uMode: params.playhead === undefined ? 0 : 1,
          uTime: params.playhead ?? 0,
          uNSeg: nSeg,
        },
      });
    });
    device.endFrame();
  }

  function dispose() {
    segTex.destroy();
    device.destroy();
  }

  return { render, dispose, backend: device.backend };
}
