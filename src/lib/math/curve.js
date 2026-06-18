// Generic spline / path math: Catmull-Rom interpolation, arc-length
// parameterisation, ring/orbit pivot generation, and pivot-ring turn shaping.
// Pure + scene-agnostic (only depends on scalar helpers) so it is reusable and
// unit-testable on its own.

import { TAU, clamp, lerp } from "./scalar.js";

// Catmull-Rom basis through control values p0..p3 at fraction f; component-wise.
export function crComp(p0, p1, p2, p3, f) {
  const f2 = f * f, f3 = f2 * f;
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f3);
}

// Catmull-Rom through pivots P (CLOSED). u in pivot-index space; component-wise.
export function catmullClosed(P, u) {
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

// Catmull-Rom through pivots P (OPEN; endpoints clamped). u in [0, K-1].
export function catmullOpen(P, u) {
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

// Arc-length parameterise a polyline of dense {x,y,z} samples. Returns pos(s) /
// tan(s) keyed on arc length s, the loop `total`, and arcAt(i) = arc length at
// dense index i. `closed` wraps s on total (looping path); otherwise s clamps to
// the ends. The single source of truth for every spline/curve sampler below.
export function arcLengthCurve(dense, closed) {
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
export function buildSpline(pivots) {
  const K = pivots.length;
  const M = 2048;
  const dense = new Array(M + 1);
  for (let i = 0; i <= M; i++) dense[i] = catmullClosed(pivots, (i / M) * K);
  return arcLengthCurve(dense, true);
}

// OPEN Catmull-Rom spline through pivots (pos/tan clamp at the ends), arc-length
// parameterised. arcAtU(u) gives the arc length at pivot-index u (u in [0, K-1]).
export function buildOpenSpline(pivots) {
  const K = pivots.length;
  const M = 2048;
  const span = K - 1;
  const dense = new Array(M + 1);
  for (let i = 0; i <= M; i++) dense[i] = catmullOpen(pivots, (i / M) * span);
  const curve = arcLengthCurve(dense, false);
  const arcAtU = (u) => curve.arcAt(clamp(u / span, 0, 1) * M);
  return { ...curve, arcAtU };
}

// Even pivots around a ring, z undulating `waves` full periods per turn (so z
// returns to 0 at the seam -> a clean closed loop). `phase` sets the start angle.
// `lobes` adds radial petals: the ring dips inward up to `lobeDepth`·radius,
// `lobes` times per revolution, so the path winds in/out (a LONGER loop) while
// its outer bound stays `radius`. lobes integer -> the radius closes at the seam.
// Deterministic — the dragon's 3D orbit is a definite path, not random.
export function orbitPivots(count, radius, zAmp, waves, phase, lobes = 0, lobeDepth = 0) {
  const pts = new Array(count);
  for (let k = 0; k < count; k++) {
    const f = k / count;
    const a = phase + f * TAU;
    const g = lobes > 0 ? 0.5 + 0.5 * Math.cos(lobes * f * TAU) : 0; // 0 at petal tip, 1 at the inward dip
    const r = radius * (1 - lobeDepth * g);
    pts[k] = { x: r * Math.cos(a), y: r * Math.sin(a), z: zAmp * Math.sin(waves * f * TAU) };
  }
  return pts;
}

// Rotate the first random pivot about the split point so the head's peel-off
// bearing stays within `maxTurn` of the split heading -> no sharp exit turn.
export function clampExitPivot(pivots, split, maxTurn) {
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
export function turnAngle(P, i) {
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
export function relaxTurns(P, minTurn, maxTurn, maxRun, movable, iters) {
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
