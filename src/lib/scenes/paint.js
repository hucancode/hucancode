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
// The timeline is defined as overlapping blocks below (see the block section).

import { longSymbol } from "$lib/brush/long.js";
import { bakeSegs } from "$lib/brush/bake.js";
import { TAU, clamp, lerp, smooth, ramp } from "$lib/math/scalar.js";
import * as mat4 from "$lib/math/mat4.js";
import { makeTimeline } from "./timeline.js";

// ---- timeline knobs --------------------------------------------------------
const T = {
  dragonStart: 0, // the 2D dragon is the FIRST thing on screen (a straight stroke)
  // camera tilt + 2D->3D crossfade + grid reveal are timed off the branch
  // (D3_START/END, CAM_*, GRID_* defined with the flight-path constants below).
};

// ============================================================================
// Flight path - the 2D ink dragon LEADS every phase (head at the front, ink
// filling in behind), then hands off to a 3D loop. Phases: lead-in -> glyph
// trace -> enso -> circle roam -> 3D handoff (see phaseOf / pathAt below).
// ============================================================================
const LEADIN_DUR = 0.5;       // straight glide from the top onto the glyph start
const LEADIN_START = { x: 0, y: 0.78 }; // top-middle, far from the glyph entry
const GLYPH_TRACE_DUR = 3.5;  // 1.5 = head traces the whole glyph, leading the reveal
const LEAD_OFFSET = 0.5;      // 2D dragon head leads the ink reveal (glyph + enso) by this many seconds
// 2D dragon glyph-trace exit: it peels off the glyph onto the enso at the END of
// this baked-segment index (0-based into glyphSegs). null / out-of-range -> the
// final segment (trace the whole symbol; the original behaviour). Earlier indices
// exit sooner and hold the glyph reveal partially drawn at that point.
const GLYPH_EXIT_SEG = 45;
const ENSO_LEADIN_DUR = 0.6;  // branch off the glyph end onto the enso (no snap)
const ENSO_R = 0.4;           // enso radius (world units; <1 keeps it on-screen)
const ENSO_WIDTH = 0.05;      // enso brush thickness (polar line width in the shader)
const GROW_DUR = 2.5;         // body grows up after the glyph trace (over the enso)
const ENTRY_GROW_MIN = 0.2;   // body length fraction while tracing the glyph
const ENTRY_SIZE_MIN = 0.4;   // body width / head size fraction while tracing

// 2D roam: the FRAME is fixed (no randomness) — only the dragon's WALK through it
// is random (which touching circle it branches onto). The frame:
//   * 1 grand circle (the enso itself, radius ENSO_R)
//   * 2 lobe circles (radius FRAME_SMALL_R·ENSO_R) tangent to EACH OTHER at the
//     origin and internally tangent to the enso (a vesica across FRAME_INNER_AXIS)
//   * FRAME_MEDIUM_N medium circles externally tangent to the enso, evenly spaced,
//     NOT overlapping each other (radius FRAME_MEDIUM_R·ENSO_R, clamped down to the
//     touching limit if that fraction would overlap at the given count).
// The dragon rides circle arcs and ONLY changes circles at a tangency point, where
// it randomly branches onto a touching circle or stays on the current one. Tangency
// means both circles share a tangent there, so either choice is C1-smooth.
const FRAME_SMALL_R = 0.5;          // vesica-lobe radius as a fraction of ENSO_R
const FRAME_MEDIUM_N = 8;           // medium circles externally tangent to the enso
const FRAME_MEDIUM_R = 0.7;         // medium radius as a fraction of ENSO_R (clamped, see below)
const FRAME_INNER_AXIS = Math.PI / 8; // vesica-pair axis (offset off the medium spokes)
const FRAME_BRANCH_P = 0.5;         // chance to switch circles at a touching point
const FRAME_MIN_LEN = 9.0;          // keep walking until the path is at least this long
const FRAME_MAX_STEPS = 80;         // hard cap on arcs walked (safety)
const FRAME_SAMPLES = 96;           // dense samples per full (2π) revolution
const FRAME_TAN_EPS = 1e-4;         // tangency / coincident-point tolerance

// 3D loop: a clean (NOT random) closed orbit that rings the whole rosette, lifted
// out of plane so the dragon reads as rising off the flat frame. Anchored at the
// branch point so the fading 2D dragon overlaps it through the crossfade, then the
// 3D dragon flies this orbit forever (see orbitPivots / buildDragon3dFrames).
const R3D = 0.95;            // 3D orbit radius (x/y) — rings the rosette (frame reaches ~0.9)
const Z3D = 0.45;            // 3D orbit out-of-plane amplitude (height once the camera tilts)
const LOOP3_PIVOTS = 12;     // pivots around the orbit
const LOOP3_WAVES = 3;       // z undulations per orbit (full periods, so z closes smoothly)
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
// Sequential handoff split: the 3D dragon (drawn ON TOP, dark mesh) fades in over
// [D3_START, D3_MID] while the 2D ink is still solid and exactly coincident; then
// the white 2D ink fades out under it over [D3_MID, D3_END]. A symmetric fade left
// a gap — the white ink reads at low alpha but the dark mesh does not, so the 2D
// vanished before the 3D was perceptible. Sequencing keeps a dragon on screen throughout.
const D3_FADEIN_FRAC = 0.55; // fraction of the crossfade spent fading the 3D dragon IN
let D3_MID = D3_START;

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

