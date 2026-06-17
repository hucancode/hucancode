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
  dragonStart: 0, // the 2D dragon is the FIRST thing on screen (a straight stroke)
  // camera tilt + 2D->3D crossfade + grid reveal are timed off the branch
  // (D3_START/END, CAM_*, GRID_* defined with the flight-path constants below).
};

// ============================================================================
// Flight path - the 2D ink dragon LEADS every phase (head at the front, ink
// filling in behind it), then hands off to a 3D loop:
//   0. lead-in    - the dragon is the FIRST thing on screen: a simple straight
//                   stroke at top-middle, head hidden, gliding toward the glyph.
//   1. glyph trace- head rides the glyph pen across the WHOLE symbol; the glyph
//                   reveal follows the head. The head fades in over the back half
//                   of this phase (it is hidden through the lead-in + first half).
//   2. enso       - head sweeps one clockwise circle; the enso shader stroke
//                   reveals up to the head (head leads the brush). Held after.
//   3. circle roam - head flies a chain of tangent circles (0.5–1.5 rounds each).
//   4. 3D handoff - after the roam, branch onto a 3D random loop (anchored at the
//                   branch point); the 2D ink + enso fade as the 3D dragon enters.
// See buildSpline / buildOpenSpline / generateCurvePath / initScene.
// ============================================================================
const LEADIN_DUR = 0.5;       // straight glide from the top onto the glyph start
const LEADIN_START = { x: 0, y: 0.78 }; // top-middle, far from the glyph entry
const GLYPH_TRACE_DUR = 3.5;  // 1.5 = head traces the whole glyph, leading the reveal
const ENSO_LEADIN_DUR = 0.6;  // branch off the glyph end onto the enso (no snap)
const ENSO_R = 0.4;           // enso radius (world units; <1 keeps it on-screen)
const ENSO_WIDTH = 0.05;      // enso brush thickness (polar line width in the shader)
const GROW_DUR = 2.5;         // body grows up after the glyph trace (over the enso)
const ENTRY_GROW_MIN = 0.2;   // body length fraction while tracing the glyph
const ENTRY_SIZE_MIN = 0.4;   // body width / head size fraction while tracing

// 2D roam: dragon flies a chain of tangent circles (0.5–1.5 rounds each), then
// transitions to the next via an internally or externally tangent circle.
const CURVE_BOUND = 1.00;      // bounding radius (keeps all circles on-screen)
const CIRCLE_R_MIN = 0.3;     // min individual circle radius
const CIRCLE_R_MAX = 0.8;     // max individual circle radius
const CIRCLE_CHAIN_LEN = 9;    // number of circles in the chain
const CIRCLE_SAMPLES = 10;    // dense samples per full (2π) revolution

// 3D loop (unchanged): a random closed loop the 3D dragon flies, anchored at the
// branch point so the fading 2D dragon overlaps it through the crossfade.
const R3D = 0.72;            // 3D loop bounding radius (x/y)
const Z3D = 0.6;             // 3D loop out-of-plane amplitude
const LOOP3_PIVOTS = 8;      // random pivots for the 3D loop
const SP2 = 2.5;             // 2D & 3D head speed (world units / sec)
const SP3 = SP2;             // 3D dragon speed matches 2D
const ENSO_DUR = (2 * Math.PI * ENSO_R) / SP2; // enso circumference / speed
const CROSSFADE = 1.0;       // 2D->3D crossfade duration
const CAM_PITCH_DUR = CROSSFADE * 4; // camera pitch tilt duration (slower than the fade)
const MAX_EXIT_TURN = Math.PI / 4; // cap on the peel-off turn at the branch onto loop3
const MIN_TURN = Math.PI / 9;      // floor on the turn angle at a pivot (keeps loops from going too straight)
const MAX_TURN = Math.PI / 2;      // angle above which a pivot counts as a "sharp" turn
const MAX_SHARP_RUN = 2;           // a sharp turn is fine, but not N in a row -> relax the Nth
const RELAX_ITERS = 24;            // relaxation passes

const T_GLYPH_START = T.dragonStart + LEADIN_DUR;    // lead-in -> glyph trace
const T_GLYPH_END = T_GLYPH_START + GLYPH_TRACE_DUR; // glyph trace -> enso branch
const T_ENSO_START = T_GLYPH_END + ENSO_LEADIN_DUR;  // enso branch -> enso sweep
const T_ENSO_END = T_ENSO_START + ENSO_DUR;          // enso -> curve roam
// T_BRANCH/D3_START/D3_END recomputed in initScene once curvePath.total is known
let T_BRANCH = T_ENSO_END + 6.0;  // placeholder until initScene runs
let D3_START = T_BRANCH;
let D3_END = T_BRANCH + CROSSFADE;

// Camera: looks straight down (top-down, pitch 0) through the glyph trace; tilts
// to a 45deg elevation as the 2D dragon fades to the 3D dragon. Yaw stays
// user-controllable (component), pitch is fully scripted here.
const CAM_PITCH_ANGLE = -Math.PI * 0.3; // straight-down (0) -> 45deg elevation tilt (sign = tilt dir)
const GLYPH_FADE_TARGET = 0.75; // glyph ink eases to this opacity as the 3D dragon takes over
const ENSO_FADE_TARGET = 0.5;   // enso circle eases to this opacity as the 3D dragon takes over
// Ground grid reveals AFTER the 2D dragon is fully gone, wiping in radially.
const GRID_REVEAL_DUR = 2.5;
const GRID_MAX_OPACITY = 0.22;
const GRID_MINOR_DIV = 5; // minor cells per major cell (minor step = GRID.step/this)
const GRID_MINOR_LAG = 0.8; // minor grid wipe-in trails the major reveal by this many seconds

