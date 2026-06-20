// Pass A: glyph ink, splash, enso, ink-dragon ribbon -> 4 offscreen targets (premult accum blend)
// Pass B: clear paper, grid + flowers, composite 4 ink layers as world-plane quads thru orbit cam,
//         depth-tested 3D dragon on top. screen pass 4x MSAA on WebGPU; WebGL2 default fb AA'd free

import { loadDragonMesh } from "$lib/engine/index.js";
import { buildRibbon, PERP_CLEARANCE, ARC_CLEARANCE } from "./webgl/stroke-gl.js";
import { FLOWER_PETALS, FLOWER_LAYERS } from "../config.js";
import { PROGRAMS } from "./programs.js";

const FLOWER_Z = -0.005;
const DRAGON_OBJ = "/assets/obj/dragon-low.obj";
const STATIC_THROTTLE = 8;

// Kanagawa palette (light/dark)
const PAPER_LIGHT = [0.949, 0.925, 0.737, 1.0];
const INK_LIGHT = [0.086, 0.086, 0.114, 0.95];
const PAPER_DARK = [0.086, 0.086, 0.114, 1.0];
const INK_DARK = [0.863, 0.843, 0.729, 0.95];
const SPLASH_LOW_LIGHT = [0.32, 0.31, 0.30];
const SPLASH_HIGH_LIGHT = [0.06, 0.06, 0.07];
const SPLASH_LOW_DARK = [0.47, 0.46, 0.40];
const SPLASH_HIGH_DARK = [0.863, 0.843, 0.729];
const DRAGON3D_LIGHT = [0.06, 0.07, 0.10];
const DRAGON3D_DARK = [0.70, 0.68, 0.59];
const _darkMQ = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const isDark = () => !!_darkMQ?.matches;
const getPaper = () => (isDark() ? PAPER_DARK : PAPER_LIGHT);
const getInk = () => (isDark() ? INK_DARK : INK_LIGHT);
const getInkRGB = () => { const c = getInk(); return [c[0], c[1], c[2]]; };
const getSplashLow = () => (isDark() ? SPLASH_LOW_DARK : SPLASH_LOW_LIGHT);
const getSplashHigh = () => (isDark() ? SPLASH_HIGH_DARK : SPLASH_HIGH_LIGHT);
const getDragon3d = () => (isDark() ? DRAGON3D_DARK : DRAGON3D_LIGHT);

const HEAD_CORNERS = [[-1.2, -0.8, 0, 0], [1.2, -0.8, 1, 0], [-1.2, 0.8, 0, 1], [1.2, 0.8, 1, 1]];
const BODY_PARAMS = { inkFlow: 1.0, strands: 3.0, waterFlow: 0.8, wobble: 0.3, widthEnd: 0.2, widthOffset: 0.5, widthRange: 1.0, widthAnchor: 0.5 };

