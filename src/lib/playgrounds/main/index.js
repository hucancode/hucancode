// Backend-agnostic scene for /paint: builds paths + schedule, constructs blocks,
// wires timeline. Everything on ONE ground plane (x/y); camera looks straight
// DOWN during glyph trace, then tilts to 45deg as 2D hands off to 3D.

import { clamp, lerp, smooth } from "$lib/math/scalar.js";
import { mulberry32 } from "$lib/math/random.js";
import { buildOpenSpline, arcLengthCurve } from "$lib/math/curve.js";
import { makeTimeline, createCameraTrack } from "./stage/index.js";
import {
  GLYPH_RADIUS, GRID, GRID_MINOR_DIV, SPLASH_SPREAD, SPLASH_AMOUNT,
  ENSO_R, ENSO_HEAD_R, ENSO_WIDTH, BODY_LEN, HEAD_SIZE, D3, D3_GIRTH, SP3,
  GROW_DUR, ENTRY_GROW_MIN, ENTRY_SIZE_MIN,
  LOOP3_CIRCLES, R3D, Z3D, LOOP3_WAVES,
  CORRIDOR_DROP, FLYIN_TOP_Y, FLYIN_BOW, ENSO_REVS,
  CRUISE_SP, CHAIN_LEN_FRAC, CAM,
} from "./config.js";
import { computeTiming } from "./timing.js";
import { buildGlyph } from "./glyph.js";
import { ensoPos, generateFramePath, buildDescent, generateOrbit3d } from "./frame-path.js";
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

// placeholder until initScene runs. +page.svelte imports this (live binding ->
// reassign in initScene observed).
export let TIMELINE_END = computeTiming().timelineEnd;

let timing = null;
let glyph = null;
let curvePath = null;   // 2D roam2 path 3D dragon transitions off of
let loop3 = null;       // 3D orbit 3D dragon flies
let conn3 = null;       // connector spur: 2D branch point -> ring entry
let headPath = null;    // head phase sequence + samplers
let bodyCtrl = null;    // 2D dragon body controller
let dragon3d = null;    // 3D dragon frame buffers
let flowers = null;     // bloom flowers seated in path circles
let timeline = null;
let cameraTrack = null; // corridor descent + pitch + yaw gate
let ensoCenter = { x: 0, y: 0 }; // world station of glyph + enso
let _ctx = null;
let pool = [];          // debug: circle centres (both roams)
let _poolF32 = null;    // cached debug-point buffer

// 2D-dragon grow ramp: small while dragon reveals + first roam, full by enso.
// shared by body length + head/stroke size.
function makeGrow(timing) {
  const g = (t) => smooth(clamp((t - timing.roam1Start) / GROW_DUR, 0, 1));
  return {
    len: (t) => lerp(ENTRY_GROW_MIN, 1.0, g(t)),
    size: (t) => lerp(ENTRY_SIZE_MIN, 1.0, g(t)),
  };
}