// after the 2D->3D branch, leave room to watch the 3D dragon loop on alone.
export let TIMELINE_END = T_BRANCH + 11.0;

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

// Catmull-Rom through pivots P (OPEN; endpoints clamped). u in [0, K-1].
function catmullOpen(P, u) {
  const K = P.length;
  const i = Math.min(Math.max(Math.floor(u), 0), K - 2);
  const f = u - i;
  const p0 = P[Math.max(i - 1, 0)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(i + 2, K - 1)];
  return {
    x: crComp(p0.x, p1.x, p2.x, p3.x, f),
    y: crComp(p0.y, p1.y, p2.y, p3.y, f),
    z: crComp(p0.z, p1.z, p2.z, p3.z, f),
  };
}

// Arc-length-parameterised OPEN spline through pivots: pos(s)/tan(s) CLAMP at the
// ends (s held in [0,total]); arcAtU(u) gives the arc length at pivot-index u.
function buildOpenSpline(pivots) {
  const K = pivots.length;
  const M = 2048;
  const span = K - 1;
  const dense = new Array(M + 1);
  const cum = new Float64Array(M + 1);
  for (let i = 0; i <= M; i++) dense[i] = catmullOpen(pivots, (i / M) * span);
  for (let i = 1; i <= M; i++) {
    const a = dense[i], b = dense[i - 1];
    cum[i] = cum[i - 1] + Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  }
  const total = cum[M] || 1;
  function pos(s) {
    const d = clamp(s, 0, total);
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
    const a = pos(clamp(s, 0, total - e)), b = pos(clamp(s, 0, total - e) + e);
    let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const m = Math.hypot(dx, dy, dz) || 1;
    return { x: dx / m, y: dy / m, z: dz / m };
  }
  const arcAtU = (u) => cum[Math.round(clamp(u / span, 0, 1) * M)];
  return { pos, tan, total, arcAtU };
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
let ensoLeadIn = null;     // short branch from the glyph end onto the enso circle
let curvePath = null;      // 2D roam spline the ink dragon follows
let curvePool = [];        // pool of {x,y,z} waypoints used to build curvePath (debug)
let loop3 = null;          // 3D random loop the 3D dragon flies
let loop3Phase = 0;        // 3D head arc at T_BRANCH (aligns the branch handoff)
let glyphEntry = { x: 0, y: 0 };  // glyph pen position at playhead 0 (lead-in target)
let ensoA0 = Math.PI / 2;  // enso start angle: top of circle (fixed); head sweeps counter-clockwise

// ---- enso circle ----------------------------------------------------------
// The head sweeps ONE counter-clockwise circle of radius ENSO_R starting at the
// top (0, ENSO_R); `frac` (0..1) drives the enso shader's sweep so the brush
// stroke trails the head. Defined for any frac so the body can trail before the
// start (frac<0).
function ensoPos(frac) {
  const a = ensoA0 + frac * TAU; // counter-clockwise (increasing angle)
  return { x: ENSO_R * Math.cos(a), y: ENSO_R * Math.sin(a) };
}

// straight glide from LEADIN_START onto the glyph entry (eased); p in 0..1
function leadInPos(p) {
  const k = smooth(clamp(p, 0, 1));
  return { x: lerp(LEADIN_START.x, glyphEntry.x, k), y: lerp(LEADIN_START.y, glyphEntry.y, k) };
}

// 2D roam: dragon flies a chain of tangent circles. Each circle covers 0.5–1.5
// rounds; the exit angle and next circle are chosen by scoring 12 candidate exit
// angles × 3 radii for clearance from previous circles + boundary margin.
// External tangency (next center beyond touch point, rotation flips, 90% weight)
// is preferred; internal (same side, same rotation, 10% weight) is a fallback.
// Trying many exit angles ensures external is always feasible somewhere — avoiding
// the consecutive-internal-tangent bug caused by a single exit point near the edge.
function generateCirclePath(rng, entry, heading) {
  curvePool = [];

  const hdx = Math.cos(heading);
  const hdy = Math.sin(heading);

  // First circle: centre along the perpendicular to the heading at `entry`.
  // At the enso exit the heading IS the enso tangent, so this perpendicular is
  // the enso radial -> the first circle is tangent to the enso (shared tangent +
  // collinear centres).  Pick dir/r so the whole circle fits CURVE_BOUND; do NOT
  // scale the centre (that would break tangency and pull the circle off `entry`).
  let dir = rng() > 0.5 ? 1 : -1;
  let r = CIRCLE_R_MIN + rng() * (CIRCLE_R_MAX - CIRCLE_R_MIN);
  let cx, cy;
  let placed = false;
  for (let tryi = 0; tryi < 12; tryi++) {
    const d = tryi === 0 ? dir : (rng() > 0.5 ? 1 : -1);
    const rr = tryi === 0 ? r : CIRCLE_R_MIN + rng() * (CIRCLE_R_MAX - CIRCLE_R_MIN);
    const ccx = entry.x + (d > 0 ? -hdy : hdy) * rr;
    const ccy = entry.y + (d > 0 ? hdx : -hdx) * rr;
    if (Math.hypot(ccx, ccy) + rr <= CURVE_BOUND) {
      dir = d; r = rr; cx = ccx; cy = ccy; placed = true; break;
    }
  }
  if (!placed) {
    // No radius/side fit (entry near the bound): take the inward side at min radius.
    r = CIRCLE_R_MIN;
    const inwardSign = (entry.x * -hdy + entry.y * hdx) < 0 ? 1 : -1; // perp pointing toward origin
    dir = inwardSign;
    cx = entry.x + (dir > 0 ? -hdy : hdy) * r;
    cy = entry.y + (dir > 0 ? hdx : -hdx) * r;
  }

  let px = entry.x, py = entry.y;
  const allPts = [
    { x: px - hdx * BODY_LEN * 2, y: py - hdy * BODY_LEN * 2, z: 0 },
    { x: px - hdx * BODY_LEN,     y: py - hdy * BODY_LEN,     z: 0 },
    { x: px,                       y: py,                       z: 0 },
  ];
  const headEntryIdx = 2;
  const history = []; // all placed circles for empty-area scoring

  const EXIT_CANDS = 12; // candidate exit angles to evaluate
  const R_TRIES = 3;     // radii to try per exit angle

  for (let chain = 0; chain < CIRCLE_CHAIN_LEN; chain++) {
    history.push({ cx, cy, r });
    const startAngle = Math.atan2(py - cy, px - cx);

    // Score candidates: sample EXIT_CANDS exit angles in [0.5, 1.5] revolutions,
    // try R_TRIES radii each (90% ext / 10% int per attempt).
    let bestScore = -Infinity;
    let best = null;

    for (let k = 0; k < EXIT_CANDS; k++) {
      // Jittered uniform coverage of the valid arc range
      const t = (k + 0.1 + rng() * 0.8) / EXIT_CANDS;
      const delta = lerp(0.5 * TAU, 1.5 * TAU, t); // angular sweep on current circle
      const exitAngle = startAngle + delta * dir;
      const ex = cx + r * Math.cos(exitAngle);
      const ey = cy + r * Math.sin(exitAngle);
      const nx = (ex - cx) / r; // outward normal at exit
      const ny = (ey - cy) / r;

      for (let ri = 0; ri < R_TRIES; ri++) {
        const nextR = CIRCLE_R_MIN + rng() * (CIRCLE_R_MAX - CIRCLE_R_MIN);
        // External: center beyond touch point (outward), rotation flips (+0.5 score bonus).
        // Internal: center same side as current center, same rotation.
        const ext = rng() < 0.7;
        const sign = ext ? 1 : -1;
        const nextCx = ex + sign * nx * nextR;
        const nextCy = ey + sign * ny * nextR;
        const nextDir = ext ? -dir : dir;

        const outerDist = Math.hypot(nextCx, nextCy) + nextR;
        if (outerDist > CURVE_BOUND * 0.96) continue; // out of bounds, skip

        // Score: min clearance from all previous circles (skip current = last in history)
        // + boundary margin bonus + external bonus.
        let minClearance = Infinity;
        for (let hi = 0; hi < history.length - 1; hi++) {
          const h = history[hi];
          const c = Math.hypot(nextCx - h.cx, nextCy - h.cy) - h.r - nextR;
          if (c < minClearance) minClearance = c;
        }
        if (!isFinite(minClearance)) minClearance = 0;
        const boundMargin = CURVE_BOUND - outerDist;
        const score = minClearance + boundMargin * 0.4 + (ext ? 0.5 : 0);

        if (score > bestScore) {
          bestScore = score;
          best = { delta, ex, ey, nextCx, nextCy, nextR, nextDir };
        }
      }
    }

    // Fallback: external tangency at a random in-range exit, clamped to bound.
    if (!best) {
      const delta = lerp(0.5 * TAU, 1.5 * TAU, rng());
      const exitAngle = startAngle + delta * dir;
      const ex = cx + r * Math.cos(exitAngle);
      const ey = cy + r * Math.sin(exitAngle);
      const nx = (ex - cx) / r, ny = (ey - cy) / r;
      const nextR = CIRCLE_R_MIN;
      let nextCx = ex + nx * nextR, nextCy = ey + ny * nextR;
      const dc2 = Math.hypot(nextCx, nextCy);
      const maxDc2 = Math.max(0, CURVE_BOUND - nextR);
      if (dc2 > maxDc2 && dc2 > 1e-6) { nextCx *= maxDc2 / dc2; nextCy *= maxDc2 / dc2; }
      best = { delta, ex, ey, nextCx, nextCy, nextR, nextDir: -dir };
    }

    // Sample the chosen arc.
    const nSamples = Math.max(32, Math.round(CIRCLE_SAMPLES * best.delta / TAU));
    for (let i = 1; i <= nSamples; i++) {
      const a = startAngle + (i / nSamples) * best.delta * dir;
      allPts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), z: 0 });
    }

    if (chain === CIRCLE_CHAIN_LEN - 1) break;

    px = best.ex; py = best.ey;
    cx = best.nextCx; cy = best.nextCy; r = best.nextR; dir = best.nextDir;
  }

  // Arc-length parameterization directly from dense circle samples.
  const N = allPts.length;
  const cum = new Float64Array(N);
  for (let i = 1; i < N; i++) {
    const a = allPts[i - 1], b = allPts[i];
    cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y);
  }
  const total = cum[N - 1] || 1;
  const headStart = cum[headEntryIdx];

  function pos(s) {
    const d = clamp(s, 0, total);
    let lo = 0, hi = N - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < d) lo = mid + 1; else hi = mid; }
    const i = Math.max(1, lo);
    const seg = cum[i] - cum[i - 1] || 1e-6;
    const k = (d - cum[i - 1]) / seg;
    return { x: lerp(allPts[i - 1].x, allPts[i].x, k), y: lerp(allPts[i - 1].y, allPts[i].y, k), z: 0 };
  }

  function tan(s) {
    const e = total * 1e-3;
    const a = pos(clamp(s, 0, total - e));
    const b = pos(clamp(s + e, 0, total));
    const dx = b.x - a.x, dy = b.y - a.y;
    const m = Math.hypot(dx, dy) || 1;
    return { x: dx / m, y: dy / m, z: 0 };
  }

  const arcAtU = (u) => cum[clamp(Math.round(u), 0, N - 1)];

  return { pos, tan, total, headStart, arcAtU };
}

