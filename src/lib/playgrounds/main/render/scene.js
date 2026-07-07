// Scene renderer for /main (paint). Consumes the FrameState built by
// index.js buildState() — plain data, no GPU handles: aspect, camY,
// opacity.{glyph,inkDragon,dragon3d}, grid, glyph{segs,playhead,...},
// enso, inkDragon{body,head,widthScale},
// dragon3d{items,meshes,eye,viewProj + legacy frames/pathLen/... for "obj"},
// debug{show,buffer,path2d,path3d,pool}. Source of truth = buildState().
import { buildRibbon } from "./webgl/stroke-gl.js";
import { createInstancedDrawer } from "$lib/mech/instancing.js";
import { D3_STYLE, ENSO_EXT } from "../config.js";
import { PROGRAMS } from "./programs.js";

// Kanagawa palette (light/dark)
const PAPER_LIGHT = [0.949, 0.925, 0.737, 1.0];
const INK_LIGHT = [0.086, 0.086, 0.114, 0.95];
const PAPER_DARK = [0.086, 0.086, 0.114, 1.0];
const INK_DARK = [0.863, 0.843, 0.729, 0.95];
const DRAGON3D_LIGHT = [0.06, 0.07, 0.10];
const DRAGON3D_DARK = [0.70, 0.68, 0.59];
const _darkMQ = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const isDark = () => !!_darkMQ?.matches;
const getPaper = () => (isDark() ? PAPER_DARK : PAPER_LIGHT);
const getInk = () => (isDark() ? INK_DARK : INK_LIGHT);
const getInkRGB = () => { const c = getInk(); return [c[0], c[1], c[2]]; };
const getDragon3d = () => (isDark() ? DRAGON3D_DARK : DRAGON3D_LIGHT);

// mech dragon: fixed light high above the ground plane (world is z-up)
const MECH_LIGHT = [3.0, -4.0, 6.0];