export function makeSceneRenderer(device, canvas) {
  // stroke/head emit clip space directly (no gl_FragCoord) -> render-to-texture
  // V-flipped on WebGPU vs WebGL. flip clip Y on WebGPU to compensate
  const FLIP_Y = device.backend === "webgpu" ? -1 : 1;
  const sh = {};
  let tGlyph, tSplash, tEnso, tInk;
  let segTex;
  const framesTexCache = new Map();       // dragon frames: array-identity -> texture (<=2 live)
  let strokePos, strokeUV, strokeIdx, headBuf, flowerInst;
  let dragonPos, dragonNorm, dragonCount = 0;
  let w = 1, h = 1, frameCount = 0;

  let glyphCacheKey = NaN;
  let segRef = null, segRows = 0, segBuf = new Float32Array(0);
  const headData = new Float32Array(16);
  let flowerData = new Float32Array(0);
  // debug-only scratch. one vbuf per overlay draw, coexist in frame
  const lineBufs = [];
  let lineScratch = new Float32Array(0);

  async function init() {
    for (const name in PROGRAMS) sh[name] = device.shader(PROGRAMS[name]);
    segTex = device.texture({ width: 4, height: 1, format: "rgba32f", filter: "nearest" });
    strokePos = device.buffer({ kind: "vertex", size: 0, dynamic: true });
    strokeUV = device.buffer({ kind: "vertex", size: 0, dynamic: true });
    strokeIdx = device.buffer({ kind: "index", size: 0, dynamic: true });
    headBuf = device.buffer({ kind: "vertex", size: 64, dynamic: true });
    flowerInst = device.buffer({ kind: "vertex", size: 0, dynamic: true });
    loadMesh().catch((e) => console.warn("[paint] dragon mesh load failed", e));
    resize(canvas.width || 1, canvas.height || 1);
  }

  async function loadMesh() {
    const mesh = await loadDragonMesh(DRAGON_OBJ, 1.0);
    dragonPos = device.buffer({ kind: "vertex", data: mesh.positions });
    dragonNorm = device.buffer({ kind: "vertex", data: mesh.normals });
    dragonCount = mesh.vertexCount; // gates draw, publish last
  }

  function resize(nw, nh) {
    w = Math.max(1, nw | 0); h = Math.max(1, nh | 0);
    device.resize(w, h);
    tGlyph?.destroy(); tSplash?.destroy(); tEnso?.destroy(); tInk?.destroy();
    tGlyph = device.target({ width: w, height: h });                                  // full-res calligraphy SDF
    tSplash = device.target({ width: Math.ceil(w / 2), height: Math.ceil(h / 2) });   // soft wash -> half-res
    tEnso = device.target({ width: w, height: h });
    tInk = device.target({ width: w, height: h });                                    // full-res dragon ribbon
    glyphCacheKey = NaN; // targets recreated -> force glyph re-render
  }

  // pack baked glyph segs into rgba32f data texture (4 texels/seg). upload only
  // when seg array identity changes (scene reload)
  function uploadSegs(segs) {
    const n = segs ? segs.length : 0;
    if (n === 0) return 0;
    if (segs === segRef && n === segRows) return n;
    segRef = segs;
    const need = n * 16;
    if (segBuf.length < need) segBuf = new Float32Array(need);
    for (let i = 0; i < n; i++) {
      const s = segs[i]; let o = i * 16;
      segBuf[o++] = s.p1.x; segBuf[o++] = s.p1.y; segBuf[o++] = s.p2.x; segBuf[o++] = s.p2.y;
      segBuf[o++] = s.ctrl.x; segBuf[o++] = s.ctrl.y; segBuf[o++] = s.pr1; segBuf[o++] = s.pr2;
      segBuf[o++] = s.k; segBuf[o++] = s.belly; segBuf[o++] = s.hasBelly; segBuf[o++] = s.t0;
      segBuf[o++] = s.dur; segBuf[o++] = s.v0; segBuf[o++] = s.v1; segBuf[o++] = 0;
    }
    segTex.write(segBuf.subarray(0, need), 4, n);
    segRows = n;
    return n;
  }

  // dragon path frames STATIC per buffer. scene alternates small set (transition
  // buffer + loop ring) near handoff. cache texture per frames-array identity ->
  // each uploaded ONCE, switch which texture binds, no realloc/re-upload per frame
  function getFramesTex(d3) {
    if (!d3.frames) return null;
    let t = framesTexCache.get(d3.frames);
    if (!t) {
      t = device.texture({ width: 4, height: d3.frameCount, format: "rgba32f", filter: "nearest" });
      t.write(d3.frames, 4, d3.frameCount);
      framesTexCache.set(d3.frames, t);
      if (framesTexCache.size > 4) { // bound: rebuild() may mint fresh arrays
        const k = framesTexCache.keys().next().value;
        framesTexCache.get(k).destroy(); framesTexCache.delete(k);
      }
    }
    return t;
  }

  function drawStroke(p, points, lineWidth, aspect, opacity, params, simple, camY) {
    const r = buildRibbon(points, lineWidth);
    if (!r) return;
    strokePos.write(r.positions); strokeUV.write(r.uvs); strokeIdx.write(r.indices);
    p.draw(sh.stroke, {
      buffers: [strokePos, strokeUV], index: strokeIdx, count: r.indexCount,
      uniforms: {
        uAspect: aspect, uCamY: camY, uFlipY: FLIP_Y, uInkFlow: params.inkFlow, uStrands: params.strands,
        uWaterFlow: params.waterFlow, uWobble: params.wobble, uOpacity: opacity,
        uWidthEnd: params.widthEnd, uWidthOffset: params.widthOffset, uWidthRange: params.widthRange,
        uWidthAnchor: params.widthAnchor ?? 0.5, uPerpClearance: PERP_CLEARANCE, uArcClearance: ARC_CLEARANCE,
        uSimple: simple ? 1 : 0, uBrushColor: getInk(),
      },
    });
  }

  function drawHead(p, head, aspect, opacity, camY) {
    const theta = Math.atan2(head.dir.y, head.dir.x);
    const ct = Math.cos(theta), st = Math.sin(theta), s = head.size;
    for (let i = 0; i < 4; i++) {
      const c = HEAD_CORNERS[i];
      const lx = c[0] * s, ly = c[1] * s;
      headData[i * 4 + 0] = head.pos.x + (ct * lx - st * ly);
      headData[i * 4 + 1] = head.pos.y + (st * lx + ct * ly);
      headData[i * 4 + 2] = c[2]; headData[i * 4 + 3] = c[3];
    }
    headBuf.write(headData);
    p.draw(sh.head, { buffers: [headBuf], count: 4, uniforms: { uAspect: aspect, uCamY: camY, uFlipY: FLIP_Y, uOpacity: opacity, uBrushColor: getInk() } });
  }

  function drawFlowers(p, state, vp) {
    const f = state.flowers;
    if (!f || !f.items || f.count <= 0 || f.alpha <= 0) return;
    const n = f.count, need = n * 8;
    if (flowerData.length < need) flowerData = new Float32Array(need);
    for (let i = 0; i < n; i++) {
      const it = f.items[i], o = i * 8;
      flowerData[o] = it.x; flowerData[o + 1] = it.y; flowerData[o + 2] = it.r; flowerData[o + 3] = FLOWER_Z;
      flowerData[o + 4] = it.bloom; flowerData[o + 5] = it.seed; flowerData[o + 6] = f.alpha * (it.opacity ?? 1); flowerData[o + 7] = 0;
    }
    flowerInst.write(flowerData.subarray(0, need));
    p.draw(sh.flower, { buffers: [flowerInst], count: 4, instances: n, uniforms: { uViewProj: vp, uPetals: FLOWER_PETALS, uLayers: FLOWER_LAYERS, uInkColor: getInkRGB() } });
  }

  function compositeQuad(p, color, opacity, z, vp, aspect, stationY) {
    p.draw(sh.composite, { count: 4, textures: { uTex: color }, uniforms: { uViewProj: vp, uOpacity: opacity, uAspect: aspect, uZ: z, uStationY: stationY } });
  }

  function drawDebug(p, state, aspect, vp) {
    let slot = 0;
    const line = (data, use3D, isPoint, color) => {
      if (!data || data.length === 0) return;
      if (slot >= lineBufs.length) lineBufs.push(device.buffer({ kind: "vertex", size: 0, dynamic: true }));
      const b = lineBufs[slot++];
      b.write(data);
      p.draw(isPoint ? sh.point : sh.line, { buffers: [b], count: data.length / 3, uniforms: { uVP: vp, uAspect: aspect, u3D: use3D ? 1 : 0, uColor: color } });
    };
    if (state.debug.show) {
      const p2 = state.debug.path2d;
      if (p2 && p2.length) { // p2 is {x,y}[] -> pack xyz on z=0
        if (lineScratch.length < p2.length * 3) lineScratch = new Float32Array(p2.length * 3);
        for (let i = 0; i < p2.length; i++) { lineScratch[i * 3] = p2[i].x; lineScratch[i * 3 + 1] = p2[i].y; lineScratch[i * 3 + 2] = 0; }
        line(lineScratch.subarray(0, p2.length * 3), true, false, [0.9, 0.1, 0.6, 0.9]);
      }
      if (state.debug.path3d && state.debug.path3d.length) line(state.debug.path3d, true, false, [0.0, 0.7, 1.0, 0.9]);
      if (state.debug.pool?.length) line(state.debug.pool, true, true, [0.2, 0.5, 1.0, 1.0]);
    }
    if (state.debug.buffer && state.debug.buffer !== "none") {
      const map = { glyph: tGlyph, splash: tSplash, enso: tEnso, ink: tInk };
      const t = map[state.debug.buffer];
      if (t) p.draw(sh.blit, { count: 3, textures: { uTex: t.color } });
    }
  }

  function frame(state) {
    frameCount++;
    const aspect = state.aspect;
    const camY = state.camY || 0;
    const nSeg = uploadSegs(state.glyph.segs);
    const framesT = getFramesTex(state.dragon3d);
    // every viewProj thru camera seam (WebGPU remaps clip z to [0,1])
    const vp = device.correctViewProj(state.dragon3d.viewProj);

    device.beginFrame();

    // Pass A: offscreen ink layers
    if (nSeg > 0 && state.glyph.playhead !== glyphCacheKey) {
      glyphCacheKey = state.glyph.playhead;
      device.pass({ target: tGlyph, clear: [0, 0, 0, 0] }, (p) =>
        p.draw(sh.glyph, { count: 3, textures: { uSegTex: segTex }, uniforms: { uResolution: [w, h], uBaseRadius: state.glyph.baseRadius, uTime: state.glyph.playhead, uNSeg: nSeg, uInkColor: getInkRGB() } }));
    }
    const splashAnim = !state.splash || state.splash.alpha <= 0 || state.splash.grow < 1;
    if (splashAnim || frameCount % STATIC_THROTTLE === 0) {
      const t = tSplash;
      device.pass({ target: t, clear: [0, 0, 0, 0] }, (p) => {
        if (state.splash && state.splash.alpha > 0)
          p.draw(sh.splash, { count: 3, uniforms: { uResolution: [t.width, t.height], uGrow: state.splash.grow, uSpread: state.splash.spread, uAmount: state.splash.amount, uClock: state.splash.time, uInkDark: getSplashHigh(), uInkLight: getSplashLow() } });
      });
    }
    const ensoAnim = !state.enso || state.enso.alpha <= 0 || state.enso.sweep < 1;
    if (ensoAnim || frameCount % STATIC_THROTTLE === 0) {
      const t = tEnso;
      device.pass({ target: t, clear: [0, 0, 0, 0] }, (p) => {
        if (state.enso && state.enso.alpha > 0 && state.enso.sweep > 0)
          p.draw(sh.enso, { count: 3, uniforms: { uResolution: [t.width, t.height], uRadius: state.enso.radius, uSweep: state.enso.sweep, uAngleStart: state.enso.angleStart, uLineWidth: state.enso.lineWidth, uInkColor: getInkRGB() } });
      });
    }
    device.pass({ target: tInk, clear: [0, 0, 0, 0] }, (p) => {
      if (state.opacity.inkDragon <= 0) return;
      const d = state.inkDragon, ws = d.widthScale ?? 1;
      drawStroke(p, d.body, 0.03 * ws, aspect, 1.0, BODY_PARAMS, false, camY);
      if ((d.head.alpha ?? 1) > 0) drawHead(p, d.head, aspect, d.head.alpha ?? 1, camY);
    });

    // Pass B: composite to screen + 3D dragon
    const paper = getPaper();
    device.pass({ target: "screen", clear: paper, depth: true, depthClear: 1 }, (p) => {
      if (state.grid && state.grid.reveal > 0)
        p.draw(sh.grid, { count: 4, uniforms: { uViewProj: vp, uExt: state.grid.ext, uZ: state.grid.z, uStep: state.grid.step, uMinorDiv: state.grid.minorDiv, uOpacity: state.grid.opacity, uReveal: state.grid.reveal, uRevealMinor: state.grid.revealMinor, uInkColor: getInkRGB() } });
      drawFlowers(p, state, vp);
      if (state.splash && state.splash.alpha > 0) compositeQuad(p, tSplash.color, state.splash.alpha, -0.006, vp, aspect, state.splash.stationY || 0);
      if (state.enso && state.enso.alpha > 0) compositeQuad(p, tEnso.color, state.enso.alpha, -0.004, vp, aspect, state.enso.stationY || 0);
      compositeQuad(p, tGlyph.color, state.opacity.glyph, -0.002, vp, aspect, state.glyph.stationY || 0);
      compositeQuad(p, tInk.color, state.opacity.inkDragon, 0.0, vp, aspect, camY);
      if (state.opacity.dragon3d > 0 && dragonCount > 0 && framesT) {
        const d3 = state.dragon3d;
        p.draw(sh.dragon3d, {
          buffers: [dragonPos, dragonNorm], count: dragonCount, textures: { uFrames: framesT },
          uniforms: { uViewProj: vp, uN: d3.frameCount, uPathLen: d3.pathLen, uBodyLen: d3.bodyLen, uHeadOffset: d3.headOffset, uGirth: d3.girth, uOpacity: state.opacity.dragon3d, uLightBoost: 1, uAlbedo: getDragon3d() },
        });
      }
      if (state.debug) drawDebug(p, state, aspect, vp);
    });

    device.endFrame();
  }

  function destroy() {
    tGlyph?.destroy(); tSplash?.destroy(); tEnso?.destroy(); tInk?.destroy();
    segTex?.destroy();
    for (const t of framesTexCache.values()) t.destroy();
    strokePos?.destroy(); strokeUV?.destroy(); strokeIdx?.destroy(); headBuf?.destroy(); flowerInst?.destroy();
    dragonPos?.destroy(); dragonNorm?.destroy();
    for (const b of lineBufs) b.destroy();
    device.destroy();
  }

  return { init, resize, frame, destroy, backend: device.backend };
}