// Branch off the glyph end onto the enso circle with a C curve (entry, belly,
// exit) -- the same generation rule as the roam, so the join is smooth. The
// entry/exit tangents are pinned (a control point either side) to the glyph exit
// heading and the circle tangent, so the head leaves the glyph and arrives on the
// enso with no kink and no position snap. Returns the open spline + the arc range
// the head travels (entry pivot -> exit pivot).
function buildEnsoLeadIn(entry, entryHeading, exit, exitHeading) {
  const edx = Math.cos(entryHeading), edy = Math.sin(entryHeading);
  const xdx = Math.cos(exitHeading), xdy = Math.sin(exitHeading);
  // belly: bowed off the entry->exit chord (outward), sized so it is never tiny
  const cx = exit.x - entry.x, cy = exit.y - entry.y;
  const chord = Math.hypot(cx, cy) || 1e-6;
  let px = -cy / chord, py = cx / chord;           // chord normal
  if (px * (entry.x + exit.x) + py * (entry.y + exit.y) < 0) { px = -px; py = -py; } // bow outward
  const off = Math.max(0.35 * chord, 0.25);
  const belly = { x: (entry.x + exit.x) * 0.5 + px * off, y: (entry.y + exit.y) * 0.5 + py * off, z: 0 };
  const tan = 0.2 * chord; // tangent-guide control offset
  const pivots = [
    { x: entry.x - edx * tan, y: entry.y - edy * tan, z: 0 },
    { x: entry.x, y: entry.y, z: 0 },
    belly,
    { x: exit.x, y: exit.y, z: 0 },
    { x: exit.x + xdx * tan, y: exit.y + xdy * tan, z: 0 },
  ];
  const spline = buildOpenSpline(pivots);
  return { ...spline, headStart: spline.arcAtU(1), endArc: spline.arcAtU(3) };
}