const HEAD_CORNERS = [[-1.2, -0.8, 0, 0], [1.2, -0.8, 1, 0], [-1.2, 0.8, 0, 1], [1.2, 0.8, 1, 1]];
const BODY_TAIL_W = 0.15;
const BODY_TAPER_SPAN = 0.7;
const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function makeSceneRenderer(device, canvas) {
  const sh = {};
  let tGlyph;
  let segTex;
  let strokePos, strokeUV, strokeIdx, headBuf;
  let mechDrawer;
  let objDragon = null; // legacy obj-mesh dragon, lazy-loaded only for D3_STYLE "obj"
  let w = 1, h = 1;

  let glyphCacheKey = NaN;
  let segRef = null, segRows = 0, segBuf = new Float32Array(0);
  const headData = new Float32Array(16);
  const lineBufs = [];
  let lineScratch = new Float32Array(0);

  async function init() {
    for (const name in PROGRAMS) sh[name] = device.shader(PROGRAMS[name]);
    segTex = device.texture({ width: 4, height: 1, format: "rgba32f", filter: "nearest" });
    strokePos = device.buffer({ kind: "vertex", size: 0, dynamic: true });
    strokeUV = device.buffer({ kind: "vertex", size: 0, dynamic: true });
    strokeIdx = device.buffer({ kind: "index", size: 0, dynamic: true });
    headBuf = device.buffer({ kind: "vertex", size: 64, dynamic: true });
    mechDrawer = createInstancedDrawer(device);
    if (D3_STYLE === "obj")
      import("./obj-dragon.js")
        .then((m) => m.createObjDragon(device))
        .then((o) => { objDragon = o; })
        .catch((e) => console.warn("[paint] obj dragon load failed", e));
    resize(canvas.width || 1, canvas.height || 1);
  }

  function resize(nw, nh) {
    w = Math.max(1, nw | 0); h = Math.max(1, nh | 0);
    device.resize(w, h);
    tGlyph?.destroy();
    tGlyph = device.target({ width: w, height: h });
    glyphCacheKey = NaN; // target recreated -> force glyph re-render
  }

  // pack baked glyph segs into rgba32f data texture (4 texels/seg); upload only when array identity changes
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

  // flat ink body drawn straight to screen: mesh carries the taper (thin tail
  // at arcT 0 -> full width at the head end), fragment fades the tail out
  let _strokeW = 0;
  const bodyWidthAt = (t) => _strokeW * (BODY_TAIL_W + (1 - BODY_TAIL_W) * smooth01(t / BODY_TAPER_SPAN));
  function drawStroke(p, points, lineWidth, opacity, vp) {
    _strokeW = lineWidth;
    const r = buildRibbon(points, lineWidth, bodyWidthAt);
    if (!r) return;
    strokePos.write(r.positions); strokeUV.write(r.uvs); strokeIdx.write(r.indices);
    p.draw(sh.stroke, {
      buffers: [strokePos, strokeUV], index: strokeIdx, count: r.indexCount,
      uniforms: { uViewProj: vp, uOpacity: opacity, uBrushColor: getInk() },
    });
  }

  function drawHead(p, head, opacity, vp) {
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
    p.draw(sh.head, { buffers: [headBuf], count: 4, uniforms: { uViewProj: vp, uOpacity: opacity, uBrushColor: getInk() } });
  }

  // mech dragon: shared instanced drawer (one draw per unit-mesh key, cached
  // vertex buffers, capacity-grown instance buffer rewritten every frame)
  function drawMechDragon(p, d3, opacity, vp) {
    mechDrawer.draw(p, sh.mechDragon, d3.items, d3.meshes, {
      uViewProj: vp, uLightPos: MECH_LIGHT, uViewPos: d3.eye, uOpacity: opacity,
    });
  }

  function compositeQuad(p, color, opacity, z, vp, aspect, stationY, ext = 1) {
    p.draw(sh.composite, { count: 4, textures: { uTex: color }, uniforms: { uViewProj: vp, uOpacity: opacity, uAspect: aspect, uZ: z, uStationY: stationY, uExt: ext } });
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
      const map = { glyph: tGlyph };
      const t = map[state.debug.buffer];
      if (t) p.draw(sh.blit, { count: 3, textures: { uTex: t.color } });
    }
  }

  function frame(state) {
    const aspect = state.aspect;
    const nSeg = uploadSegs(state.glyph.segs);
    // WebGPU remaps clip z to [0,1], so route every viewProj through the camera seam
    const vp = device.correctViewProj(state.dragon3d.viewProj);

    device.beginFrame();

    // Pass A: offscreen glyph layer (cached; re-rendered only when playhead moves)
    if (nSeg > 0 && state.glyph.playhead !== glyphCacheKey) {
      glyphCacheKey = state.glyph.playhead;
      device.pass({ target: tGlyph, clear: [0, 0, 0, 0] }, (p) =>
        p.draw(sh.glyph, { count: 3, textures: { uSegTex: segTex }, uniforms: { uResolution: [w, h], uBaseRadius: state.glyph.baseRadius, uTime: state.glyph.playhead, uNSeg: nSeg, uInkColor: getInkRGB() } }));
    }

    // Pass B: composite to screen + ink dragon + 3D dragon
    const paper = getPaper();
    device.pass({ target: "screen", clear: paper, depth: true, depthClear: 1 }, (p) => {
      if (state.grid && state.grid.reveal > 0)
        p.draw(sh.grid, { count: 4, uniforms: { uViewProj: vp, uExt: state.grid.ext, uZ: state.grid.z, uStep: state.grid.step, uMinorDiv: state.grid.minorDiv, uOpacity: state.grid.opacity, uReveal: state.grid.reveal, uRevealMinor: state.grid.revealMinor, uInkColor: getInkRGB() } });
      if (state.enso && state.enso.alpha > 0 && state.enso.sweep > 0)
        p.draw(sh.enso, { count: 4, uniforms: {
          uViewProj: vp, uOpacity: state.enso.alpha, uAspect: aspect, uZ: -0.004, uStationY: state.enso.stationY || 0, uExt: ENSO_EXT,
          uResolution: [w, h], uRadius: state.enso.radius, uSweep: state.enso.sweep, uAngleStart: state.enso.angleStart, uLineWidth: state.enso.lineWidth, uInkColor: getInkRGB(),
        } });
      compositeQuad(p, tGlyph.color, state.opacity.glyph, -0.002, vp, aspect, state.glyph.stationY || 0);
      if (state.opacity.inkDragon > 0) {
        const d = state.inkDragon, ws = d.widthScale ?? 1;
        drawStroke(p, d.body, 0.03 * ws, state.opacity.inkDragon, vp);
        if ((d.head.alpha ?? 1) > 0) drawHead(p, d.head, (d.head.alpha ?? 1) * state.opacity.inkDragon, vp);
      }
      if (state.opacity.dragon3d > 0 && state.dragon3d.items) {
        // mech dragon transitions in by ASSEMBLING (per-instance alpha from the
        // flight animation), not by fading — draw at full opacity
        drawMechDragon(p, state.dragon3d, 1, vp);
      } else if (state.opacity.dragon3d > 0 && objDragon) {
        objDragon.draw(p, state.dragon3d, state.opacity.dragon3d, vp, getDragon3d());
      }
      if (state.debug) drawDebug(p, state, aspect, vp);
    });

    device.endFrame();
  }

  function destroy() {
    tGlyph?.destroy();
    segTex?.destroy();
    strokePos?.destroy(); strokeUV?.destroy(); strokeIdx?.destroy(); headBuf?.destroy();
    objDragon?.destroy(); objDragon = null;
    mechDrawer?.destroy();
    for (const b of lineBufs) b.destroy();
    device.destroy();
  }

  return { init, resize, frame, destroy, backend: device.backend };
}
