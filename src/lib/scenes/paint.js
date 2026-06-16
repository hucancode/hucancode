// Backend-agnostic scene for /paint.
//
// Owns the cinematic timeline, the scripted flight path (circle -> figure-8),
// the 2D ink-dragon physics, and the 3D dragon path frames. Produces a plain
// FrameState (see render/renderer.js) each frame; performs zero GPU calls so
// any backend can render it.
//
// Everything lives on ONE ground plane (the internal x/y plane). The camera looks
// straight DOWN at it (top-down) during the glyph trace, then tilts to a 45deg
// elevation as the 2D dragon hands off to the 3D dragon; the ground grid wipes in
// radially after the 2D dragon is gone. Out-of-plane internal z is world height.
//
// Timeline (scene clock t, seconds):
//   glyph reveal   0  - 2s    playhead 0 -> glyph duration, then HOLD (no fade)
//   2D dragon      2s - ~10s  enters at the glyph end, traces it, peels onto a loop
//   cam tilt + xfade          camera 90deg->45deg, 2D fades out / 3D fades in
//   grid reveal               radial wipe-in once the 2D dragon is fully gone
//   3D dragon fly             flies its loop alone, forever

import { longSymbol } from "$lib/brush/long.js";
import { bakeSegs } from "$lib/brush/bake.js";
import { makeTimeline } from "./timeline.js";

// ---- small math ------------------------------------------------------------
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// ramp t across [t0,t1] to [a,b], clamped/held outside
function ramp(t, t0, t1, a, b) {
  if (t <= t0) return a;
  if (t >= t1) return b;
  return a + (b - a) * ((t - t0) / (t1 - t0));
}
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (x) => x * x * (3 - 2 * x);

// ---- timeline knobs --------------------------------------------------------
const T = {
  glyphRevealEnd: 2.0,
  dragonStart: 2.0, // dragon enters at the END of the glyph reveal and traces it
  // camera tilt + 2D->3D crossfade + grid reveal are timed off the branch
  // (D3_START/END, CAM_*, GRID_* defined with the flight-path constants below).
};

// ============================================================================
// Flight path - random smooth loops, generated fresh each load.
//   glyph trace  -> 2D random loop (pivots inside a bounding circle, G1) -> after
//   LOOP2_DUR, branch to a 3D random loop (G1) that the 3D dragon flies on.
// Both loops are closed Catmull-Rom splines. Each is a PURE random loop with a
// single anchor pivot at its handoff point and NO copy of the previous path
// grafted in, so neither dragon ever flies back over a transition segment:
//   - loop2 is anchored at the glyph split point (head leaves the glyph there).
//   - loop3 is anchored at the 2D branch point bp; the fading 2D dragon switches
//     ONTO loop3 at the branch so the two overlap during the crossfade.
// See buildSpline / initScene.
// ============================================================================
// Entry: the head first traces glyph strokes #6 then #7 (0-based source stroke
// index, near the glyph's end), then leaves the glyph end onto loop2 (anchored
// at that split point, leaving along the glyph heading within a turn cap).
const ENTRY_STROKE_FIRST = 7; // first traced glyph stroke (0-based source index)
const ENTRY_STROKE_LAST = 7;  // last traced glyph stroke; split at its end
const GLYPH_DUR = 0.8;        // seconds to trace the glyph entry before splitting
const ENTRY_GROW_MIN = 0.3;   // body length fraction during the trace (small + short)
const ENTRY_SIZE_MIN = 0.6;   // body width / head size fraction during the trace
// After the dragon EXITS the glyph (splits onto the loop) it grows up: longer
// body and bigger girth/head, over GROW_DUR.
const GROW_DUR = 2.5;

// Random-loop shape + timing knobs.
const R2D = 1.2;             // 2D loop bounding-circle radius
const R3D = 0.85;            // 3D loop bounding radius (x/y)
const Z3D = 0.6;             // 3D loop out-of-plane amplitude
const LOOP2_PIVOTS = 7;      // random pivots for the 2D loop
const LOOP3_PIVOTS = 8;      // random pivots for the 3D loop
const SP2 = 1.5;             // 2D head speed (path units / sec)
const SP3 = 1.5;            // 3D head speed (path units / sec)
const LOOP2_DUR = 6.0;       // seconds flying the 2D loop before branching to 3D
const CROSSFADE = 1.0;       // 2D->3D crossfade duration
const MAX_EXIT_TURN = Math.PI / 4; // cap on the peel-off turn when the head leaves the glyph onto loop2
const MIN_TURN = Math.PI / 9;      // floor on the turn angle at a pivot (keeps loops from going too straight)
const MAX_TURN = Math.PI / 2;      // angle above which a pivot counts as a "sharp" turn
const MAX_SHARP_RUN = 2;           // a sharp turn is fine, but not N in a row -> relax the Nth
const RELAX_ITERS = 24;            // relaxation passes