// Rotate the first random pivot about the split point so the head's peel-off
// bearing stays within `maxTurn` of the glyph exit heading -> no sharp exit turn.
// (loop3's seam tangent at the split pivot is driven by this first pivot.)
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

// Which path phase scene-time t is in (lead-in / glyph / enso / curve / loop3).
// Used to refit the body when a phase boundary is crossed (the phases don't share
// a continuous arc parameter, so the body is reseeded onto the new curve).
function phaseOf(t) {
  if (t < T_GLYPH_START) return 0; // lead-in
  if (t < T_GLYPH_END) return 1;   // glyph trace
  if (t < T_ENSO_START) return 2;  // enso branch (connector)
  if (t < T_ENSO_END) return 3;    // enso sweep
  if (t < T_BRANCH) return 4;      // curve roam
  return 5;                        // loop3 (3D handoff)
}

// Drives the 2D ink-dragon head through the phases. The head LEADS each phase
// (it is the leading edge of the ink / reveal). After the branch it rides loop3
// (== the 3D dragon's path) so the two overlap through the crossfade.
function pathAt(t) {
  // lead-in: a straight glide from the top onto the glyph entry
  if (t < T_GLYPH_START) {
    const prog = clamp((t - T.dragonStart) / LEADIN_DUR, 0, 1);
    return { fn: (a) => leadInPos(a), a: prog };
  }
  // glyph trace: head rides the glyph pen across the whole symbol
  if (t < T_GLYPH_END) {
    const prog = clamp((t - T_GLYPH_START) / GLYPH_TRACE_DUR, 0, 1);
    const ph = prog * glyphTotal;
    return { fn: (a) => { const p = glyphStrokeAt(a); return { x: p.x, y: p.y }; }, a: ph };
  }
  // enso branch: C curve off the glyph end onto the circle (no snap)
  if (t < T_ENSO_START) {
    const prog = clamp((t - T_GLYPH_END) / ENSO_LEADIN_DUR, 0, 1);
    const s = lerp(ensoLeadIn.headStart, ensoLeadIn.endArc, prog);
    return { fn: (a) => { const p = ensoLeadIn.pos(a); return { x: p.x, y: p.y }; }, a: s };
  }
  // enso: head sweeps one clockwise circle (frac 0..1)
  if (t < T_ENSO_END) {
    const frac = clamp((t - T_ENSO_START) / ENSO_DUR, 0, 1);
    return { fn: (a) => ensoPos(a), a: frac };
  }
  // curve roam: head flies the random C/S/8 chain (arc s, from the lead-in offset)
  if (t < T_BRANCH) {
    const s = curvePath.headStart + Math.max(0, t - T_ENSO_END) * SP2;
    return { fn: (a) => { const p = curvePath.pos(a); return { x: p.x, y: p.y }; }, a: s };
  }
  // t >= T_BRANCH: inkDragon block already ended (D3_END = T_BRANCH) so 2D is
  // invisible here; hold at curvePath end as a safe fallback for seeking.
  return { fn: (a) => { const p = curvePath.pos(a); return { x: p.x, y: p.y }; }, a: curvePath.total };
}
function tipAt(t) {
  const { fn, a } = pathAt(t);
  const p = fn(a), p2 = fn(a + 1e-3);
  let dx = p2.x - p.x, dy = p2.y - p.y;
  const m = Math.hypot(dx, dy) || 1;
  return { x: p.x, y: p.y, dir: { x: dx / m, y: dy / m } };
}
// 3D dragon render params for time t: which frame buffer, its arc length, and the
// head offset.  The shader wraps mod-N over the WHOLE buffer (a closed ring), so:
//   - While the body is still trailing off the flat circles -> use the TRANSITION
//     buffer (curvePath tail + loop3).  head buffer-arc = bodyArc + elapsed; the
//     body never crosses the buffer seam, so no wrap artifact.
//   - Once the tail has fully left the circles (elapsed >= transArc) -> switch to
//     the PURE loop3 ring, which wraps cleanly forever.  The switch is C0/C1
//     continuous: at elapsed=transArc the head is at loop3 arc bodyArc in both.
function dragon3dDraw(t) {
  const bodyArc  = BODY_LEN * D3.bodyFactor;
  const transArc = d3TransArc; // bodyArc + CROSSFADE*SP3
  const elapsed  = Math.max(0, t - D3_START) * SP3;
  if (!dragon3dFramesLoop || elapsed < transArc) {
    // transition: head buffer-arc = bodyArc + elapsed -> headOffset = elapsed
    return { frames: dragon3dFrames, pathLen: dragon3dPathLen, headOffset: elapsed };
  }
  // pure loop3 ring: continue head arc from bodyArc, let shader mod-N wrap it
  const loopArc = bodyArc + (elapsed - transArc);
  return { frames: dragon3dFramesLoop, pathLen: dragon3dLoopLen, headOffset: loopArc - bodyArc };
}
// debug: sample the 2D curve roam as a polyline
function samplePath2d(t, n = 256) {
  const out = [];
  if (!curvePath) return out;
  for (let i = 0; i <= n; i++) out.push(curvePath.pos((i / n) * curvePath.total));
  return out;
}