// Arc-length parameterise a polyline of dense {x,y,z} samples. Returns pos(s) /
// tan(s) keyed on arc length s, the loop `total`, and arcAt(i) = arc length at
// dense index i. `closed` wraps s on total (looping path); otherwise s clamps to
// the ends. The single source of truth for every spline/curve sampler below.
function arcLengthCurve(dense, closed) {
  const N = dense.length;
  const last = N - 1;
  const cum = new Float64Array(N);
  for (let i = 1; i < N; i++) {
    const a = dense[i - 1], b = dense[i];
    cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, (b.z || 0) - (a.z || 0));
  }
  const total = cum[last] || 1;
  function locate(d) {
    let lo = 0, hi = last;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < d) lo = mid + 1; else hi = mid; }
    return Math.max(1, lo);
  }
  function pos(s) {
    const d = closed ? ((s % total) + total) % total : clamp(s, 0, total);
    const i = locate(d);
    const seg = cum[i] - cum[i - 1] || 1e-6;
    const k = (d - cum[i - 1]) / seg;
    const a = dense[i - 1], b = dense[i];
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z || 0, b.z || 0, k) };
  }
  function tan(s) {
    const e = total * 1e-3;
    const base = closed ? s : clamp(s, 0, total - e);
    const a = pos(base), b = pos(base + e);
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const m = Math.hypot(dx, dy, dz) || 1;
    return { x: dx / m, y: dy / m, z: dz / m };
  }
  const arcAt = (i) => cum[clamp(Math.round(i), 0, last)];
  return { pos, tan, total, arcAt };
}

// Closed Catmull-Rom spline (pos/tan wrap on s), arc-length parameterised.
function buildSpline(pivots) {
  const K = pivots.length;
  const M = 2048;
  const dense = new Array(M + 1);
  for (let i = 0; i <= M; i++) dense[i] = catmullClosed(pivots, (i / M) * K);
  return arcLengthCurve(dense, true);
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

// OPEN Catmull-Rom spline through pivots (pos/tan clamp at the ends), arc-length
// parameterised. arcAtU(u) gives the arc length at pivot-index u (u in [0, K-1]).
function buildOpenSpline(pivots) {
  const K = pivots.length;
  const M = 2048;
  const span = K - 1;
  const dense = new Array(M + 1);
  for (let i = 0; i <= M; i++) dense[i] = catmullOpen(pivots, (i / M) * span);
  const curve = arcLengthCurve(dense, false);
  const arcAtU = (u) => curve.arcAt(clamp(u / span, 0, 1) * M);
  return { ...curve, arcAtU };
}

// Even pivots on a circle of `radius`, z undulating `waves` full periods per turn
// (so z returns to 0 at the seam -> a clean closed loop). `phase` sets the start
// angle. Deterministic — the dragon's 3D orbit is a definite path, not random.
function orbitPivots(count, radius, zAmp, waves, phase) {
  const pts = new Array(count);
  for (let k = 0; k < count; k++) {
    const f = k / count;
    const a = phase + f * TAU;
    pts[k] = { x: radius * Math.cos(a), y: radius * Math.sin(a), z: zAmp * Math.sin(waves * f * TAU) };
  }
  return pts;
}

let rng = null;            // session PRNG (seeded in initScene)
let ensoLeadIn = null;     // short branch from the glyph end onto the enso circle
let curvePath = null;      // 2D roam spline the ink dragon follows
let curvePool = [];        // pool of {x,y,z} waypoints used to build curvePath (debug)
let _poolF32 = null;       // cached Float32Array of curvePool centres (debug points)
let loop3 = null;          // 3D random loop the 3D dragon flies
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

// Build the rosette frame as a list of {cx, cy, r} circles, then wire up every
// tangency between them. A tangency is stored on BOTH circles as {a, j, aj}:
// the angle on this circle, the partner index, and the angle on the partner at
// the shared point. Tangencies are detected numerically — external when the
// centre distance equals ri+rj, internal when it equals |ri-rj| — so the exact
// pairings (and any triple points) fall out without special-casing.
function buildFrame() {
  const R = ENSO_R;
  const circles = [{ cx: 0, cy: 0, r: R }]; // 0: the enso (grand circle)

  // vesica pair: two equal circles tangent at the origin, each internally tangent
  // to the enso at the ends of the FRAME_INNER_AXIS diameter. Touching at O +
  // internally tangent forces radius = R/2, so FRAME_SMALL_R is fixed at 0.5.
  const ir = FRAME_SMALL_R * R;
  for (const s of [1, -1]) {
    circles.push({ cx: s * ir * Math.cos(FRAME_INNER_AXIS), cy: s * ir * Math.sin(FRAME_INNER_AXIS), r: ir });
  }

  // medium ring: FRAME_MEDIUM_N equal circles externally tangent to the enso,
  // evenly spaced. Non-overlap needs (R+r)·sin(π/n) >= r, i.e. r <= R·sin/(1-sin);
  // clamp the requested radius to that limit (at the limit neighbours just touch).
  const s = Math.sin(Math.PI / FRAME_MEDIUM_N);
  const rMaxNoOverlap = (R * s) / (1 - s);
  const rmed = Math.min(FRAME_MEDIUM_R * R, rMaxNoOverlap);
  const MD = R + rmed; // centre distance for external tangency to the enso
  for (let k = 0; k < FRAME_MEDIUM_N; k++) {
    const a = k * (TAU / FRAME_MEDIUM_N);
    circles.push({ cx: MD * Math.cos(a), cy: MD * Math.sin(a), r: rmed });
  }

  // wire tangencies (numeric: handles internal, external and coincident points)
  for (const c of circles) c.tan = [];
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i], b = circles[j];
      const dx = b.cx - a.cx, dy = b.cy - a.cy;
      const d = Math.hypot(dx, dy) || 1e-9;
      const ext = Math.abs(d - (a.r + b.r)) < FRAME_TAN_EPS;
      const int = Math.abs(d - Math.abs(a.r - b.r)) < FRAME_TAN_EPS;
      if (!ext && !int) continue;
      // touch point: external -> on the segment between centres; internal -> on
      // the bigger circle along the centre line toward the smaller.
      let px, py;
      if (ext) {
        px = a.cx + (dx / d) * a.r; py = a.cy + (dy / d) * a.r;
      } else {
        const aBig = a.r >= b.r;
        const big = aBig ? a : b, sgn = aBig ? 1 : -1;
        px = big.cx + (sgn * dx / d) * big.r; py = big.cy + (sgn * dy / d) * big.r;
      }
      const ai = Math.atan2(py - a.cy, px - a.cx);
      const aj = Math.atan2(py - b.cy, px - b.cx);
      a.tan.push({ a: ai, j, aj });
      b.tan.push({ a: aj, j: i, aj: ai });
    }
  }
  return circles;
}