const T_GLYPH_END = T.dragonStart + GLYPH_DUR; // glyph entry -> 2D loop
const T_BRANCH = T_GLYPH_END + LOOP2_DUR;      // 2D loop -> 3D loop (+ crossfade)
const D3_START = T_BRANCH;                     // 3D dragon fades in
const D3_END = T_BRANCH + CROSSFADE;           // ...as the 2D ink fades out

// Camera: looks straight down (top-down, pitch 0) through the glyph trace; tilts
// to a 45deg elevation as the 2D dragon fades to the 3D dragon. Yaw stays
// user-controllable (component), pitch is fully scripted here.
const CAM_PITCH_ANGLE = -Math.PI / 4; // straight-down (0) -> 45deg elevation tilt (sign = tilt dir)
// Ground grid reveals AFTER the 2D dragon is fully gone, wiping in radially.
const GRID_REVEAL_DUR = 2.5;
const GRID_MAX_OPACITY = 0.22;
const GRID_MINOR_DIV = 5; // minor cells per major cell (minor step = GRID.step/this)
const GRID_MINOR_LAG = 0.8; // minor grid wipe-in trails the major reveal by this many seconds

// after the 2D->3D branch, leave room to watch the 3D dragon loop on alone.
export const TIMELINE_END = T_BRANCH + 12.0;

// Glyph pen query: where the brush tip is at playhead `ph` (0..glyphTotal),
// plus its heading. Segments are quadratic beziers with a [t0, t0+dur] window in
// playhead time. The 2D dragon head rides this for the entry, "drawing" the
// glyph alongside the reveal, then splits onto the circle.
function glyphStrokeAt(ph) {
  const n = glyphSegs.length;
  if (n === 0) return { x: 0, y: 0, dir: { x: 0, y: 1 } };
  ph = clamp(ph, 0, glyphTotal);
  let s = glyphSegs[n - 1];
  for (let i = 0; i < n; i++) {
    const g = glyphSegs[i];
    if (ph < g.t0 + g.dur) { s = g; break; }
  }
  const u = clamp((ph - s.t0) / (s.dur || 1e-6), 0, 1);
  const p1 = s.p1, c = s.ctrl, p2 = s.p2;
  const v = 1 - u, b0 = v * v, b1 = 2 * v * u, b2 = u * u;
  const x = b0 * p1.x + b1 * c.x + b2 * p2.x;
  const y = b0 * p1.y + b1 * c.y + b2 * p2.y;
  // B'(u) = 2(1-u)(c-p1) + 2u(p2-c)
  let dx = 2 * v * (c.x - p1.x) + 2 * u * (p2.x - c.x);
  let dy = 2 * v * (c.y - p1.y) + 2 * u * (p2.y - c.y);
  const m = Math.hypot(dx, dy) || 1;
  return { x, y, dir: { x: dx / m, y: dy / m } };
}

// ---- random smooth loops (closed Catmull-Rom) ------------------------------
// Deterministic PRNG so the loop is fresh per page load but STABLE within the
// session (seeded once in initScene) -> timeline scrubbing replays the same path.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catmull-Rom through pivots P (closed). u in pivot-index space; component-wise.
function crComp(p0, p1, p2, p3, f) {
  const f2 = f * f, f3 = f2 * f;
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f3);
}
function catmullClosed(P, u) {
  const K = P.length;
  const i = ((Math.floor(u) % K) + K) % K;
  const f = u - Math.floor(u);
  const p0 = P[(i - 1 + K) % K], p1 = P[i], p2 = P[(i + 1) % K], p3 = P[(i + 2) % K];
  return {
    x: crComp(p0.x, p1.x, p2.x, p3.x, f),
    y: crComp(p0.y, p1.y, p2.y, p3.y, f),
    z: crComp(p0.z, p1.z, p2.z, p3.z, f),
  };
}

// Build an arc-length-parameterised closed spline: pos(s)/tan(s) wrap on s, total
// is the loop arc length. Mirrors the dense/cum/posAtArc pattern in buildDragon3dFrames.
function buildSpline(pivots) {
  const K = pivots.length;
  const M = 2048;
  const dense = new Array(M + 1);
  const cum = new Float64Array(M + 1);
  for (let i = 0; i <= M; i++) dense[i] = catmullClosed(pivots, (i / M) * K);
  for (let i = 1; i <= M; i++) {
    const a = dense[i], b = dense[i - 1];
    cum[i] = cum[i - 1] + Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  }
  const total = cum[M] || 1;
  function pos(s) {
    let d = ((s % total) + total) % total;
    let lo = 0, hi = M;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < d) lo = mid + 1; else hi = mid; }
    const i = Math.max(1, lo);
    const seg = cum[i] - cum[i - 1] || 1e-6;
    const k = (d - cum[i - 1]) / seg;
    const a = dense[i - 1], b = dense[i];
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) };
  }
  function tan(s) {
    const e = total * 1e-3;
    const a = pos(s), b = pos(s + e);
    let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const m = Math.hypot(dx, dy, dz) || 1;
    return { x: dx / m, y: dy / m, z: dz / m };
  }
  return { pos, tan, total };
}