// ============================================================================
// 2D ink dragon - kinematic body
// ============================================================================
const BODY_N = 20;
const BODY_LEN = 0.8;
const PROP_SPEED = 0.6; // chain relaxation per step (verlet lag)
const MAX_BEND = (30 * Math.PI) / 180;
const HEAD_SIZE = 0.12;

let body = [];
let lastInkPhase = -1; // path phase the body was last fitted in (refit on change)

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
let dragon3dFrames = null;     // transition buffer (curvePath tail + loop3), N*16
let dragon3dPathLen = 1;
let dragon3dFramesLoop = null; // pure loop3 ring (wraps cleanly forever), N*16
let dragon3dLoopLen = 1;
let d3TransArc = 0;            // curvePath tail length baked into the transition buffer

// Fill an N*16 column-major frame buffer by sampling `sample(arc)->{p,tg}` at N
// equal-arc-length steps over [0, total). Each frame is a 3D orthonormal basis
// from the tangent + world-up (cross(up,T) gives the stable in-plane width normal;
// fall back to +y only if the tangent runs near-vertical).
function fillFrames(frames, N, total, sample) {
  for (let i = 0; i < N; i++) {
    const { p, tg } = sample((i / N) * total);
    let ux = 0, uy = 0, uz = 1;
    if (Math.abs(tg.z) > 0.95) { ux = 0; uy = 1; uz = 0; }
    let nx = uy * tg.z - uz * tg.y;
    let ny = uz * tg.x - ux * tg.z;
    let nz = ux * tg.y - uy * tg.x;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const bx = tg.y * nz - tg.z * ny;
    const by = tg.z * nx - tg.x * nz;
    const bz = tg.x * ny - tg.y * nx;
    const o = i * 16;
    frames[o + 0] = tg.x; frames[o + 1] = tg.y; frames[o + 2] = tg.z; frames[o + 3] = 0;
    frames[o + 4] = nx;   frames[o + 5] = ny;   frames[o + 6] = nz;   frames[o + 7] = 0;
    frames[o + 8] = bx;   frames[o + 9] = by;   frames[o + 10] = bz;  frames[o + 11] = 0;
    frames[o + 12] = p.x; frames[o + 13] = p.y; frames[o + 14] = p.z; frames[o + 15] = 1;
  }
}

