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

import { clamp, lerp, smooth } from "$lib/math/scalar.js";
import { mulberry32 } from "$lib/math/random.js";
import { orbitPivots, clampExitPivot, relaxTurns, buildSpline, buildOpenSpline } from "$lib/math/curve.js";
import { makeTimeline, createCameraTrack } from "./stage/index.js";
import {
  GLYPH_RADIUS, GRID, GRID_MINOR_DIV, SPLASH_SPREAD, SPLASH_AMOUNT,
  ENSO_R, ENSO_HEAD_R, ENSO_WIDTH, BODY_LEN, HEAD_SIZE, D3, D3_GIRTH, SP3,
  GROW_DUR, ENTRY_GROW_MIN, ENTRY_SIZE_MIN,
  LOOP3_PIVOTS, R3D, Z3D, LOOP3_WAVES, LOOP3_LOBES, LOOP3_LOBE_DEPTH,
  MAX_EXIT_TURN, MIN_TURN, MAX_TURN, MAX_SHARP_RUN, RELAX_ITERS,
  CORRIDOR_DROP, FLYIN_TOP_Y, FLYIN_BOW, ENSO_REVS,
  CRUISE_SP, CHAIN_LEN_FRAC,
} from "./config.js";
import { computeTiming } from "./timing.js";
import { buildGlyph } from "./glyph.js";
import { ensoPos, generateFramePath, buildDescent } from "./frame-path.js";
import { createHeadPath } from "./head-path.js";
import { createBodyController } from "./body.js";
import { createDragon3d } from "./dragon3d.js";
import { createFlowers } from "./flowers.js";
import { sceneViewProj } from "./camera.js";
import { createSplashBlock } from "./blocks/splash.js";
import { createGlyphBlock } from "./blocks/glyph.js";
import { createInkBlock } from "./blocks/ink.js";
import { createEnsoBlock } from "./blocks/enso.js";
import { createDragon3dBlock } from "./blocks/dragon3d.js";
import { createGridBlock } from "./blocks/grid.js";

// Placeholder until initScene runs. +page.svelte imports this (live binding ->
// the reassign in initScene is observed).
export let TIMELINE_END = computeTiming().timelineEnd;

// ---- scene model (built in initScene) --------------------------------------
let timing = null;
let glyph = null;
let curvePath = null;   // 2D roam2 path the 3D dragon transitions off of
let loop3 = null;       // 3D orbit the 3D dragon flies
let headPath = null;    // head phase sequence + samplers
let bodyCtrl = null;    // 2D dragon body controller
let dragon3d = null;    // 3D dragon frame buffers
let flowers = null;     // bloom flowers seated in the path circles
let timeline = null;
let cameraTrack = null; // corridor descent + pitch + yaw gate
let ensoCenter = { x: 0, y: 0 }; // world station of the glyph + enso
let _ctx = null;
let pool = [];          // debug: circle centres (both roams)
let _poolF32 = null;    // cached debug-point buffer

// 2D-dragon grow ramp: small while the dragon reveals + first roam, growing to
// full by the enso. Shared by body length + head/stroke size.
function makeGrow(timing) {
  const g = (t) => smooth(clamp((t - timing.roam1Start) / GROW_DUR, 0, 1));
  return {
    len: (t) => lerp(ENTRY_GROW_MIN, 1.0, g(t)),
    size: (t) => lerp(ENTRY_SIZE_MIN, 1.0, g(t)),
  };
}

// slightly-curved fly-in from the top-middle down onto the corridor middle.
function buildFlyin(topY, endY) {
  return buildOpenSpline([
    { x: 0, y: topY, z: 0 },
    { x: FLYIN_BOW, y: lerp(topY, endY, 0.35), z: 0 },
    { x: -FLYIN_BOW * 0.6, y: lerp(topY, endY, 0.7), z: 0 },
    { x: 0, y: endY, z: 0 },
  ]);
}