// Random pivots on jittered sorted angles, radius kept INSIDE `radius` (so the
// whole loop stays within the bounding circle); z in +-zAmp (0 for a flat loop).
function randomLoopPivots(rng, count, radius, zAmp) {
  const pts = new Array(count);
  for (let k = 0; k < count; k++) {
    const ang = (k / count) * TAU + (rng() - 0.5) * (TAU / count) * 0.8;
    const r = radius * (0.45 + 0.55 * rng());
    pts[k] = { x: r * Math.cos(ang), y: r * Math.sin(ang), z: zAmp ? (rng() * 2 - 1) * zAmp : 0 };
  }
  return pts;
}

let rng = null;            // session PRNG (seeded in initScene)
let loop2 = null;          // 2D random loop (z=0) the ink dragon flies
let loop3 = null;          // 3D random loop the 3D dragon flies
let loop3Phase = 0;        // 3D head arc at T_BRANCH (aligns the branch handoff)

// entry params, resolved once the glyph is baked (see initScene):
//   entryReady   - false if the glyph lacks the requested strokes
//   entryStartPh - playhead where following begins (start of the first stroke)
//   entryEndPh   - playhead where following ends (end of the last stroke)
let entryReady = false;
let entryStartPh = 0;
let entryEndPh = 0;

function resolveEntry() {
  // map source stroke indices -> playhead window (segs are in pen order; a stroke
  // spans one or more segs, with connector segs interleaved between strokes)
  let startPh = Infinity, endPh = -Infinity;
  for (const s of glyphSegs) {
    if (s.connector) continue;
    if (s.stroke === ENTRY_STROKE_FIRST) startPh = Math.min(startPh, s.t0);
    if (s.stroke === ENTRY_STROKE_LAST) endPh = Math.max(endPh, s.t0 + s.dur);
  }
  if (!isFinite(startPh) || !isFinite(endPh) || endPh <= startPh) { entryReady = false; return; }
  entryReady = true;
  entryStartPh = startPh;
  entryEndPh = endPh;
}

// Rotate the first random pivot about the split point so the head's peel-off
// bearing stays within `maxTurn` of the glyph exit heading -> no sharp exit turn.
// (loop2's seam tangent at the split pivot is driven by this first pivot.)
function clampExitPivot(pivots, split, maxTurn) {
  const p = pivots[0];
  const vx = p.x - split.x, vy = p.y - split.y;
  const r = Math.hypot(vx, vy) || 1e-6;
  const heading = Math.atan2(split.dir.y, split.dir.x);
  let diff = Math.atan2(vy, vx) - heading;
  while (diff > Math.PI) diff -= TAU;
  while (diff < -Math.PI) diff += TAU;
  const nb = heading + clamp(diff, -maxTurn, maxTurn);
  pivots[0] = { x: split.x + r * Math.cos(nb), y: split.y + r * Math.sin(nb), z: p.z };
}

// Turn angle at pivot i on a closed ring (angle between the incoming/outgoing legs).
function turnAngle(P, i) {
  const K = P.length;
  const a = P[(i - 1 + K) % K], b = P[i], c = P[(i + 1) % K];
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const vx = c.x - b.x, vy = c.y - b.y, vz = c.z - b.z;
  const ul = Math.hypot(ux, uy, uz) || 1e-6;
  const vl = Math.hypot(vx, vy, vz) || 1e-6;
  return Math.acos(clamp((ux * vx + uy * vy + uz * vz) / (ul * vl), -1, 1));
}