// Build BOTH 3D frame buffers (arc-uniform; the shader maps mesh.x linearly to
// frame index, so equal-arc frames keep the dragon a constant length):
//   - transition buffer: [0, transArc) = curvePath tail ending at bp (flat circles
//     for the crossfade), [transArc, ..) = loop3 from bp. Used only while the body
//     still trails off the circles.
//   - loop buffer: pure loop3 closed ring; wraps mod-N cleanly forever afterward.
// The join at bp is tangent-continuous (loop3 leaves bp along the curvePath exit
// heading via clampExitPivot).
function buildDragon3dFrames() {
  if (!loop3 || !curvePath) return;
  const N = D3.N;
  const bodyArc  = BODY_LEN * D3.bodyFactor;
  const transArc = bodyArc + CROSSFADE * SP3; // curvePath tail length in the trans buffer
  d3TransArc = transArc;

  const total = transArc + loop3.total;
  const trans = new Float32Array(N * 16);
  fillFrames(trans, N, total, (arc) => {
    if (arc < transArc) {
      const cpArc = curvePath.total - transArc + arc;
      return { p: curvePath.pos(cpArc), tg: curvePath.tan(cpArc) };
    }
    return { p: loop3.pos(arc - transArc), tg: loop3.tan(arc - transArc) };
  });
  dragon3dFrames = trans;
  dragon3dPathLen = total;

  const loop = new Float32Array(N * 16);
  fillFrames(loop, N, loop3.total, (arc) => ({ p: loop3.pos(arc), tg: loop3.tan(arc) }));
  dragon3dFramesLoop = loop;
  dragon3dLoopLen = loop3.total;
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
// Ink splash - a procedural-noise blob centred at the origin (behind the glyph)
// that GROWS over the scene, splattering randomly around a circle with a sharp
// fbm edge and ~3 posterised ink tones (see splash.frag.glsl). spread = max blob
// radius (world units); grow ramps 0->1 over the 2D phase, then holds.
// ============================================================================
const SPLASH_SPREAD = 0.8;        // max blob radius (world units)
const SPLASH_AMOUNT = 0.45;        // 0..1 amount of ink blobs (higher = denser)
let SPLASH_GROW_DUR = T_BRANCH;  // ink keeps spreading across the 2D phase, then holds
const SPLASH_FADE_IN = 1.0;        // seconds for the wash to fade in at the start

// ============================================================================
// public API
// ============================================================================
const GLYPH_SCALE = 0.36;
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

  // fresh random paths each load (seeded once -> stable within the session)
  rng = mulberry32((Math.random() * 4294967296) >>> 0);

  // lead-in target = glyph pen at playhead 0
  const g0 = glyphStrokeAt(0);
  glyphEntry = { x: g0.x, y: g0.y };
  const gEnd = glyphStrokeAt(glyphTotal);
  // enso always starts at the top (fixed), counter-clockwise
  ensoA0 = Math.PI / 2;

  // branch off the glyph end onto the enso circle with a C curve (tangent-matched
  // to the glyph heading in and the circle tangent out) -> smooth, no snap.
  const ensoStart = ensoPos(0);
  const ensoStartNext = ensoPos(1e-3);
  const ensoStartHeading = Math.atan2(ensoStartNext.y - ensoStart.y, ensoStartNext.x - ensoStart.x);
  ensoLeadIn = buildEnsoLeadIn(
    { x: gEnd.x, y: gEnd.y }, Math.atan2(gEnd.dir.y, gEnd.dir.x),
    ensoStart, ensoStartHeading,
  );

  // curve roam: the head leaves the enso at its exit (== enso start point, frac=1)
  // along the enso tangent, then flies the circle-chain path.
  const ensoExit = ensoPos(1);
  const ensoNext = ensoPos(1 + 1e-3);
  const ensoHeading = Math.atan2(ensoNext.y - ensoExit.y, ensoNext.x - ensoExit.x);
  curvePath = generateCirclePath(rng, ensoExit, ensoHeading);

  // Recompute timeline from actual path length so roam speed == SP2 exactly
  const curveDur = (curvePath.total - curvePath.headStart) / SP2;
  T_BRANCH = T_ENSO_END + curveDur;
  // Crossfade COMPLETES at T_BRANCH (when circles end).  Both 2D and 3D advance
  // on the same curvePath arc during [D3_START, T_BRANCH]; at T_BRANCH both heads
  // are at bp, 2D fades out, 3D exits into loop3.
  D3_START = T_BRANCH - CROSSFADE;
  D3_END = T_BRANCH;
  TIMELINE_END = T_BRANCH + 11.0;
  SPLASH_GROW_DUR = T_BRANCH;
  // update block objects that captured the placeholder values at module init
  blkInk.duration = D3_END;
  blkInk.branches.handoff = D3_START; // camera tilt + 3D fade begin one crossfade before T_BRANCH
  blkInk.branches.gone = D3_END;

  // 2D head arc on the curve roam when it branches to 3D: end of the path
  const branchS = curvePath.total;
  const bp = curvePath.pos(branchS);
  const tb = curvePath.tan(branchS); // 2D heading at the branch point
  // loop3: closed random 3D loop starting at bp.  The 3D dragon's frame array
  // contains a curvePath tail (flat circles) followed by loop3; during the crossfade
  // the 3D head traces the flat circles alongside the fading 2D dragon, then the
  // head exits into loop3 and loops there forever.
  const rest = randomLoopPivots(rng, LOOP3_PIVOTS, R3D, Z3D);
  clampExitPivot(rest, { x: bp.x, y: bp.y, dir: { x: tb.x, y: tb.y } }, MAX_EXIT_TURN);
  const ring3 = [{ x: bp.x, y: bp.y, z: 0 }, ...rest];
  relaxTurns(ring3, MIN_TURN, MAX_TURN, MAX_SHARP_RUN, (i) => i >= 1, RELAX_ITERS); // pin the branch anchor
  loop3 = buildSpline(ring3);
  loop3Phase = 0; // 3D head starts at bp (loop3 arc 0) at T_BRANCH

  buildDragon3dFrames();
  timeline.reset(); // fresh scene: re-run block setup on the next frame
  lastInkPhase = -1; // force a body refit on the first frame
  // seed body fitted to the path at the dragon's start (short, on the lead-in)
  reseedBody(T.dragonStart, BODY_LEN * ENTRY_GROW_MIN);
}

// Cross-section scale for the 3D mesh: dragon-low's in-plane span (~24 units)
// -> a stroke width close to the ink dragon's body width.
const D3_GIRTH = 0.006;