export function initScene() {
  glyph = buildGlyph();

  // fresh random paths each load (seeded once -> stable within the session so
  // timeline scrubbing replays the same generated path).
  const rng = mulberry32((Math.random() * 4294967296) >>> 0);

  timing = computeTiming();
  TIMELINE_END = timing.timelineEnd;

  // corridor camera: descends through B1-B3, holds during B4, tilts from B5.
  cameraTrack = createCameraTrack({
    descent: { enabled: true, yTop: 0, yBottom: -CORRIDOR_DROP, startT: timing.flyinStart, endT: timing.descentEnd },
    pitch: { anchorT: timing.pitchAnchor, dur: timing.camPitchDur },
    yaw: { gateStart: timing.d3Start, gateEnd: timing.d3End },
  });
  const camY = cameraTrack.camY;

  // stations (world-Y where each object sits centred when the camera looks at it)
  const topY = camY(timing.flyinStart) + FLYIN_TOP_Y;      // dragon spawn (top-middle)
  const flyinEndY = camY(timing.roam1Start);               // mid-screen at t=roam1Start
  const roam1EndY = camY(timing.approachStart);            // mid-screen at t=approachStart
  ensoCenter = { x: 0, y: camY(timing.ensoStart) };        // glyph + enso station

  // enso entry (top) + exit (bottom after 1.5 revs), with circle tangents.
  const ensoTop = ensoPos(0, ensoCenter);
  const ensoTopNext = ensoPos(1e-3, ensoCenter);
  const ensoTopHeading = Math.atan2(ensoTopNext.y - ensoTop.y, ensoTopNext.x - ensoTop.x);
  const ensoBottom = ensoPos(ENSO_REVS, ensoCenter);
  const ensoBottomNext = ensoPos(ENSO_REVS + 1e-3, ensoCenter);
  const ensoBottomHeading = Math.atan2(ensoBottomNext.y - ensoBottom.y, ensoBottomNext.x - ensoBottom.x);

  // B1 fly-in: top-middle -> mid-screen (slightly bowed line).
  const flyin = buildFlyin(topY, flyinEndY);
  // enter the descent along the fly-in's ACTUAL end tangent (the circle-chain entry
  // tangent equals its heading exactly) -> C1 join.
  const flyinEndTan = flyin.tan(flyin.total);
  const flyinEndHeading = Math.atan2(flyinEndTan.y, flyinEndTan.x);

  // B2+B3 descent: ONE path = a descending circle-chain (fuller, lateral traces)
  // then a C1 connector onto the enso TOP. Traversed at one continuous (cubic-eased)
  // speed in head-path -> no crawl, no kink, and no speed bump leaving the fly-in,
  // between circles, or entering the enso. The dragon stays near mid-screen the whole
  // descent (the camera tracks it). The glyph reveals independently underneath — the
  // dragon does NOT trace it.
  void roam1EndY;
  // length target: make the weave long enough that descentAvg (= len/descentDur)
  // approaches CRUISE_SP, so the head enters the descent at a healthy speed (no
  // start crawl) instead of being forced to crawl up from near-zero.
  const descentDur = timing.ensoStart - timing.roam1Start;
  const descentLenTarget = CRUISE_SP * descentDur * CHAIN_LEN_FRAC;
  const descent = buildDescent(
    rng, { x: 0, y: flyinEndY }, flyinEndHeading, ensoTop, ensoTopHeading,
    flyinEndY - (ensoCenter.y + ENSO_HEAD_R), descentLenTarget,
  );

  // B5 roam2: a flower of tangent circles centred on the enso station; the camera
  // is held here so the dragon roams near mid-screen as it hands off to 3D. The
  // head traverses only the first SP3*roamDur arc of the flower at constant SP3 so
  // it (a) matches the 3D loop speed -> no jump at the handoff and (b) shares the
  // exact curve position with the 3D dragon through the crossfade.
  const roam2 = generateFramePath(rng, ensoBottom, ensoBottomHeading, ensoCenter);
  const roamDur = timing.loop3Start - timing.ensoExit;
  const branchArc = (roam2.curve.headStart || 0) + SP3 * roamDur;
  roam2.curve.headEnd = branchArc; // head ends here at loop3Start (the 3D loop start)
  curvePath = roam2.curve;
  pool = [...descent.pool, ...roam2.pool];
  _poolF32 = null;

  // scene model (closes over the now-final paths + schedule)
  const paths = { flyin, descent, roam2, ensoCenter };
  headPath = createHeadPath({ timing, paths });
  bodyCtrl = createBodyController({ headPath, timing });

  // bloom flowers: one per descent-chain circle (NOT the roam2 rosette around the
  // enso — that stays clean). Enter-times are precomputed off headPath.
  flowers = createFlowers({
    headPath, timing,
    circles: descent.pool,
  });

  // loop3: a clean 3D orbit ringing the roam2 flower, centred on the enso station,
  // starting at the roam2 branch point (where the 2D head ends == 3D loop begins).
  const bp = curvePath.pos(branchArc);
  const tb = curvePath.tan(branchArc);
  const bpA = Math.atan2(bp.y - ensoCenter.y, bp.x - ensoCenter.x);
  const rest = orbitPivots(LOOP3_PIVOTS, R3D, Z3D, LOOP3_WAVES, bpA, LOOP3_LOBES, LOOP3_LOBE_DEPTH)
    .map((p) => ({ x: p.x + ensoCenter.x, y: p.y + ensoCenter.y, z: p.z })); // recentre on the station
  clampExitPivot(rest, { x: bp.x, y: bp.y, dir: { x: tb.x, y: tb.y } }, MAX_EXIT_TURN);
  const ring3 = [{ x: bp.x, y: bp.y, z: 0 }, ...rest];
  relaxTurns(ring3, MIN_TURN, MAX_TURN, MAX_SHARP_RUN, (i) => i >= 1, RELAX_ITERS);
  loop3 = buildSpline(ring3);

  dragon3d = createDragon3d({ timing });
  dragon3d.build(loop3, curvePath);

  // blocks + timeline, built AFTER timing so branch points are real numbers. Each
  // block is an independent unit; deps are passed explicitly. The camera is a
  // first-class track (cameraTrack), not a block.
  const deps = { timing, glyph, bodyCtrl, headPath, grow: makeGrow(timing) };
  const blocks = [
    createSplashBlock(deps),
    createGridBlock(deps),
    createInkBlock(deps),
    createGlyphBlock(deps),
    createEnsoBlock(deps),
    createDragon3dBlock(deps),
  ];
  timeline = makeTimeline(blocks);
  _ctx = timeline.createCtx({ t: 0 });

  // seed body fitted to the path at the dragon's start (short, on the fly-in)
  bodyCtrl.reseed(timing.flyinStart, BODY_LEN * ENTRY_GROW_MIN);
}