// Shape a closed pivot ring's turn angles. Each pass, for a movable pivot:
//   - too straight (< minTurn)       -> push AWAY from neighbours' midpoint (more bend);
//   - sharp (> maxTurn) AND the Nth   -> pull TOWARD the midpoint (break the run).
//     consecutive sharp turn
// A lone sharp turn is allowed; only the Nth sharp-in-a-row (maxRun) gets relaxed,
// so loops keep some sharp corners without long jagged stretches. In-band pivots
// and isolated sharp turns are left alone. `movable(i)` pins the anchor pivots so
// the glyph + branch handoffs stay continuous. Converges (pushing/relaxing both
// stop once the pivot re-enters its allowed state).
function relaxTurns(P, minTurn, maxTurn, maxRun, movable, iters) {
  const K = P.length;
  for (let it = 0; it < iters; it++) {
    let sharpRun = 0; // consecutive sharp turns walking the ring
    for (let i = 0; i < K; i++) {
      const ang = turnAngle(P, i);
      const sharp = ang > maxTurn;
      sharpRun = sharp ? sharpRun + 1 : 0;
      if (!movable(i)) continue;
      let w = 0;
      if (sharp) {
        if (sharpRun < maxRun) continue;        // lone / sub-run sharp turn is fine
        w = 0.5; sharpRun = 0;                   // Nth in a row -> smooth, break the run
      } else if (ang < minTurn) {
        w = -clamp((minTurn - ang) * 0.6, 0, 0.3); // too straight -> add bend
      } else continue;
      const a = P[(i - 1 + K) % K], b = P[i], c = P[(i + 1) % K];
      const mx = (a.x + c.x) * 0.5, my = (a.y + c.y) * 0.5, mz = (a.z + c.z) * 0.5;
      P[i] = { x: lerp(b.x, mx, w), y: lerp(b.y, my, w), z: lerp(b.z, mz, w) };
    }
  }
}

// Drives the 2D ink-dragon head: glyph trace, then the 2D random loop (arc s).
// loop2 is anchored at the glyph split point (arc 0), so the head leaves the
// glyph end with no position jump; after the branch the head rides loop3.
function pathAt(t) {
  // glyph-follow entry: head rides the glyph pen across strokes #6 and #7,
  // then splits onto the 2D loop at the last stroke's end point.
  if (entryReady && t < T_GLYPH_END) {
    const prog = clamp((t - T.dragonStart) / GLYPH_DUR, 0, 1);
    const ph = lerp(entryStartPh, entryEndPh, prog);
    return { fn: (a) => { const p = glyphStrokeAt(a); return { x: p.x, y: p.y }; }, a: ph };
  }
  // 2D random loop (loop2) until the branch
  if (t < T_BRANCH) {
    const t0 = entryReady ? T_GLYPH_END : T.dragonStart;
    const s = Math.max(0, t - t0) * SP2; // enters at arc 0 (the split point)
    return { fn: (a) => { const p = loop2.pos(a); return { x: p.x, y: p.y }; }, a: s };
  }
  // after the branch the fading 2D dragon rides loop3 (== the 3D dragon's path,
  // SP2==SP3), so they overlap exactly through the crossfade and the 2D never
  // returns to the loop2 entry/transition path.
  const s = (t - T_BRANCH) * SP2;
  return { fn: (a) => { const p = loop3.pos(a); return { x: p.x, y: p.y }; }, a: s };
}
function tipAt(t) {
  const { fn, a } = pathAt(t);
  const p = fn(a), p2 = fn(a + 1e-3);
  let dx = p2.x - p.x, dy = p2.y - p.y;
  const m = Math.hypot(dx, dy) || 1;
  return { x: p.x, y: p.y, dir: { x: dx / m, y: dy / m } };
}
// 3D head arc position at time t (advances along loop3 from the branch phase)
function headArc3(t) {
  return loop3Phase + Math.max(0, t - T_BRANCH) * SP3;
}
// debug: sample the 2D loop as a polyline
function samplePath2d(t, n = 128) {
  const out = [];
  if (!loop2) return out;
  for (let i = 0; i <= n; i++) out.push(loop2.pos((i / n) * loop2.total));
  return out;
}

// ============================================================================
// 2D ink dragon - kinematic body
// ============================================================================
const BODY_N = 20;
const BODY_LEN = 1.116;
const PROP_SPEED = 0.5; // chain relaxation per step (verlet lag)
const MAX_BEND = (30 * Math.PI) / 180;
const HEAD_SIZE = 0.12;

let body = [];

// Fit the body ALONG the current path: head at the path point for t, the rest
// trailing back by arc length on the same curve. Used when seeking (no straight
// teleport) - physics then takes over from this on-path pose during playback.
function reseedBody(t, len = BODY_LEN) {
  const { fn, a: headA } = pathAt(t);
  // dense samples walking backward from the head, accumulating arc length
  const step = 0.02;
  const pts = [fn(headA)];
  const arcs = [0];
  let prev = pts[0], acc = 0, a = headA, guard = 0;
  while (acc < len && guard++ < 5000) {
    a -= step;
    const p = fn(a);
    acc += Math.hypot(p.x - prev.x, p.y - prev.y);
    pts.push(p); arcs.push(acc); prev = p;
  }
  body = new Array(BODY_N);
  for (let i = 0; i < BODY_N; i++) {
    const back = (1 - i / (BODY_N - 1)) * len; // i=N-1 head .. i=0 tail
    let lo = 0, hi = arcs.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (arcs[mid] < back) lo = mid + 1; else hi = mid; }
    const j = Math.max(1, lo);
    const seg = arcs[j] - arcs[j - 1] || 1e-6;
    const k = (back - arcs[j - 1]) / seg;
    body[i] = { x: lerp(pts[j - 1].x, pts[j].x, k), y: lerp(pts[j - 1].y, pts[j].y, k) };
  }
}