// Walk the frame: start on the enso (circle 0) at `entry`, riding the arc whose
// tangent matches `heading` (so it continues the enso sweep with no kink). At
// each tangency point either stay on the current circle or branch onto a touching
// one (FRAME_BRANCH_P). Either way the join is C1-smooth, so the partner's
// rotation direction is forced — derived by matching the arrival tangent. Walks
// until the polyline is at least FRAME_MIN_LEN long, ending ON a tangency point.
function walkFrame(rng, circles, entry, heading) {
  let ci = 0;
  let ang = Math.atan2(entry.y - circles[0].cy, entry.x - circles[0].cx);
  // tangent for dir=+1 is (-sin, cos); pick the dir whose tangent agrees with heading
  let dir = (-Math.sin(ang) * Math.cos(heading) + Math.cos(ang) * Math.sin(heading)) >= 0 ? 1 : -1;

  const pts = [{ x: entry.x, y: entry.y, z: 0 }];
  let len = 0;
  let swept = 0; // angle swept on the CURRENT circle since entering it
  for (let step = 0; step < FRAME_MAX_STEPS; step++) {
    const c = circles[ci];
    // next tangency on this circle in travel direction (smallest positive sweep)
    let best = null, bestSweep = Infinity;
    for (const tp of c.tan) {
      let sweep = ((dir * (tp.a - ang)) % TAU + TAU) % TAU;
      if (sweep < FRAME_TAN_EPS) sweep += TAU; // skip the point we're sitting on
      if (sweep < bestSweep) { bestSweep = sweep; best = tp; }
    }
    if (!best) break; // isolated circle (never happens on a wired frame)

    // sample the arc from `ang` sweeping `bestSweep` in `dir`
    const n = Math.max(2, Math.round(FRAME_SAMPLES * bestSweep / TAU));
    for (let i = 1; i <= n; i++) {
      const t = ang + dir * bestSweep * (i / n);
      pts.push({ x: c.cx + c.r * Math.cos(t), y: c.cy + c.r * Math.sin(t), z: 0 });
    }
    len += c.r * bestSweep;
    swept += bestSweep;
    ang = best.a; // now sitting on the tangency point

    if (len >= FRAME_MIN_LEN) break; // end on a tangency -> clean 3D handoff

    // commit to at least half the circle before peeling off (no quick in/out)
    if (swept >= Math.PI - FRAME_TAN_EPS && rng() < FRAME_BRANCH_P) {
      // branch onto the partner; preserve the tangent -> derive the partner's dir
      const aj = best.aj;
      const tx = dir * -Math.sin(ang), ty = dir * Math.cos(ang); // arrival tangent
      const ndir = (tx * -Math.sin(aj) + ty * Math.cos(aj)) >= 0 ? 1 : -1;
      ci = best.j; ang = aj; dir = ndir; swept = 0;
    }
    // else: stay on the same circle, keep going past this tangency
  }
  return pts;
}