// 2D-dragon grow ramp: small + short while tracing the glyph, growing up after it
// leaves the glyph onto the enso. Shared by body length + head/stroke size.
function inkGrow(t) {
  return smooth(clamp((t - T_GLYPH_END) / GROW_DUR, 0, 1));
}
// Dragon is 0.8x full size in the enso and 2D fly phases (caps at 0.8 after the glyph trace).
const inkLenFrac  = (t) => lerp(ENTRY_GROW_MIN, t >= T_GLYPH_END ? 0.8 : 1.0, inkGrow(t));
const inkSizeFrac = (t) => lerp(ENTRY_SIZE_MIN, t >= T_GLYPH_END ? 0.8 : 1.0, inkGrow(t));

// ============================================================================
// Scene timeline - overlapping blocks (see timeline.js). Each block writes its
// slice into the shared ctx; buildState seeds ctx defaults, runs the timeline,
// then assembles the FrameState. Blocks attach to each other's branch points so
// they retime together and can be developed independently.
//   glyph     [0 ..]            holds undrawn through the lead-in, traces while the
//                               head rides it, then holds the symbol on the ground
//   inkDragon [0 .. gone]       leads every phase (lead-in straight stroke, glyph
//                               trace, enso, curve roam), then fades. The head is
//                               hidden until the back half of the glyph trace.
//                               branches: `traced`, `handoff`, `gone`
//   enso      (after glyph.end) sweeps the enso circle behind the head, then fades
//                               to ENSO_FADE_TARGET at the 3D handoff
//   camera    (after ink.handoff) tilts top-down -> 45deg over the crossfade
//   dragon3d  (after ink.handoff) fades in and flies its loop forever
//   grid      (after ink.traced)  radial wipe-in of the ground grid
// ============================================================================
const HEAD_REVEAL_T0 = T_GLYPH_START + GLYPH_TRACE_DUR * 0.5; // head fades in here
const blkGlyph = {
  name: "glyph",
  at: 0, // persistent: 0 through the lead-in, traces, then holds the symbol
  branches: { end: T_GLYPH_END },
  update(ctx) {
    ctx.playhead = ctx.t < T_GLYPH_START ? 0 : ramp(ctx.t, T_GLYPH_START, T_GLYPH_END, 0, glyphTotal);
  },
};

const blkInk = {
  name: "inkDragon",
  at: 0, // the 2D dragon is the first thing on screen (lead-in straight stroke)
  duration: D3_END,
  branches: {
    traced: T_GLYPH_END,  // head finished tracing the glyph
    handoff: T_BRANCH,    // branch onto loop3 (3D handoff)
    gone: D3_END,         // 2D ink fully faded
  },
  // entering, or seeking in/within: refit the body on-path (no physics history,
  // no straight teleport) so a scrub lands on a valid on-curve pose.
  setup(ctx) { reseedBody(ctx.t, BODY_LEN * inkLenFrac(ctx.t)); lastInkPhase = phaseOf(ctx.t); },
  seek(ctx) { reseedBody(ctx.t, BODY_LEN * inkLenFrac(ctx.t)); lastInkPhase = phaseOf(ctx.t); },
  update(ctx) {
    const t = ctx.t;
    const inkReveal = ramp(t, T.dragonStart, T.dragonStart + 0.4, 0, 1);
    const inkFade = ramp(t, D3_START, D3_END, 1, 0); // fades as the 3D dragon appears
    ctx.inkAlpha = Math.min(inkReveal, inkFade);
    // head hidden through the lead-in + first half of the glyph trace, then fades in
    ctx.headAlpha = ramp(t, HEAD_REVEAL_T0, T_GLYPH_END, 0, 1);
    const sizeFrac = inkSizeFrac(t);
    ctx.inkWidthScale = sizeFrac;
    ctx.headSize = HEAD_SIZE * sizeFrac;
    const growLen = BODY_LEN * inkLenFrac(t);
    // refit when a phase boundary is crossed (phases don't share an arc param);
    // otherwise step the verlet chain. seeks are resynced by setup/seek above.
    const ph = phaseOf(t);
    // Enso→curve and curve→loop3 are positionally continuous: head doesn't snap,
    // so let the verlet chain keep running instead of reseeding (which would put
    // the body in a straight line and cause a visible snap).
    const smoothCross = (lastInkPhase === 3 && ph === 4) || (lastInkPhase === 4 && ph === 5);
    if (body.length < 2 || (ph !== lastInkPhase && !smoothCross)) reseedBody(t, growLen);
    else stepBody(tipAt(t), growLen);
    lastInkPhase = ph;
  },
};

// Enso circle: the head sweeps it (ensoSweep drives the shader stroke); held full
// after the sweep, then fades to ENSO_FADE_TARGET as the 3D dragon takes over.
const blkEnso = {
  name: "enso",
  after: { block: "glyph", branch: "end" },
  update(ctx) {
    const t = ctx.t;
    ctx.ensoSweep = clamp((t - T_ENSO_START) / ENSO_DUR, 0, 1); // 0 through the branch
    const ensoIn = ramp(t, T_ENSO_START, T_ENSO_START + 0.3, 0, 1);
    const ensoFade = ramp(t, D3_START, D3_END, 1, ENSO_FADE_TARGET);
    ctx.ensoAlpha = Math.min(ensoIn, ensoFade);
  },
};

// camera/dragon3d/grid are PERSISTENT (no duration): once started they keep
// updating forever, holding their end state (full tilt / dragon looping / grid
// revealed) instead of tearing down and snapping back to defaults.
const blkCamera = {
  name: "camera",
  after: { block: "inkDragon", branch: "handoff" },
  update(ctx, local) {
    ctx.camPitch = smooth(clamp(local / CAM_PITCH_DUR, 0, 1)) * CAM_PITCH_ANGLE;
  },
};