// Verlet chain trailing the tip target (mirrors ink-dragon.js stepBody):
// distance constraint back from the tip, max-bend clamp, forward re-constraint.
function stepBody(tip, len = BODY_LEN) {
  const N = body.length;
  if (N < 2) return;
  const linkLen = len / (N - 1);
  const speed = PROP_SPEED;
  const next = body.map((p) => ({ x: p.x, y: p.y }));
  next[N - 1] = { x: tip.x, y: tip.y };

  for (let i = N - 2; i >= 0; i--) {
    const dx = next[i + 1].x - next[i].x, dy = next[i + 1].y - next[i].y;
    const d = Math.hypot(dx, dy);
    if (d > linkLen && d > 1e-6) {
      const inv = ((d - linkLen) * speed) / d;
      next[i] = { x: next[i].x + dx * inv, y: next[i].y + dy * inv };
    }
  }

  if (MAX_BEND < Math.PI - 1e-3 && N >= 3) {
    const minCos = -Math.cos(MAX_BEND);
    for (let i = N - 2; i >= 1; i--) {
      const tipP = next[i + 1], mid = next[i], head = next[i - 1];
      const ax = tipP.x - mid.x, ay = tipP.y - mid.y;
      const bx = head.x - mid.x, by = head.y - mid.y;
      const aLen = Math.hypot(ax, ay), bLen = Math.hypot(bx, by);
      if (aLen < 1e-6 || bLen < 1e-6) continue;
      const adx = ax / aLen, ady = ay / aLen, bdx = bx / bLen, bdy = by / bLen;
      const cosAng = adx * bdx + ady * bdy;
      if (cosAng > minCos) {
        const curAng = Math.atan2(adx * bdy - ady * bdx, adx * bdx + ady * bdy);
        const sgn = curAng >= 0 ? 1 : -1;
        const targetAng = (Math.PI - MAX_BEND) * sgn;
        const newAng = curAng + (targetAng - curAng) * speed;
        const c = Math.cos(newAng), s = Math.sin(newAng);
        next[i - 1] = { x: mid.x + (adx * c - ady * s) * bLen, y: mid.y + (adx * s + ady * c) * bLen };
      }
    }
    for (let i = N - 2; i >= 0; i--) {
      const dx = next[i + 1].x - next[i].x, dy = next[i + 1].y - next[i].y;
      const d = Math.hypot(dx, dy);
      if (d > linkLen && d > 1e-6) {
        const inv = ((d - linkLen) * speed) / d;
        next[i] = { x: next[i].x + dx * inv, y: next[i].y + dy * inv };
      }
    }
  }
  body = next;
}

function headFrame(body) {
  const n = body.length;
  const tip = body[n - 1], prev = body[n - 2];
  let dx = tip.x - prev.x, dy = tip.y - prev.y;
  const m = Math.hypot(dx, dy) || 1;
  dx /= m; dy /= m;
  const neck = 0.05;
  return {
    pos: { x: tip.x + dx * neck, y: tip.y + dy * neck },
    dir: { x: dx, y: dy },
    perp: { x: -dy, y: dx },
  };
}

// ============================================================================
// Glyph (baked once)
// ============================================================================
let glyphSegs = [];
let glyphTotal = 1;

// ============================================================================
// 3D dragon - frames built on the SAME 2D path (z = 0), so it overlaps the ink
// dragon. The mesh has real depth (cross-section in the in-plane normal + the
// out-of-plane z axis); an orthographic camera matching the 2D world keeps the
// centreline exactly on the ink dragon's path.
// ============================================================================
const D3 = {
  N: 512,
  bodyFactor: 1.2,
  depth: 10, // ortho z range (for the mesh's out-of-plane extent)
};
let dragon3dFrames = null; // Float32Array N*16, column-major
let dragon3dPathLen = 1;