// slightly-curved fly-in from top-middle down onto corridor middle
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

  // fresh random paths each load (seeded once -> stable within session so
  // timeline scrubbing replays same generated path)
  const rng = mulberry32((Math.random() * 4294967296) >>> 0);

  timing = computeTiming();
  TIMELINE_END = timing.timelineEnd;

  // corridor camera: descends through B1-B3, holds during B4, tilts from B5
  cameraTrack = createCameraTrack({
    descent: { enabled: true, yTop: 0, yBottom: -CORRIDOR_DROP, startT: timing.flyinStart, endT: timing.descentEnd },
    pitch: { anchorT: timing.pitchAnchor, dur: timing.camPitchDur },
    yaw: { gateStart: timing.d3Start, gateEnd: timing.d3End },
  });
  const camY = cameraTrack.camY;

  // stations: world-Y where each object sits centred when camera looks at it
  const topY = camY(timing.flyinStart) + FLYIN_TOP_Y;      // dragon spawn (top-middle)
  const flyinEndY = camY(timing.roam1Start);               // mid-screen at t=roam1Start
  const roam1EndY = camY(timing.approachStart);            // mid-screen at t=approachStart
  ensoCenter = { x: 0, y: camY(timing.ensoStart) };        // glyph + enso station

  // enso entry (top) + exit (bottom after 1.5 revs), with circle tangents
  const ensoTop = ensoPos(0, ensoCenter);
  const ensoTopNext = ensoPos(1e-3, ensoCenter);
  const ensoTopHeading = Math.atan2(ensoTopNext.y - ensoTop.y, ensoTopNext.x - ensoTop.x);
  const ensoBottom = ensoPos(ENSO_REVS, ensoCenter);
  const ensoBottomNext = ensoPos(ENSO_REVS + 1e-3, ensoCenter);
  const ensoBottomHeading = Math.atan2(ensoBottomNext.y - ensoBottom.y, ensoBottomNext.x - ensoBottom.x);

  // B1 fly-in: top-middle -> mid-screen (slightly bowed line)
  const flyin = buildFlyin(topY, flyinEndY);
  // enter descent along fly-in's actual end tangent (circle-chain entry tangent
  // equals its heading exactly) -> C1 join
  const flyinEndTan = flyin.tan(flyin.total);
  const flyinEndHeading = Math.atan2(flyinEndTan.y, flyinEndTan.x);

  // B2+B3 descent: ONE path = descending circle-chain then C1 connector onto enso
  // top. Traversed at one continuous (cubic-eased) speed in head-path -> no crawl,
  // no kink, no speed bump leaving fly-in, between circles, or entering enso.
  // glyph reveals independently underneath; dragon does NOT trace it.
  void roam1EndY;
  // length target: make weave long enough that descentAvg (= len/descentDur)
  // approaches CRUISE_SP -> head enters descent at healthy speed (no start crawl)
  // instead of crawling up from near-zero
  const descentDur = timing.ensoStart - timing.roam1Start;
  const descentLenTarget = CRUISE_SP * descentDur * CHAIN_LEN_FRAC;
  const descent = buildDescent(
    rng, { x: 0, y: flyinEndY }, flyinEndHeading, ensoTop, ensoTopHeading,
    flyinEndY - (ensoCenter.y + ENSO_HEAD_R), descentLenTarget,
  );

  // B5 roam2: flower of tangent circles centred on enso station; camera held here
  // so dragon roams near mid-screen as it hands off to 3D. head traverses only
  // first SP3*roamDur arc of flower at constant SP3 so it (a) matches 3D loop speed
  // -> no jump at handoff and (b) shares exact curve position with 3D dragon
  // through crossfade.
  const roam2 = generateFramePath(rng, ensoBottom, ensoBottomHeading, ensoCenter);
  const roamDur = timing.loop3Start - timing.ensoExit;
  const branchArc = (roam2.curve.headStart || 0) + SP3 * roamDur;
  roam2.curve.headEnd = branchArc; // head ends here at loop3Start (3D loop start)
  curvePath = roam2.curve;
  pool = [...descent.pool, ...roam2.pool];
  _poolF32 = null;

  const paths = { flyin, descent, roam2, ensoCenter };
  headPath = createHeadPath({ timing, paths });
  bodyCtrl = createBodyController({ headPath, timing });

  // bloom flowers: one per descent-chain circle (NOT roam2 rosette around enso,
  // that stays clean). enter-times precomputed off headPath.
  flowers = createFlowers({
    headPath, timing,
    circles: descent.pool,
  });

  // loop3: closed 3D circle-weave orbit (generateOrbit3d — built from tangent
  // circles the way the 2D paths are) centred on the enso station. A PURE
  // closed loop — inserting the branch point into the loop (old design) dents
  // it into a hairpin the dragon hits every lap (measured 87deg turn at the
  // seam). The dragon instead reaches the loop over a dedicated CONNECTOR
  // spur, ridden once.
  const bp = curvePath.pos(branchArc);
  const tb = curvePath.tan(branchArc);
  const bpA = Math.atan2(bp.y - ensoCenter.y, bp.x - ensoCenter.x);
  // preferred winding follows the 2D exit tangent (else the connector tends
  // to U-turn onto the loop) — but the weave crosses its centre-ring radially
  // at the entry tangency, so BOTH windings go into the candidate search
  const winding = (bp.x - ensoCenter.x) * tb.y - (bp.y - ensoCenter.y) * tb.x >= 0 ? 1 : -1;
  // connector: cubic HERMITE from the 2D branch point onto the ring entry —
  // exact tangent match at BOTH ends (the ring climbs at its entry, so its
  // actual 3D tangent is used), no interior control points to wiggle around.
  // Some branch geometries hook the connector for a given entry angle, so try
  // a few entry offsets and keep the one whose connector turns the least.
  const hermite = (ring0, rt0) => {
    const span3 = Math.hypot(ring0.x - bp.x, ring0.y - bp.y, ring0.z || 0);
    if (span3 < 0.25) return { hp: null, worst: Infinity }; // degenerate: entry on top of bp
    const hL = Math.max(0.8, 1.15 * span3);         // tangent magnitude ~ span (wider spreads the turn)
    const hp = new Array(49);
    for (let i = 0; i <= 48; i++) {
      const s = i / 48, s2 = s * s, s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s;
      const h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      hp[i] = {
        x: h00 * bp.x + h10 * hL * tb.x + h01 * ring0.x + h11 * hL * rt0.x,
        y: h00 * bp.y + h10 * hL * tb.y + h01 * ring0.y + h11 * hL * rt0.y,
        z: h01 * ring0.z + h11 * hL * rt0.z,        // 2D side is planar (z=0)
      };
    }
    // score by ARC-uniform tangent turn (parameter-uniform polyline angles hide
    // cusps where the Hermite speed collapses)
    const c = arcLengthCurve(hp, false);
    let worst = 0;
    const st = c.total / 60;
    for (let s = 0; s < c.total - st; s += st) {
      const a = c.tan(s), b = c.tan(s + st);
      const dot = a.x * b.x + a.y * b.y + a.z * b.z;
      worst = Math.max(worst, Math.acos(Math.min(1, Math.max(-1, dot))));
    }
    return { hp, worst };
  };
  // the weave crosses its centre-ring RADIALLY at every tangency, so entering
  // AT a tangency often forces a ~90deg connector hook. Instead the entry may
  // land ANYWHERE on the loop: search arc offsets (x both windings) for the
  // tamest connector, then re-anchor the loop's s=0 at the winning offset.
  const rot = bpA + Math.PI / LOOP3_CIRCLES; // anchor a tangency at the branch angle
  let best = null;
  for (const w of [winding, -winding]) {
    const pts = generateOrbit3d(ensoCenter, LOOP3_CIRCLES, R3D, Z3D, LOOP3_WAVES, rot, w < 0);
    const spline = arcLengthCurve(pts, true);
    for (let j = 0; j < 48; j++) {
      const s0 = (j / 48) * spline.total;
      const cand = hermite(spline.pos(s0), spline.tan(s0));
      if (cand.hp && (!best || cand.worst < best.worst)) best = { spline, s0, hp: cand.hp, worst: cand.worst };
    }
  }
  const bs = best.spline, bs0 = best.s0;
  loop3 = { total: bs.total, pos: (s) => bs.pos(s + bs0), tan: (s) => bs.tan(s + bs0) };
  conn3 = arcLengthCurve(best.hp, false);

  dragon3d = createDragon3d({ timing });
  dragon3d.build(loop3, curvePath, conn3);

  // blocks + timeline, built AFTER timing so branch points are real numbers. each
  // block independent; deps passed explicitly. camera is a first-class track
  // (cameraTrack), not a block.
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

  // seed body fitted to path at dragon's start (short, on fly-in)
  bodyCtrl.reseed(timing.flyinStart, BODY_LEN * ENTRY_GROW_MIN);
}