const blkDragon3d = {
  name: "dragon3d",
  after: { block: "inkDragon", branch: "handoff" },
  update(ctx) {
    ctx.d3Alpha = ramp(ctx.t, D3_START, D3_END, 0, 1); // flies its loop forever (dragon3dDraw advances with t)
    ctx.glyphAlpha = ramp(ctx.t, D3_START, D3_END, 1, GLYPH_FADE_TARGET); // glyph eases back during the 3D transition
  },
};

// Ink splash bleeds in at the start and keeps spreading across the 2D phase,
// following the glyph trace (reveal-aware in the shader). Persistent: once the
// spread reaches full it holds, so the wash stays under the 3D dragon.
const blkSplash = {
  name: "splash",
  at: 0,
  update(ctx) {
    ctx.splashAlpha = smooth(clamp(ctx.t / SPLASH_FADE_IN, 0, 1));
    ctx.splashGrow = smooth(clamp(ctx.t / SPLASH_GROW_DUR, 0, 1));
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

const timeline = makeTimeline([blkSplash, blkGlyph, blkInk, blkEnso, blkCamera, blkDragon3d, blkGrid]);

// Build the FrameState for scene time t. showDebug adds path polylines; orbit =
// { yaw } (pitch is scripted by the camera block). Seeds ctx defaults (= nothing
// happening, so inactive blocks need no teardown to clear), runs the overlapping
// timeline blocks, then assembles the FrameState from ctx.
export function buildState(t, aspect, debug = {}, orbit = null, debugBuffer = "none") {
  const ctx = {
    t,
    playhead: glyphTotal,      // glyph held fully drawn unless the glyph block traces
    inkAlpha: 0, d3Alpha: 0,
    glyphAlpha: 1.0,           // full until the 3D transition eases it back
    ensoAlpha: 0, ensoSweep: 0, // enso circle (drawn during/after the enso phase)
    headAlpha: 1,              // ink-dragon head opacity (hidden early in the trace)
    splashAlpha: 0, splashGrow: 0,
    gridStrength: 0, gridReveal: 0, gridRevealMinor: 0,
    camPitch: 0,               // top-down until the camera block tilts
    inkWidthScale: 1, headSize: HEAD_SIZE,
  };
  timeline.frame(ctx, t);

  const frame = headFrame(body);
  // user yaw locked to 0 during 2D phase; lerps in over the crossfade (no snap)
  const rawYaw = (orbit && orbit.yaw) || 0;
  const userYaw = t < T_BRANCH ? 0 : ramp(t, D3_START, D3_END, 0, rawYaw);
  const viewProj = sceneViewProj(aspect, { yaw: userYaw, pitch: ctx.camPitch });

  return {
    aspect,
    opacity: { glyph: ctx.glyphAlpha, inkDragon: ctx.inkAlpha, dragon3d: ctx.d3Alpha },
    grid: { opacity: ctx.gridStrength, reveal: ctx.gridReveal, revealMinor: ctx.gridRevealMinor, viewProj, ext: GRID.ext, z: GRID.z, step: GRID.step, minorDiv: GRID_MINOR_DIV },
    glyph: { segs: glyphSegs, playhead: ctx.playhead, baseRadius: GLYPH_RADIUS },
    // procedural ink-splash blob (origin-centred, grows + splatters over time)
    splash: { alpha: ctx.splashAlpha, grow: ctx.splashGrow, spread: SPLASH_SPREAD, amount: SPLASH_AMOUNT, time: t },
    // enso circle (origin-centred); sweep = head fraction around it -> shader stroke
    enso: { alpha: ctx.ensoAlpha, sweep: ctx.ensoSweep, radius: ENSO_R, lineWidth: ENSO_WIDTH, angleStart: Math.PI / 2 - ensoA0, time: t },
    inkDragon: {
      body,
      head: { pos: frame.pos, dir: frame.dir, size: ctx.headSize, alpha: ctx.headAlpha },
      widthScale: ctx.inkWidthScale, // body stroke width grows with size
    },
    dragon3d: (() => {
      // pick the buffer (transition vs pure loop3 ring) + head offset for time t
      const d3 = dragon3dDraw(t);
      return {
        frames: d3.frames,
        frameCount: D3.N,
        pathLen: d3.pathLen,
        bodyLen: BODY_LEN * D3.bodyFactor,
        // mesh head is at x=1 (leads by bodyLen); headOffset already accounts for it.
        headOffset: d3.headOffset,
        girth: D3_GIRTH,
        viewProj,
        time: t,
      };
    })(),
    debug: (debug.path2d || debug.path3d)
      ? (() => {
          const tip = tipAt(t);
          const hx = tip.dir.x, hy = tip.dir.y;
          const poolLeft = [], poolRight = [];
          for (const p of curvePool) {
            const cross = hx * (p.y - tip.y) - hy * (p.x - tip.x);
            (cross > 0.01 ? poolLeft : poolRight).push(p.x, p.y, 0);
          }
          return {
            show: true, buffer: debugBuffer,
            path2d: debug.path2d ? samplePath2d(t) : [],
            path3d: debug.path3d ? samplePath3d() : [],
            poolLeft: new Float32Array(poolLeft),
            poolRight: new Float32Array(poolRight),
          };
        })()
      : { show: false, buffer: debugBuffer },
  };
}
