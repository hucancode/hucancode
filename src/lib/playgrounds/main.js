// Backend-agnostic scene for /paint.
//
// Owns the cinematic timeline, the scripted flight path (glyph -> enso -> rosette
// roam -> 3D loop), the 2D ink-dragon body, and the 3D dragon path frames. Produces
// a plain FrameState (see render/renderer.js) each frame; performs zero GPU calls
// so any backend can render it.
//
// Everything lives on ONE ground plane (the internal x/y plane). The camera looks
// straight DOWN at it during the glyph trace, then tilts to a 45deg elevation as
// the 2D dragon hands off to the 3D dragon; the ground grid wipes in radially after
// the 2D dragon is gone.
//
// This file is just WIRING. The pieces are independent modules:
//   paint/config.js        static tunables
//   paint/timing.js        the schedule (computed once the roam path length is known)
//   paint/glyph.js         baked symbol + pen sampler
//   paint/frame-path.js    enso / lead-in / rosette / enso-branch builders
//   paint/head-path.js     the head's phase sequence + global samplers
//   paint/body.js          the 2D dragon body controller
//   paint/dragon3d.js      the 3D dragon frame buffers
//   paint/camera.js        the view-proj
//   paint/blocks/*.js      one timeline block each (developed independently)
//   math/curve.js, math/random.js, math/mat4.js, math/scalar.js
// initScene builds the paths + schedule, then constructs the blocks (so their
// branch points are real numbers, not placeholders) and wires the timeline.

import { clamp, lerp, smooth, ramp } from "$lib/math/scalar.js";
import { mulberry32 } from "$lib/math/random.js";
import { orbitPivots, clampExitPivot, relaxTurns, buildSpline } from "$lib/math/curve.js";
import { makeTimeline } from "./timeline.js";
import {
  GLYPH_RADIUS, GRID, GRID_MINOR_DIV, SPLASH_SPREAD, SPLASH_AMOUNT,
  ENSO_R, ENSO_WIDTH, BODY_LEN, HEAD_SIZE, D3, D3_GIRTH, SP2,
  GROW_DUR, ENTRY_GROW_MIN, ENTRY_SIZE_MIN,
  LOOP3_PIVOTS, R3D, Z3D, LOOP3_WAVES, LOOP3_LOBES, LOOP3_LOBE_DEPTH,
  MAX_EXIT_TURN, MIN_TURN, MAX_TURN, MAX_SHARP_RUN, RELAX_ITERS,
} from "./main/config.js";
import { computeTiming } from "./main/timing.js";
import { buildGlyph } from "./main/glyph.js";
import { ensoPos, ensoA0, generateFramePath, buildEnsoLeadIn } from "./main/frame-path.js";
import { createHeadPath } from "./main/head-path.js";
import { createBodyController } from "./main/body.js";
import { createDragon3d } from "./main/dragon3d.js";
import { sceneViewProj } from "./main/camera.js";
import { createSplashBlock } from "./main/blocks/splash.js";
import { createGlyphBlock } from "./main/blocks/glyph.js";
import { createInkBlock } from "./main/blocks/ink.js";
import { createEnsoBlock } from "./main/blocks/enso.js";
import { createCameraBlock } from "./main/blocks/camera.js";
import { createDragon3dBlock } from "./main/blocks/dragon3d.js";
import { createGridBlock } from "./main/blocks/grid.js";

// Placeholder until initScene runs with the real roam-path length. +page.svelte
// imports this (live binding -> the reassign in initScene is observed).
export let TIMELINE_END = computeTiming(6.0).timelineEnd;

// ---- scene model (built in initScene) --------------------------------------
let timing = null;
let glyph = null;
let curvePath = null;   // 2D roam spline the ink dragon follows
let ensoLeadIn = null;  // short branch from the glyph end onto the enso circle
let loop3 = null;       // 3D orbit the 3D dragon flies
let headPath = null;    // head phase sequence + samplers
let bodyCtrl = null;    // 2D dragon body controller
let dragon3d = null;    // 3D dragon frame buffers
let timeline = null;
let _ctx = null;
let pool = [];          // debug: rosette circle centres
let _poolF32 = null;    // cached debug-point buffer

// 2D-dragon grow ramp: small + short while tracing the glyph, growing up after it
// leaves the glyph onto the enso. Shared by body length + head/stroke size.
function makeGrow(timing) {
  const g = (t) => smooth(clamp((t - timing.glyphEnd) / GROW_DUR, 0, 1));
  // caps at 0.8 after the glyph trace (0.8x full size in the enso + 2D fly phases).
  return {
    len: (t) => lerp(ENTRY_GROW_MIN, t >= timing.glyphEnd ? 0.8 : 1.0, g(t)),
    size: (t) => lerp(ENTRY_SIZE_MIN, t >= timing.glyphEnd ? 0.8 : 1.0, g(t)),
  };
}