// reused frame-state scratch: buildState mutates in place and returns _frame
// (renderer consumes synchronously) -> zero per-frame allocation.
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
  dragon3d: {
    frames: null, frameCount: D3.N, pathLen: 1, bodyLen: BODY_LEN * D3.bodyFactor, headOffset: 0, girth: D3_GIRTH, // legacy obj mesh
    items: null, meshes: null, eye: [0, 0, CAM.dist], // mech rig instances + camera pos (specular)
    viewProj: null, time: 0,
  },
  debug: { show: false, buffer: "none", path2d: EMPTY_F32, path3d: EMPTY_F32, pool: EMPTY_F32 },
};

// Build FrameState for scene time t. debug adds path polylines; yaw = user orbit
// heading (pitch scripted by camera block). Runs timeline (each block restores
// defaults then updates), then assembles _frame in place.
export function buildState(t, aspect, debug = {}, yaw = 0, debugBuffer = "none") {
  _ctx.t = t;
  timeline.frame(_ctx, t);

  bodyCtrl.writeHead(_frame.inkDragon.head, headPath.tipAt(t).dir); // align head to path tangent
  // corridor camera: descend (camY), tilt (pitch), gate user yaw in; all from
  // camera track so descend->pitch handoff stays in sync
  const userYaw = cameraTrack.yawGate(t, yaw || 0);
  const camY = cameraTrack.camY(t);
  const camPitch = cameraTrack.camPitch(t);
  const viewProj = sceneViewProj(aspect, userYaw, camPitch, camY);

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
  _frame.glyph.stationY = ensoCenter.y; // glyph parked at enso station

  const sp = _frame.splash;
  sp.alpha = _ctx.splashAlpha; sp.grow = _ctx.splashGrow; sp.time = t;
  sp.stationY = ensoCenter.y; // ink wash parked at glyph/enso station (corridor bottom)

  const en = _frame.enso;
  en.alpha = _ctx.ensoAlpha; en.sweep = _ctx.ensoSweep; en.angleStart = 0; en.time = t;
  en.stationY = ensoCenter.y;

  // bloom flowers: refresh each flower's bloom (pure fn of t) + share orbit cam
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

  // camera world position (inverse of sceneViewProj's view chain) for specular
  const vy = CAM.dist * Math.sin(camPitch), vz = CAM.dist * Math.cos(camPitch);
  const eye = _frame.dragon3d.eye;
  eye[0] = vy * Math.sin(userYaw);
  eye[1] = vy * Math.cos(userYaw) + camY;
  eye[2] = vz;
  dragon3d.writeState(_frame.dragon3d, t, viewProj, _ctx.d3Alpha);
  buildDebugState(t, debug, debugBuffer);
  return _frame;
}

// Debug overlay state: sampled 2D/3D path polylines + rosette circle centres.
// debug-only path arrays still allocate (off in production).
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

// test/debug access to the built ride paths (headless continuity probes)
export function debugPaths() {
  return { loop3, curvePath, conn3, timing };
}

// Circle centres as xyz triples (static; built once from roam pool).
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