// Build the 3D dragon's frames by sampling loop3 at EQUAL ARC LENGTH. The shader
// maps mesh.x linearly to frame index, so arc-uniform frames keep the dragon a
// constant length per mesh unit. Each frame is a 3D orthonormal basis built from
// the path tangent + world-up (no precomputed twist; loop3's gentle z keeps the
// tangent away from vertical, so the up-vector method is stable).
function buildDragon3dFrames() {
  if (!loop3) return;
  const N = D3.N;
  const total = loop3.total;
  const frames = new Float32Array(N * 16);
  for (let i = 0; i < N; i++) {
    const s = (i / N) * total;
    const p = loop3.pos(s);
    const tg = loop3.tan(s);
    // reference up = +z (out-of-plane); the loop is mostly in x/y with gentle z,
    // so cross(up,T) is the stable in-plane "width" normal. Fall back to +y only
    // if the tangent runs near-parallel to z.
    let ux = 0, uy = 0, uz = 1;
    if (Math.abs(tg.z) > 0.95) { ux = 0; uy = 1; uz = 0; }
    // N = normalize(cross(up, T))
    let nx = uy * tg.z - uz * tg.y;
    let ny = uz * tg.x - ux * tg.z;
    let nz = ux * tg.y - uy * tg.x;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    // B = cross(T, N)
    const bx = tg.y * nz - tg.z * ny;
    const by = tg.z * nx - tg.x * nz;
    const bz = tg.x * ny - tg.y * nx;
    // column-major: col0=tangent(x), col1=normal(y=width), col2=binormal(z=depth), col3=pos
    const o = i * 16;
    frames[o + 0] = tg.x; frames[o + 1] = tg.y; frames[o + 2] = tg.z; frames[o + 3] = 0;
    frames[o + 4] = nx;   frames[o + 5] = ny;   frames[o + 6] = nz;   frames[o + 7] = 0;
    frames[o + 8] = bx;   frames[o + 9] = by;   frames[o + 10] = bz;  frames[o + 11] = 0;
    frames[o + 12] = p.x; frames[o + 13] = p.y; frames[o + 14] = p.z; frames[o + 15] = 1;
  }
  dragon3dFrames = frames;
  dragon3dPathLen = total;
}

