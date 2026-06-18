// The 2D roam geometry: the enso circle, the straight lead-in, the rosette of
// tangent circles the ink dragon walks, and the smooth C-branch from the glyph
// end onto the enso. All pure builders — fed the entry/heading and the session
// PRNG, they return paths the head-path module samples.

import { TAU, clamp, lerp, smooth } from "$lib/math/scalar.js";
import { arcLengthCurve, buildOpenSpline } from "$lib/math/curve.js";
import {
  ENSO_R, BODY_LEN,
  FRAME_SMALL_R, FRAME_MEDIUM_N, FRAME_MEDIUM_R, FRAME_INNER_AXIS,
  FRAME_BRANCH_P, FRAME_MIN_LEN, FRAME_MAX_STEPS, FRAME_SAMPLES, FRAME_TAN_EPS,
} from "./config.js";

// enso start angle: top of circle (fixed); head sweeps counter-clockwise.
export const ensoA0 = Math.PI / 2;

// The head sweeps ONE counter-clockwise circle of radius ENSO_R starting at the
// top; `frac` (0..1) drives the sweep. Defined for any frac (frac<0 trails before
// the start) so the body can lead in.
export function ensoPos(frac) {
  const a = ensoA0 + frac * TAU; // counter-clockwise (increasing angle)
  return { x: ENSO_R * Math.cos(a), y: ENSO_R * Math.sin(a) };
}

// straight glide from LEADIN_START onto the glyph entry (eased); p in 0..1
export function leadInPos(p, start, entry) {
  const k = smooth(clamp(p, 0, 1));
  return { x: lerp(start.x, entry.x, k), y: lerp(start.y, entry.y, k) };
}

// Build the rosette frame as a list of {cx, cy, r} circles, then wire up every
// tangency between them. A tangency is stored on BOTH circles as {a, j, aj}:
// the angle on this circle, the partner index, and the angle on the partner at
// the shared point. Tangencies are detected numerically — external when the
// centre distance equals ri+rj, internal when it equals |ri-rj|.
function buildFrame() {
  const R = ENSO_R;
  const circles = [{ cx: 0, cy: 0, r: R }]; // 0: the enso (grand circle)

  // vesica pair: two equal circles tangent at the origin, each internally tangent
  // to the enso at the ends of the FRAME_INNER_AXIS diameter.
  const ir = FRAME_SMALL_R * R;
  for (const s of [1, -1]) {
    circles.push({ cx: s * ir * Math.cos(FRAME_INNER_AXIS), cy: s * ir * Math.sin(FRAME_INNER_AXIS), r: ir });
  }

  // medium ring: FRAME_MEDIUM_N equal circles externally tangent to the enso,
  // evenly spaced. Non-overlap needs (R+r)·sin(π/n) >= r; clamp to that limit.
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
// tangent matches `heading`. At each tangency either stay or branch onto a
// touching circle (FRAME_BRANCH_P); either join is C1-smooth. Walks until the
// polyline is at least FRAME_MIN_LEN long, ending ON a tangency point.
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
// and arc-length parameterise the dense polyline (open path). Returns the curve
// (with headStart) plus the circle centres as a debug `pool`.
export function generateFramePath(rng, entry, heading) {
  const circles = buildFrame();
  const pool = circles.map((c) => ({ x: c.cx, y: c.cy, z: 0 })); // debug: circle centres
  const hdx = Math.cos(heading), hdy = Math.sin(heading);
  const walk = walkFrame(rng, circles, entry, heading); // walk[0] === entry
  const allPts = [
    { x: entry.x - hdx * BODY_LEN * 2, y: entry.y - hdy * BODY_LEN * 2, z: 0 },
    { x: entry.x - hdx * BODY_LEN,     y: entry.y - hdy * BODY_LEN,     z: 0 },
    ...walk,
  ];
  const headEntryIdx = 2; // allPts[2] === entry
  const curve = arcLengthCurve(allPts, false);
  return { curve: { ...curve, headStart: curve.arcAt(headEntryIdx) }, pool };
}

// Branch off the glyph end onto the enso circle with a C curve (entry, belly,
// exit) — same generation rule as the roam, so the join is smooth. Entry/exit
// tangents are pinned to the glyph exit heading and the circle tangent (no kink,
// no snap). Returns the open spline + the arc range the head travels.
export function buildEnsoLeadIn(entry, entryHeading, exit, exitHeading) {
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
