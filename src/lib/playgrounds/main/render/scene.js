// Scene renderer for /main (paint). One screen pass; consumes the plain-data
// FrameState from index.js buildState() — no GPU handles cross that boundary.
import { buildRibbon } from "./stroke-gl.js";
import { createInstancedDrawer } from "$lib/mech/instancing.js";
import { D3_STYLE } from "../config.js";
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
  let segTex;
  let strokePos, strokeUV, strokeIdx, headBuf;
  let mechDrawer;
  let objDragon = null; // legacy obj-mesh dragon, lazy-loaded only for D3_STYLE "obj"

  let segRef = null, segRows = 0, segBuf = new Float32Array(0);
  const headData = new Float32Array(16);
  const lineBufs = [];
  let lineScratch = new Float32Array(0);

  async function init() {
    for (const name in PROGRAMS) sh[name] = device.shader(PROGRAMS[name]);
    segTex = device.texture({ width: 5, height: 1, format: "rgba32f", filter: "nearest" });
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
  }

  // 5 texels/seg; texel 0 = cull header (cen.xy, hullR, t0). Re-upload only on
  // array identity change.
  function uploadSegs(segs) {
    const n = segs ? segs.length : 0;
    if (n === 0) return 0;
    if (segs === segRef && n === segRows) return n;
    segRef = segs;
    const need = n * 20;
    if (segBuf.length < need) segBuf = new Float32Array(need);
    for (let i = 0; i < n; i++) {
      const s = segs[i]; let o = i * 20;
      const cx = (s.p1.x + s.p2.x) * 0.5, cy = (s.p1.y + s.p2.y) * 0.5;
      const hullR = Math.max(Math.hypot(s.p1.x - cx, s.p1.y - cy), Math.hypot(s.ctrl.x - cx, s.ctrl.y - cy));
      segBuf[o++] = cx; segBuf[o++] = cy; segBuf[o++] = hullR; segBuf[o++] = s.t0;
      segBuf[o++] = s.p1.x; segBuf[o++] = s.p1.y; segBuf[o++] = s.p2.x; segBuf[o++] = s.p2.y;
      segBuf[o++] = s.ctrl.x; segBuf[o++] = s.ctrl.y; segBuf[o++] = s.pr1; segBuf[o++] = s.pr2;
      segBuf[o++] = s.k; segBuf[o++] = s.belly; segBuf[o++] = s.dur; segBuf[o++] = 0;
      segBuf[o++] = s.v0; segBuf[o++] = s.v1; segBuf[o++] = 0; segBuf[o++] = 0;
    }
    segTex.write(segBuf.subarray(0, need), 5, n);
    segRows = n;
    return n;
  }

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

  function drawMechDragon(p, d3, opacity, vp) {
    mechDrawer.draw(p, sh.mechDragon, d3.items, d3.meshes, {
      uViewProj: vp, uLightPos: MECH_LIGHT, uViewPos: d3.eye, uOpacity: opacity,
    });
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
  }

  function frame(state) {
    const aspect = state.aspect;
    // drawing-buffer size (the playground host owns canvas sizing + device.resize)
    const w = Math.max(1, canvas.width), h = Math.max(1, canvas.height);
    const nSeg = uploadSegs(state.glyph.segs);
    // WebGPU remaps clip z to [0,1], so route every viewProj through the camera seam
    const vp = device.correctViewProj(state.dragon3d.viewProj);

    device.beginFrame();
    const paper = getPaper();
    device.pass({ clear: paper, depth: true, depthClear: 1 }, (p) => {
      if (state.grid && state.grid.reveal > 0)
        p.draw(sh.grid, { count: 4, uniforms: { uViewProj: vp, uExt: state.grid.ext, uZ: state.grid.z, uStep: state.grid.step, uMinorDiv: state.grid.minorDiv, uOpacity: state.grid.opacity, uReveal: state.grid.reveal, uRevealMinor: state.grid.revealMinor, uInkColor: getInkRGB() } });
      if (state.enso && state.enso.alpha > 0 && state.enso.sweep > 0) {
        // quad half-extent = wash reach (shader zeroes past radius + lineWidth
        // + 0.45); uAspect is the quad's world half-width, clamped >=1 so
        // portrait screens never slice the ring
        const ensoExt = state.enso.radius + state.enso.lineWidth + 0.5;
        p.draw(sh.enso, { count: 4, uniforms: {
          uViewProj: vp, uOpacity: state.enso.alpha, uAspect: Math.max(aspect, 1), uZ: -0.004, uStationY: state.enso.stationY || 0, uExt: ensoExt,
          uResolution: [w, h], uRadius: state.enso.radius, uSweep: state.enso.sweep, uAngleStart: state.enso.angleStart, uLineWidth: state.enso.lineWidth, uInkColor: getInkRGB(),
        } });
      }
      if (nSeg > 0 && state.opacity.glyph > 0)
        p.draw(sh.glyph, { count: 4, textures: { uSegTex: segTex }, uniforms: {
          uViewProj: vp, uOpacity: state.opacity.glyph, uAspect: aspect, uZ: -0.002, uStationY: state.glyph.stationY || 0, uExt: 1,
          uResolution: [w, h], uBaseRadius: state.glyph.baseRadius, uTime: state.glyph.playhead, uNSeg: nSeg, uInkColor: getInkRGB(),
        } });
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
    segTex?.destroy();
    strokePos?.destroy(); strokeUV?.destroy(); strokeIdx?.destroy(); headBuf?.destroy();
    objDragon?.destroy(); objDragon = null;
    mechDrawer?.destroy();
    for (const b of lineBufs) b.destroy();
  }

  return { init, frame, destroy, backend: device.backend };
}