export function initScene() {
  glyph = buildGlyph();

  // fresh random paths each load (seeded once -> stable within the session so
  // timeline scrubbing replays the same generated path).
  const rng = mulberry32((Math.random() * 4294967296) >>> 0);

  // branch off the glyph end onto the enso circle with a C curve (tangent-matched
  // to the glyph heading in and the circle tangent out) -> smooth, no snap.
  const ensoStart = ensoPos(0);
  const ensoStartNext = ensoPos(1e-3);
  const ensoStartHeading = Math.atan2(ensoStartNext.y - ensoStart.y, ensoStartNext.x - ensoStart.x);
  ensoLeadIn = buildEnsoLeadIn(
    { x: glyph.end.x, y: glyph.end.y }, Math.atan2(glyph.end.dir.y, glyph.end.dir.x),
    ensoStart, ensoStartHeading,
  );

  // curve roam: the head leaves the enso at its exit (== enso start point, frac=1)
  // along the enso tangent, then flies the circle-chain path.
  const ensoExit = ensoPos(1);
  const ensoNext = ensoPos(1 + 1e-3);
  const ensoHeading = Math.atan2(ensoNext.y - ensoExit.y, ensoNext.x - ensoExit.x);
  const framePath = generateFramePath(rng, ensoExit, ensoHeading);
  curvePath = framePath.curve;
  pool = framePath.pool;
  _poolF32 = null;

  // the schedule depends on the actual roam length, so roam speed == SP2 exactly
  const curveDur = (curvePath.total - curvePath.headStart) / SP2;
  timing = computeTiming(curveDur);
  TIMELINE_END = timing.timelineEnd;

  // loop3: a clean 3D orbit ringing the rosette, starting at the branch point bp.
  // Seeded at bp's angle so its first pivot sits roughly along the exit; clampExit
  // pins the peel-off tangent to the 2D heading; relaxTurns shapes the ring.
  const branchS = curvePath.total;
  const bp = curvePath.pos(branchS);
  const tb = curvePath.tan(branchS); // 2D heading at the branch point
  const bpA = Math.atan2(bp.y, bp.x);
  const rest = orbitPivots(LOOP3_PIVOTS, R3D, Z3D, LOOP3_WAVES, bpA, LOOP3_LOBES, LOOP3_LOBE_DEPTH);
  clampExitPivot(rest, { x: bp.x, y: bp.y, dir: { x: tb.x, y: tb.y } }, MAX_EXIT_TURN);
  const ring3 = [{ x: bp.x, y: bp.y, z: 0 }, ...rest];
  relaxTurns(ring3, MIN_TURN, MAX_TURN, MAX_SHARP_RUN, (i) => i >= 1, RELAX_ITERS); // pin the branch anchor
  loop3 = buildSpline(ring3);

  // scene model (closes over the now-final paths + schedule)
  headPath = createHeadPath({ timing, glyph, ensoLeadIn, curvePath });
  bodyCtrl = createBodyController({ headPath, timing });
  dragon3d = createDragon3d({ timing });
  dragon3d.build(loop3, curvePath);

  // blocks + timeline, built AFTER timing so branch points are real numbers (no
  // placeholders, no post-construction patching). Each block is an independent
  // unit; deps are passed explicitly.
  const deps = { timing, glyph, bodyCtrl, headPath, grow: makeGrow(timing) };
  const blocks = [
    createSplashBlock(deps),
    createGlyphBlock(deps),
    createInkBlock(deps),
    createEnsoBlock(deps),
    createCameraBlock(deps),
    createDragon3dBlock(deps),
    createGridBlock(deps),
  ];
  timeline = makeTimeline(blocks);
  _ctx = timeline.createCtx({ t: 0 });

  // seed body fitted to the path at the dragon's start (short, on the lead-in)
  bodyCtrl.reseed(timing.dragonStart, BODY_LEN * ENTRY_GROW_MIN);
}