// ---- reused frame-state scratch (zero per-frame allocation) ----------------
// buildState mutates these in place and returns _frame; the renderer consumes it
// synchronously, so a single instance avoids minting ~15 short-lived objects per
// frame (no GC hitch on the infinite 3D loop). Constant fields are set once here.
const EMPTY_F32 = new Float32Array(0);
const _frame = {
  aspect: 1,
  camY: 0,  // corridor look-at world-Y (0 = stationary)
  opacity: { glyph: 1, inkDragon: 0, dragon3d: 0 },
  grid: { opacity: 0, reveal: 0, revealMinor: 0, viewProj: null, ext: GRID.ext, z: GRID.z, step: GRID.step, minorDiv: GRID_MINOR_DIV },
  glyph: { segs: null, playhead: 1, baseRadius: GLYPH_RADIUS, stationY: 0 },
  splash: { alpha: 0, grow: 0, spread: SPLASH_SPREAD, amount: SPLASH_AMOUNT, time: 0, stationY: 0 },
  enso: { alpha: 0, sweep: 0, radius: ENSO_R, lineWidth: ENSO_WIDTH, angleStart: 0, time: 0, stationY: 0 },
  flowers: { items: null, count: 0, alpha: 0, viewProj: null },
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
  // corridor camera: descend (camY), tilt (pitch), and gate user yaw in — all from
  // the camera track so the descend->pitch handoff stays in sync.
  const userYaw = cameraTrack.yawGate(t, yaw || 0);
  const camY = cameraTrack.camY(t);
  const viewProj = sceneViewProj(aspect, userYaw, cameraTrack.camPitch(t), camY);

  _frame.aspect = aspect;
  _frame.camY = camY;
  _frame.opacity.glyph = _ctx.glyphAlpha;
  _frame.opacity.inkDragon = _ctx.inkAlpha;
  _frame.opacity.dragon3d = _ctx.d3Alpha;

  const g = _frame.grid;
  g.opacity = _ctx.gridStrength; g.reveal = _ctx.gridReveal; g.revealMinor = _ctx.gridRevealMinor;
  g.viewProj = viewProj;

  _frame.glyph.segs = glyph.segs;
  _frame.glyph.playhead = _ctx.playhead;
  _frame.glyph.stationY = ensoCenter.y; // glyph parked at the enso station

  const sp = _frame.splash;
  sp.alpha = _ctx.splashAlpha; sp.grow = _ctx.splashGrow; sp.time = t;
  sp.stationY = ensoCenter.y; // ink wash parked at the glyph/enso station (bottom of the corridor)

  const en = _frame.enso;
  en.alpha = _ctx.ensoAlpha; en.sweep = _ctx.ensoSweep; en.angleStart = 0; en.time = t;
  en.stationY = ensoCenter.y;

  // bloom flowers: refresh each flower's bloom (pure fn of t) + share the orbit cam
  const fl = flowers.writeState(t);
  _frame.flowers.items = fl.items;
  _frame.flowers.count = fl.count;
  _frame.flowers.alpha = 1;
  _frame.flowers.viewProj = viewProj;

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