// 2D roam path: walk the rosette frame from the enso exit, prepend two body
// lead-in points behind the entry (so the verlet chain has something to trail),
// and arc-length parameterise the dense polyline (open path).
function generateFramePath(rng, entry, heading) {
  const circles = buildFrame();
  curvePool = circles.map((c) => ({ x: c.cx, y: c.cy, z: 0 })); // debug: circle centres
  _poolF32 = null; // invalidate cached debug-point buffer
  const hdx = Math.cos(heading), hdy = Math.sin(heading);
  const walk = walkFrame(rng, circles, entry, heading); // walk[0] === entry
  const allPts = [
    { x: entry.x - hdx * BODY_LEN * 2, y: entry.y - hdy * BODY_LEN * 2, z: 0 },
    { x: entry.x - hdx * BODY_LEN,     y: entry.y - hdy * BODY_LEN,     z: 0 },
    ...walk,
  ];
  const headEntryIdx = 2; // allPts[2] === entry
  const curve = arcLengthCurve(allPts, false);
  return { ...curve, headStart: curve.arcAt(headEntryIdx) };
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

// The 2D ink-dragon head LEADS through a sequence of PHASES (it is the leading
// edge of the ink / reveal). Each phase is self-contained:
//   end        absolute scene time the phase ends (its pivot; phaseOf/the timeline
//              key off these boundaries). Infinity = runs out.
//   continuous entering this phase from the previous one is positionally smooth,
//              so the verlet body chain keeps running (no reseed). false phases
//              don't share an arc parameter with the previous, so the body is
//              refit onto the new curve on entry.
//   path(t)    head sampler { fn, a }: fn(a) is the head point, a the arc/frac
//              parameter (tipAt/reseedBody sample fn around a).
// Built in initScene once the paths + branch time are final (closures read the
// live curves/constants). After the branch the head holds at the curve end, where
// the inkDragon block has already faded out.
let PHASES = [];
const curveHead = (a) => { const p = curvePath.pos(a); return { x: p.x, y: p.y }; };
function makePhases() {
  return [
    { name: "leadin", end: T_GLYPH_START, continuous: false,
      path: (t) => ({ fn: leadInPos, a: clamp((t - T.dragonStart) / LEADIN_DUR, 0, 1) }) },
    { name: "glyph", end: T_GLYPH_END, continuous: false,
      path: (t) => ({ fn: (a) => { const p = glyphStrokeAt(a); return { x: p.x, y: p.y }; },
        a: clamp((t - T_GLYPH_START) / GLYPH_TRACE_DUR, 0, 1) * glyphExitPh }) },
    { name: "ensoBranch", end: T_ENSO_START, continuous: false,
      path: (t) => ({ fn: (a) => { const p = ensoLeadIn.pos(a); return { x: p.x, y: p.y }; },
        a: lerp(ensoLeadIn.headStart, ensoLeadIn.endArc, clamp((t - T_GLYPH_END) / ENSO_LEADIN_DUR, 0, 1)) }) },
    // continuous: the ensoBranch exit == ensoPos(0) with matched tangent, so the
    // verlet body keeps trailing onto the circle (no reseed = no body snap/jump).
    { name: "enso", end: T_ENSO_END, continuous: true,
      path: (t) => ({ fn: ensoPos, a: clamp((t - T_ENSO_START) / ENSO_DUR, 0, 1) }) },
    { name: "roam", end: T_BRANCH, continuous: true,
      path: (t) => ({ fn: curveHead, a: curvePath.headStart + Math.max(0, t - T_ENSO_END) * SP2 }) },
    { name: "loop3", end: Infinity, continuous: true,
      path: () => ({ fn: curveHead, a: curvePath.total }) },
  ];
}
// Index of the phase scene-time t is in (refit the body when a boundary is crossed).
function phaseOf(t) {
  for (let i = 0; i < PHASES.length; i++) if (t < PHASES[i].end) return i;
  return PHASES.length - 1;
}
const pathAt = (t) => PHASES[phaseOf(t)].path(t);
function tipAt(t) {
  const { fn, a } = pathAt(t);
  const p = fn(a), p2 = fn(a + 1e-3);
  let dx = p2.x - p.x, dy = p2.y - p.y;
  const m = Math.hypot(dx, dy) || 1;
  return { x: p.x, y: p.y, dir: { x: dx / m, y: dy / m } };
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
const PROP_SPEED = 0.2; // chain relaxation per step (verlet lag)
const ENABLE_PHYSICS = true; // false -> body rigidly matches the line of motion (refit on-path each frame, no verlet trail)
const MAX_BEND = (60 * Math.PI) / 180;
const HEAD_SIZE = 0.1;

let body = [];
let _next = null; // persistent scratch chain swapped with body in stepBody (no per-frame alloc)
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
function ensureNext(n) {
  if (_next && _next.length === n) return;
  _next = new Array(n);
  for (let i = 0; i < n; i++) _next[i] = { x: 0, y: 0 };
}
function stepBody(tip, len = BODY_LEN) {
  const N = body.length;
  if (N < 2) return;
  const linkLen = len / (N - 1);
  const speed = PROP_SPEED;
  ensureNext(N);
  const next = _next;
  for (let i = 0; i < N; i++) { next[i].x = body[i].x; next[i].y = body[i].y; }
  next[N - 1].x = tip.x; next[N - 1].y = tip.y;

  for (let i = N - 2; i >= 0; i--) {
    const dx = next[i + 1].x - next[i].x, dy = next[i + 1].y - next[i].y;
    const d = Math.hypot(dx, dy);
    if (d > linkLen && d > 1e-6) {
      const inv = ((d - linkLen) * speed) / d;
      next[i].x += dx * inv; next[i].y += dy * inv;
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
        next[i - 1].x = mid.x + (adx * c - ady * s) * bLen;
        next[i - 1].y = mid.y + (adx * s + ady * c) * bLen;
      }
    }
    for (let i = N - 2; i >= 0; i--) {
      const dx = next[i + 1].x - next[i].x, dy = next[i + 1].y - next[i].y;
      const d = Math.hypot(dx, dy);
      if (d > linkLen && d > 1e-6) {
        const inv = ((d - linkLen) * speed) / d;
        next[i].x += dx * inv; next[i].y += dy * inv;
      }
    }
  }
  // swap: result becomes body, old body becomes the reusable scratch (no alloc)
  _next = body;
  body = next;
}

// Write the head pose (neck-offset position + heading) into `head` in place.
// perp is unused by the renderer, so it is not emitted. The head aligns with the
// true PATH tangent at the tip (the edge it rides) when given — the verlet body
// chain lags on curves, so its last-segment heading drifts off the edge tangent;
// fall back to that heading only if the tangent is degenerate (e.g. held at the
// curve end, where the 2D dragon has already faded out).
function writeHeadFrame(body, head, tangent) {
  const n = body.length;
  const tip = body[n - 1], prev = body[n - 2];
  let dx, dy;
  if (tangent && (tangent.x || tangent.y)) { dx = tangent.x; dy = tangent.y; }
  else { dx = tip.x - prev.x; dy = tip.y - prev.y; }
  const m = Math.hypot(dx, dy) || 1;
  dx /= m; dy /= m;
  const neck = 0.05;
  head.pos.x = tip.x + dx * neck;
  head.pos.y = tip.y + dy * neck;
  head.dir.x = dx;
  head.dir.y = dy;
}

// ============================================================================
// Glyph (baked once)
// ============================================================================
let glyphSegs = [];
let glyphTotal = 1;
let glyphExitPh = 1; // playhead where the trace peels onto the enso (<= glyphTotal)

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

// ---- orbit camera (perspective; column-major mat4) -------------------------
const CAM = { fov: (45 * Math.PI) / 180, dist: 2.6 };
// reused scratch so building the view-proj allocates nothing per frame; the
// returned `_vpResult` is fully consumed (uploaded) by the renderer each frame.
const _vpProj = mat4.create();
const _vpRot = mat4.create();
const _vpTmp = mat4.create();
const _vpResult = mat4.create();
function sceneViewProj(aspect, yaw, pitch) {
  mat4.perspective(_vpProj, CAM.fov, aspect, 0.1, 60);
  // ground is the x/y plane, so +z is up. Yaw spins about z (the ground normal);
  // pitch then tilts elevation. rotZ first so yaw stays a true heading once tilted.
  mat4.rotationZ(_vpRot, yaw);
  mat4.rotationX(_vpTmp, pitch);
  mat4.multiply(_vpRot, _vpTmp, _vpRot);          // rotX(pitch) * rotZ(yaw)
  mat4.translation(_vpTmp, 0, 0, -CAM.dist);
  mat4.multiply(_vpRot, _vpTmp, _vpRot);          // pull camera back along +z
  return mat4.multiply(_vpResult, _vpProj, _vpRot);
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

  // resolve the glyph-trace exit playhead from the configured segment index:
  // the head peels onto the enso at the END of that baked segment.
  const lastSeg = glyphSegs.length - 1;
  const exitSeg = GLYPH_EXIT_SEG == null ? lastSeg : clamp(Math.round(GLYPH_EXIT_SEG), 0, lastSeg);
  const es = glyphSegs[exitSeg];
  glyphExitPh = es ? Math.min(es.t0 + es.dur, glyphTotal) : glyphTotal;

  // fresh random paths each load (seeded once -> stable within the session)
  rng = mulberry32((Math.random() * 4294967296) >>> 0);

  // lead-in target = glyph pen at playhead 0
  const g0 = glyphStrokeAt(0);
  glyphEntry = { x: g0.x, y: g0.y };
  const gEnd = glyphStrokeAt(glyphExitPh);
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
  curvePath = generateFramePath(rng, ensoExit, ensoHeading);

  // Recompute timeline from actual path length so roam speed == SP2 exactly
  const curveDur = (curvePath.total - curvePath.headStart) / SP2;
  T_BRANCH = T_ENSO_END + curveDur;
  // Crossfade COMPLETES at T_BRANCH (when circles end).  Both 2D and 3D advance
  // on the same curvePath arc during [D3_START, T_BRANCH]; at T_BRANCH both heads
  // are at bp, 2D fades out, 3D exits into loop3.
  D3_START = T_BRANCH - CROSSFADE;
  D3_END = T_BRANCH;
  D3_MID = D3_START + CROSSFADE * D3_FADEIN_FRAC; // 3D fully in by here, THEN the 2D fades
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
  // loop3: a clean 3D orbit ringing the rosette, starting at bp. The 3D dragon's
  // frame array is the curvePath tail (flat frame) followed by loop3; during the
  // crossfade the 3D head traces the flat frame alongside the fading 2D dragon,
  // then peels off bp UP into the orbit and flies it forever. The orbit is seeded
  // at bp's angle so its first pivot sits roughly along the exit -> a short swoop
  // from bp onto the ring; clampExitPivot then pins the peel-off tangent to tb.
  const bpA = Math.atan2(bp.y, bp.x);
  const rest = orbitPivots(LOOP3_PIVOTS, R3D, Z3D, LOOP3_WAVES, bpA);
  clampExitPivot(rest, { x: bp.x, y: bp.y, dir: { x: tb.x, y: tb.y } }, MAX_EXIT_TURN);
  const ring3 = [{ x: bp.x, y: bp.y, z: 0 }, ...rest];
  relaxTurns(ring3, MIN_TURN, MAX_TURN, MAX_SHARP_RUN, (i) => i >= 1, RELAX_ITERS); // pin the branch anchor
  loop3 = buildSpline(ring3); // 3D head starts at bp (loop3 arc 0) at T_BRANCH

  buildDragon3dFrames();
  PHASES = makePhases(); // paths + T_BRANCH are final; phaseOf/pathAt key off this
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
// Scene timeline - overlapping blocks (see timeline.js). Each block owns a slice
// of ctx: defaults() restores its resting values every frame, update() writes
// them while active. buildState runs the timeline then assembles the FrameState.
// Blocks attach to each other's branch points so they retime together.
//   glyph     [0 ..]              undrawn -> traces while the head rides it -> held
//   inkDragon [0 .. gone]         leads every phase, then fades; branches:
//                                 `traced`, `handoff`, `gone`
//   enso      (after glyph.end)   sweeps behind the head, fades at the 3D handoff
//   camera    (after ink.handoff) tilts top-down -> 45deg over the crossfade
//   dragon3d  (after ink.handoff) fades in and flies its loop forever
//   grid      (after ink.traced)  radial wipe-in of the ground grid
// ============================================================================
const HEAD_REVEAL_T0 = T_GLYPH_START + GLYPH_TRACE_DUR * 0.5; // head fades in here
const blkGlyph = {
  name: "glyph",
  at: 0, // persistent: 0 through the lead-in, traces, then holds the symbol
  branches: { end: T_GLYPH_END },
  defaults(ctx) { ctx.playhead = glyphTotal; ctx.glyphAlpha = 1.0; }, // glyphAlpha eased by dragon3d
  update(ctx) {
    // Reveal trails the head by LEAD_OFFSET so the dragon LEADS the glyph fill;
    // after the head peels onto the enso it keeps drawing the rest at the same speed.
    const speed = glyphExitPh / GLYPH_TRACE_DUR; // playhead units / sec
    ctx.playhead = clamp((ctx.t - T_GLYPH_START - LEAD_OFFSET) * speed, 0, glyphTotal);
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
  defaults(ctx) { ctx.inkAlpha = 0; ctx.headAlpha = 1; ctx.inkWidthScale = 1; ctx.headSize = HEAD_SIZE; },
  // entering, or seeking in/within: refit the body on-path (no physics history,
  // no straight teleport) so a scrub lands on a valid on-curve pose.
  setup(ctx) { reseedBody(ctx.t, BODY_LEN * inkLenFrac(ctx.t)); lastInkPhase = phaseOf(ctx.t); },
  seek(ctx) { reseedBody(ctx.t, BODY_LEN * inkLenFrac(ctx.t)); lastInkPhase = phaseOf(ctx.t); },
  update(ctx) {
    const t = ctx.t;
    const inkReveal = ramp(t, T.dragonStart, T.dragonStart + 0.4, 0, 1);
    const inkFade = ramp(t, D3_MID, D3_END, 1, 0); // holds full until the 3D dragon is in, then fades out under it
    ctx.inkAlpha = Math.min(inkReveal, inkFade);
    // head hidden through the lead-in + first half of the glyph trace, then fades in
    ctx.headAlpha = ramp(t, HEAD_REVEAL_T0, T_GLYPH_END, 0, 1);
    const sizeFrac = inkSizeFrac(t);
    ctx.inkWidthScale = sizeFrac;
    ctx.headSize = HEAD_SIZE * sizeFrac;
    const growLen = BODY_LEN * inkLenFrac(t);
    // Refit when crossing into a non-continuous phase (those don't share an arc
    // param, so stepping would snap the body straight); otherwise step the verlet
    // chain. Seeks are resynced by setup/seek above.
    const ph = phaseOf(t);
    // physics off -> body rigidly matches the line of motion (refit on-path each frame).
    if (!ENABLE_PHYSICS || body.length < 2 || (ph !== lastInkPhase && !PHASES[ph].continuous)) reseedBody(t, growLen);
    else stepBody(tipAt(t), growLen);
    lastInkPhase = ph;
  },
};

// Enso circle: the head sweeps it (ensoSweep drives the shader stroke); held full
// after the sweep, then fades to ENSO_FADE_TARGET as the 3D dragon takes over.
const blkEnso = {
  name: "enso",
  after: { block: "glyph", branch: "end" },
  defaults(ctx) { ctx.ensoAlpha = 0; ctx.ensoSweep = 0; },
  update(ctx) {
    const t = ctx.t;
    ctx.ensoSweep = clamp((t - T_ENSO_START - LEAD_OFFSET) / ENSO_DUR, 0, 1); // trails head by LEAD_OFFSET; 0 through the branch
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
  defaults(ctx) { ctx.camPitch = 0; },
  update(ctx, local) {
    ctx.camPitch = smooth(clamp(local / CAM_PITCH_DUR, 0, 1)) * CAM_PITCH_ANGLE;
  },
};

const blkDragon3d = {
  name: "dragon3d",
  after: { block: "inkDragon", branch: "handoff" },
  defaults(ctx) { ctx.d3Alpha = 0; },
  update(ctx) {
    ctx.d3Alpha = ramp(ctx.t, D3_START, D3_MID, 0, 1); // fades in FIRST (over the still-solid, coincident 2D), then loops forever
    ctx.glyphAlpha = ramp(ctx.t, D3_START, D3_END, 1, GLYPH_FADE_TARGET); // glyph eases back during the 3D transition
  },
};

// Ink splash bleeds in at the start and keeps spreading across the 2D phase,
// following the glyph trace (reveal-aware in the shader). Persistent: once the
// spread reaches full it holds, so the wash stays under the 3D dragon.
const blkSplash = {
  name: "splash",
  at: 0,
  defaults(ctx) { ctx.splashAlpha = 0; ctx.splashGrow = 0; },
  update(ctx) {
    ctx.splashAlpha = smooth(clamp(ctx.t / SPLASH_FADE_IN, 0, 1));
    ctx.splashGrow = smooth(clamp(ctx.t / SPLASH_GROW_DUR, 0, 1));
  },
};

const blkGrid = {
  name: "grid",
  after: { block: "inkDragon", branch: "traced" }, // reveal right after the stroke is traced
  defaults(ctx) { ctx.gridStrength = 0; ctx.gridReveal = 0; ctx.gridRevealMinor = 0; },
  update(ctx, local) {
    ctx.gridReveal = clamp(local / GRID_REVEAL_DUR, 0, 1);
    ctx.gridRevealMinor = clamp((local - GRID_MINOR_LAG) / GRID_REVEAL_DUR, 0, 1);
    ctx.gridStrength = ctx.gridReveal > 0 ? GRID_MAX_OPACITY : 0;
  },
};

const timeline = makeTimeline([blkSplash, blkGlyph, blkInk, blkEnso, blkCamera, blkDragon3d, blkGrid]);

// ---- reused frame-state scratch (zero per-frame allocation) ----------------
// buildState mutates these in place and returns _frame; the renderer consumes it
// synchronously (no retained reference), so a single instance is safe and avoids
// minting ~15 short-lived objects every frame -> no GC hitch on the infinite 3D
// loop. Constant fields (spread, radii, grid params) are set once in the literal.
const EMPTY_F32 = new Float32Array(0);
// Shared frame-state ctx. Each timeline block restores the fields it owns via its
// defaults(ctx) hook (run for every block before any update), so inactive blocks
// need no teardown to clear. Initialised with every key so the object keeps one
// hidden class. Values here are placeholders; defaults() sets the real resting set.
const _ctx = {
  t: 0, playhead: 1, inkAlpha: 0, d3Alpha: 0, glyphAlpha: 1.0,
  ensoAlpha: 0, ensoSweep: 0, headAlpha: 1, splashAlpha: 0, splashGrow: 0,
  gridStrength: 0, gridReveal: 0, gridRevealMinor: 0, camPitch: 0,
  inkWidthScale: 1, headSize: HEAD_SIZE,
};
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
    widthScale: 1, // body stroke width grows with size
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

  writeHeadFrame(body, _frame.inkDragon.head, tipAt(t).dir); // align head to the path tangent
  // user yaw locked to 0 during 2D phase; lerps in over the crossfade (no snap)
  const rawYaw = yaw || 0;
  const userYaw = t < T_BRANCH ? 0 : ramp(t, D3_START, D3_END, 0, rawYaw);
  const viewProj = sceneViewProj(aspect, userYaw, _ctx.camPitch);

  _frame.aspect = aspect;
  _frame.opacity.glyph = _ctx.glyphAlpha;
  _frame.opacity.inkDragon = _ctx.inkAlpha;
  _frame.opacity.dragon3d = _ctx.d3Alpha;

  const g = _frame.grid;
  g.opacity = _ctx.gridStrength; g.reveal = _ctx.gridReveal; g.revealMinor = _ctx.gridRevealMinor;
  g.viewProj = viewProj;

  _frame.glyph.segs = glyphSegs;
  _frame.glyph.playhead = _ctx.playhead;

  const sp = _frame.splash;
  sp.alpha = _ctx.splashAlpha; sp.grow = _ctx.splashGrow; sp.time = t;

  const en = _frame.enso;
  en.alpha = _ctx.ensoAlpha; en.sweep = _ctx.ensoSweep; en.angleStart = Math.PI / 2 - ensoA0; en.time = t;

  const ink = _frame.inkDragon;
  ink.body = body;
  ink.head.size = _ctx.headSize;
  ink.head.alpha = _ctx.headAlpha;
  ink.widthScale = _ctx.inkWidthScale;

  buildDragon3dState(t, viewProj); // writes _frame.dragon3d
  buildDebugState(t, debug, debugBuffer); // writes _frame.debug
  return _frame;
}

// Write the 3D dragon's per-frame draw params into _frame.dragon3d (no alloc).
// Picks the buffer (transition vs pure loop3 ring) + head offset; the shader
// wraps mod-N over the whole buffer. See the buffer-switch note in buildDragon3dFrames.
//   - transition buffer while the body still trails off the flat circles
//     (head buffer-arc = bodyArc + elapsed -> headOffset = elapsed);
//   - pure loop3 ring once the tail has left the circles (wraps cleanly forever).
function buildDragon3dState(t, viewProj) {
  const d = _frame.dragon3d;
  const bodyArc = BODY_LEN * D3.bodyFactor;
  const transArc = d3TransArc; // bodyArc + CROSSFADE*SP3
  const elapsed = Math.max(0, t - D3_START) * SP3;
  if (!dragon3dFramesLoop || elapsed < transArc) {
    d.frames = dragon3dFrames; d.pathLen = dragon3dPathLen; d.headOffset = elapsed;
  } else {
    const loopArc = bodyArc + (elapsed - transArc);
    d.frames = dragon3dFramesLoop; d.pathLen = dragon3dLoopLen; d.headOffset = loopArc - bodyArc;
  }
  d.frameCount = D3.N;
  d.bodyLen = bodyArc; // mesh head is at x=1 (leads by bodyLen); headOffset accounts for it
  d.viewProj = viewProj;
  d.time = t;
}

// Debug overlay state: sampled 2D/3D path polylines + curve-pool waypoints split
// left/right of the head heading. Written into _frame.debug; the debug-only path
// arrays still allocate (off in production).
function buildDebugState(t, debug, debugBuffer) {
  const d = _frame.debug;
  d.buffer = debugBuffer;
  if (!debug.path2d && !debug.path3d) {
    d.show = false;
    d.path2d = EMPTY_F32; d.path3d = EMPTY_F32; d.pool = EMPTY_F32;
    return;
  }
  d.show = true;
  d.path2d = debug.path2d ? samplePath2d(t) : EMPTY_F32;
  d.path3d = debug.path3d ? samplePath3d() : EMPTY_F32;
  d.pool = poolPoints();
}

// Circle centres as xyz triples (static; built once from curvePool).
function poolPoints() {
  if (_poolF32 && _poolF32.length === curvePool.length * 3) return _poolF32;
  _poolF32 = new Float32Array(curvePool.length * 3);
  for (let i = 0; i < curvePool.length; i++) {
    _poolF32[i * 3] = curvePool[i].x;
    _poolF32[i * 3 + 1] = curvePool[i].y;
    _poolF32[i * 3 + 2] = 0;
  }
  return _poolF32;
}