// ---- reused frame-state scratch (zero per-frame allocation) ----------------
// buildState mutates these in place and returns _frame; the renderer consumes it
// synchronously, so a single instance avoids minting ~15 short-lived objects per
// frame (no GC hitch on the infinite 3D loop). Constant fields are set once here.
const EMPTY_F32 = new Float32Array(0);
const _frame = {
  aspect: 1,
  opacity: { glyph: 1, inkDragon: 0, dragon3d: 0 },
  grid: { opacity: 0, reveal: 0, revealMinor: 0, viewProj: null, ext: GRID.ext, z: GRID.z, step: GRID.step, minorDiv: GRID_MINOR_DIV },
  glyph: { segs: null, playhead: 1, baseRadius: GLYPH_RADIUS },
  splash: { alpha: 0, grow: 0, spread: SPLASH_SPREAD, amount: SPLASH_AMOUNT, time: 0 },
  enso: { alpha: 0, sweep: 0, radius: ENSO_R, lineWidth: ENSO_WIDTH, angleStart: 0, time: 0 },
  inkDragon: {
    body: null,
    head: { pos: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, size: HEAD_SIZE, alpha: 1 },
    widthScale: 1,
  },
  dragon3d: { frames: null, frameCount: D3.N, pathLen: 1, bodyLen: BODY_LEN * D3.bodyFactor, headOffset: 0, girth: D3_GIRTH, viewProj: null, time: 0 },
  debug: { show: false, buffer: "none", path2d: EMPTY_F32, path3d: EMPTY_F32, pool: EMPTY_F32 },
};

// Build the FrameState for scene time t. debug adds path polylines; yaw is the
// user orbit heading (pitch is scripted by the camera block). Runs the timeline
// (each block restores its defaults then updates), then assembles _frame in place.
export function buildState(t, aspect, debug = {}, yaw = 0, debugBuffer = "none") {
  _ctx.t = t;
  timeline.frame(_ctx, t);

  bodyCtrl.writeHead(_frame.inkDragon.head, headPath.tipAt(t).dir); // align head to the path tangent
  // user yaw locked to 0 during the 2D phase; lerps in over the crossfade (no snap)
  const rawYaw = yaw || 0;
  const userYaw = t < timing.branch ? 0 : ramp(t, timing.d3Start, timing.d3End, 0, rawYaw);
  const viewProj = sceneViewProj(aspect, userYaw, _ctx.camPitch);

  _frame.aspect = aspect;
  _frame.opacity.glyph = _ctx.glyphAlpha;
  _frame.opacity.inkDragon = _ctx.inkAlpha;
  _frame.opacity.dragon3d = _ctx.d3Alpha;

  const g = _frame.grid;
  g.opacity = _ctx.gridStrength; g.reveal = _ctx.gridReveal; g.revealMinor = _ctx.gridRevealMinor;
  g.viewProj = viewProj;

  _frame.glyph.segs = glyph.segs;
  _frame.glyph.playhead = _ctx.playhead;

  const sp = _frame.splash;
  sp.alpha = _ctx.splashAlpha; sp.grow = _ctx.splashGrow; sp.time = t;

  const en = _frame.enso;
  en.alpha = _ctx.ensoAlpha; en.sweep = _ctx.ensoSweep; en.angleStart = Math.PI / 2 - ensoA0; en.time = t;

  const ink = _frame.inkDragon;
  ink.body = bodyCtrl.body;
  ink.head.size = _ctx.headSize;
  ink.head.alpha = _ctx.headAlpha;
  ink.widthScale = _ctx.inkWidthScale;

  dragon3d.writeState(_frame.dragon3d, t, viewProj); // writes _frame.dragon3d
  buildDebugState(t, debug, debugBuffer);            // writes _frame.debug
  return _frame;
}

// Debug overlay state: sampled 2D/3D path polylines + rosette circle centres.
// Written into _frame.debug; the debug-only path arrays still allocate (off in
// production).
function buildDebugState(t, debug, debugBuffer) {
  const d = _frame.debug;
  d.buffer = debugBuffer;
  if (!debug.path2d && !debug.path3d) {
    d.show = false;
    d.path2d = EMPTY_F32; d.path3d = EMPTY_F32; d.pool = EMPTY_F32;
    return;
  }
  d.show = true;
  d.path2d = debug.path2d ? headPath.samplePath2d() : EMPTY_F32;
  d.path3d = debug.path3d ? dragon3d.samplePath3d() : EMPTY_F32;
  d.pool = poolPoints();
}

// Circle centres as xyz triples (static; built once from the roam pool).
function poolPoints() {
  if (_poolF32 && _poolF32.length === pool.length * 3) return _poolF32;
  _poolF32 = new Float32Array(pool.length * 3);
  for (let i = 0; i < pool.length; i++) {
    _poolF32[i * 3] = pool[i].x;
    _poolF32[i * 3 + 1] = pool[i].y;
    _poolF32[i * 3 + 2] = 0;
  }
  return _poolF32;
}