// ---- orbit camera (orthographic; column-major mat4) ------------------------
function mat4mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}
function rotX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}
function rotZ(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function translate(x, y, z) {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  const o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f;
  o[10] = (far + near) * nf; o[11] = -1;
  o[14] = 2 * far * near * nf;
  return o;
}

const CAM = { fov: (45 * Math.PI) / 180, dist: 2.6 };
function sceneViewProj(aspect, orbit) {
  const yaw = (orbit && orbit.yaw) || 0;
  const pitch = (orbit && orbit.pitch) || 0;
  const proj = perspective(CAM.fov, aspect, 0.1, 60);
  // ground is the x/y plane, so +z is up. Yaw spins about z (the ground normal);
  // pitch then tilts elevation. rotZ first so yaw stays a true heading once tilted.
  let m = rotZ(yaw);
  m = mat4mul(rotX(pitch), m);
  m = mat4mul(translate(0, 0, -CAM.dist), m); // pull camera back along +z
  return mat4mul(proj, m);
}
// debug: 3D path centreline (frame translations) as xyz triples
function samplePath3d(stride = 4) {
  const out = [];
  if (!dragon3dFrames) return new Float32Array(0);
  for (let i = 0; i < D3.N; i += stride) {
    out.push(dragon3dFrames[i * 16 + 12], dragon3dFrames[i * 16 + 13], dragon3dFrames[i * 16 + 14]);
  }
  return new Float32Array(out);
}

// ============================================================================
// Ground grid - the floor the whole scene sits on. It is COPLANAR with the glyph
// / ink layers (the internal x/y plane, at internal z = GRID.z just behind them),
// so the glyph reads as painted ON it. Hidden at the start; once the 2D dragon is
// gone it wipes in RADIALLY from the origin (grid shader uReveal), not as a flat
// quad-opacity fade. We hand the renderer the plane params + opacity + reveal.
// ============================================================================
const GRID = { z: -0.01, ext: 12.0, step: 0.6 };

// ============================================================================
// public API
// ============================================================================
const GLYPH_SCALE = 0.5;
const GLYPH_RADIUS = 0.06 * GLYPH_SCALE;

export function initScene() {
  const sym = longSymbol();
  const baked = bakeSegs(sym, { connect: { enabled: true, thread: 0.18 }, timing: { speed: 1.0 } });
  // scale glyph geometry about origin (timing/pressure fields unchanged)
  for (const s of baked.segs) {
    s.p1.x *= GLYPH_SCALE; s.p1.y *= GLYPH_SCALE;
    s.p2.x *= GLYPH_SCALE; s.p2.y *= GLYPH_SCALE;
    s.ctrl.x *= GLYPH_SCALE; s.ctrl.y *= GLYPH_SCALE;
  }
  glyphSegs = baked.segs;
  glyphTotal = baked.total || 1;

  // fresh random loops each load (seeded once -> stable within the session)
  rng = mulberry32((Math.random() * 4294967296) >>> 0);
  resolveEntry(); // glyph stroke window for the entry trace

  // loop2 leaves the glyph trace at the split point: it is a pure random closed
  // loop ANCHORED at the split (so the head leaves the glyph end with no position
  // jump) and leaving along the glyph heading (clampExitPivot). No glyph-tail copy
  // is grafted in -> the head never flies back over the entry/transition path.
  if (entryReady) {
    const split = glyphStrokeAt(entryEndPh);
    const loopPivots = randomLoopPivots(rng, LOOP2_PIVOTS, R2D, 0);
    clampExitPivot(loopPivots, split, MAX_EXIT_TURN); // leave the glyph within the turn cap
    const ring2 = [{ x: split.x, y: split.y, z: 0 }, ...loopPivots];
    relaxTurns(ring2, MIN_TURN, MAX_TURN, MAX_SHARP_RUN, (i) => i >= 1, RELAX_ITERS); // pin the split anchor
    loop2 = buildSpline(ring2);
  } else {
    loop2 = buildSpline(randomLoopPivots(rng, LOOP2_PIVOTS, R2D, 0));
  }

  // 2D head arc on loop2 when it branches to 3D (mirrors pathAt's loop2 phase)
  const loop2T0 = entryReady ? T_GLYPH_END : T.dragonStart;
  const branchS = (T_BRANCH - loop2T0) * SP2;
  const bp = loop2.pos(branchS);
  const tb = loop2.tan(branchS); // 2D heading at the branch point
  // loop3 is a pure random closed loop ANCHORED at the branch point bp, leaving it
  // along the 2D heading. The 2D dragon switches onto loop3 AT the branch (see
  // pathAt) so the two overlap during the crossfade without copying loop2 into
  // loop3. loop3 holds no transition copy -> the 3D dragon never returns to it.
  const rest = randomLoopPivots(rng, LOOP3_PIVOTS, R3D, Z3D);
  clampExitPivot(rest, { x: bp.x, y: bp.y, dir: { x: tb.x, y: tb.y } }, MAX_EXIT_TURN);
  const ring3 = [{ x: bp.x, y: bp.y, z: 0 }, ...rest];
  relaxTurns(ring3, MIN_TURN, MAX_TURN, MAX_SHARP_RUN, (i) => i >= 1, RELAX_ITERS); // pin the branch anchor
  loop3 = buildSpline(ring3);
  loop3Phase = 0; // 3D head starts at bp (loop3 arc 0) at T_BRANCH

  buildDragon3dFrames();
  timeline.reset(); // fresh scene: re-run block setup on the next frame
  // seed body fitted to the path at the dragon's start (short)
  reseedBody(T.dragonStart, BODY_LEN * ENTRY_GROW_MIN);
}

// Cross-section scale for the 3D mesh: dragon-low's in-plane span (~24 units)
// -> a stroke width close to the ink dragon's body width.
const D3_GIRTH = 0.006;

// 2D-dragon grow ramp: small + short while tracing the glyph, growing up after it
// peels onto the loop. Shared by body length + head/stroke size.
function inkGrow(t) {
  return entryReady
    ? smooth(clamp((t - T_GLYPH_END) / GROW_DUR, 0, 1))
    : Math.max(0, ramp(t, T.dragonStart, T.dragonStart + 0.4, 0, 1));
}
const inkLenFrac = (t) => lerp(ENTRY_GROW_MIN, 1.0, inkGrow(t));
const inkSizeFrac = (t) => lerp(ENTRY_SIZE_MIN, 1.0, inkGrow(t));

// ============================================================================
// Scene timeline - overlapping blocks (see timeline.js). Each block writes its
// slice into the shared ctx; buildState seeds ctx defaults, runs the timeline,
// then assembles the FrameState. Blocks attach to each other's branch points so
// they retime together and can be developed independently.
//   glyph     [0 .. reveal]       traces the glyph, then holds it on the ground
//   inkDragon (after glyph.end)   enters at the glyph end, traces it, peels onto a
//                                 loop, then fades. branches: `handoff`, `gone`
//   camera    (after ink.handoff) tilts top-down -> 45deg over the crossfade
//   dragon3d  (after ink.handoff) fades in and flies its loop forever
//   grid      (after ink.gone)    radial wipe-in of the ground grid
// ============================================================================
const blkGlyph = {
  name: "glyph",
  at: 0,
  duration: T.glyphRevealEnd,
  branches: { end: T.glyphRevealEnd },
  update(ctx) {
    ctx.playhead = ramp(ctx.t, 0, T.glyphRevealEnd, 0, glyphTotal);
  },
};

const blkInk = {
  name: "inkDragon",
  after: { block: "glyph", branch: "end" },
  duration: D3_END - T.dragonStart,
  branches: {
    traced: T_GLYPH_END - T.dragonStart, // dragon finished tracing the glyph stroke
    handoff: T_BRANCH - T.dragonStart,
    gone: D3_END - T.dragonStart,
  },
  // entering, or seeking in/within: refit the body on-path (no physics history,
  // no straight teleport) so a scrub lands on a valid on-curve pose.
  setup(ctx) { reseedBody(ctx.t, BODY_LEN * inkLenFrac(ctx.t)); },
  seek(ctx) { reseedBody(ctx.t, BODY_LEN * inkLenFrac(ctx.t)); },
  update(ctx) {
    const t = ctx.t;
    const inkReveal = ramp(t, T.dragonStart, T.dragonStart + 0.4, 0, 1);
    const inkFade = ramp(t, D3_START, D3_END, 1, 0); // fades as the 3D dragon appears
    ctx.inkAlpha = Math.min(inkReveal, inkFade);
    const sizeFrac = inkSizeFrac(t);
    ctx.inkWidthScale = sizeFrac;
    ctx.headSize = HEAD_SIZE * sizeFrac;
    const growLen = BODY_LEN * inkLenFrac(t);
    // continuous step; seeks are resynced by setup/seek above
    if (body.length < 2) reseedBody(t, growLen);
    else stepBody(tipAt(t), growLen);
  },
};

// camera/dragon3d/grid are PERSISTENT (no duration): once started they keep
// updating forever, holding their end state (full tilt / dragon looping / grid
// revealed) instead of tearing down and snapping back to defaults.
const blkCamera = {
  name: "camera",
  after: { block: "inkDragon", branch: "handoff" },
  update(ctx, local) {
    ctx.camPitch = smooth(clamp(local / CROSSFADE, 0, 1)) * CAM_PITCH_ANGLE;
  },
};

const blkDragon3d = {
  name: "dragon3d",
  after: { block: "inkDragon", branch: "handoff" },
  update(ctx) {
    ctx.d3Alpha = ramp(ctx.t, D3_START, D3_END, 0, 1); // flies its loop forever (headArc3 advances with t)
  },
};

const blkGrid = {
  name: "grid",
  after: { block: "inkDragon", branch: "traced" }, // reveal right after the stroke is traced
  update(ctx, local) {
    ctx.gridReveal = clamp(local / GRID_REVEAL_DUR, 0, 1);
    ctx.gridRevealMinor = clamp((local - GRID_MINOR_LAG) / GRID_REVEAL_DUR, 0, 1);
    ctx.gridStrength = ctx.gridReveal > 0 ? GRID_MAX_OPACITY : 0;
  },
};

const timeline = makeTimeline([blkGlyph, blkInk, blkCamera, blkDragon3d, blkGrid]);

// Build the FrameState for scene time t. showDebug adds path polylines; orbit =
// { yaw } (pitch is scripted by the camera block). Seeds ctx defaults (= nothing
// happening, so inactive blocks need no teardown to clear), runs the overlapping
// timeline blocks, then assembles the FrameState from ctx.
export function buildState(t, aspect, showDebug = false, orbit = null, debugBuffer = "none") {
  const ctx = {
    t,
    playhead: glyphTotal,      // glyph held fully drawn unless the glyph block traces
    inkAlpha: 0, d3Alpha: 0,
    gridStrength: 0, gridReveal: 0, gridRevealMinor: 0,
    camPitch: 0,               // top-down until the camera block tilts
    inkWidthScale: 1, headSize: HEAD_SIZE,
  };
  timeline.frame(ctx, t);

  const frame = headFrame(body);
  const userYaw = (orbit && orbit.yaw) || 0;
  const viewProj = sceneViewProj(aspect, { yaw: userYaw, pitch: ctx.camPitch });

  return {
    aspect,
    opacity: { glyph: 1.0, inkDragon: ctx.inkAlpha, dragon3d: ctx.d3Alpha },
    grid: { opacity: ctx.gridStrength, reveal: ctx.gridReveal, revealMinor: ctx.gridRevealMinor, viewProj, ext: GRID.ext, z: GRID.z, step: GRID.step, minorDiv: GRID_MINOR_DIV },
    glyph: { segs: glyphSegs, playhead: ctx.playhead, baseRadius: GLYPH_RADIUS },
    inkDragon: {
      body,
      head: { pos: frame.pos, dir: frame.dir, size: ctx.headSize },
      widthScale: ctx.inkWidthScale, // body stroke width grows with size
    },
    dragon3d: {
      frames: dragon3dFrames,
      frameCount: D3.N,
      pathLen: dragon3dPathLen,
      bodyLen: BODY_LEN * D3.bodyFactor,
      // head end of the mesh is at x=1, so it leads by bodyLen in the shader;
      // subtract it so the mesh head lands on headArc3 (the loop3 head position).
      headOffset: headArc3(t) - BODY_LEN * D3.bodyFactor,
      girth: D3_GIRTH,
      viewProj,
      time: t,
    },
    debug: showDebug
      ? { show: true, buffer: debugBuffer, path2d: samplePath2d(t), path3d: samplePath3d() }
      : { show: false, buffer: debugBuffer },
  };
}
