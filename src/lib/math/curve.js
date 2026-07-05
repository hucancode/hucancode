import { TAU, clamp, lerp } from "./scalar.js";

// Catmull-Rom basis through control values p0..p3 at fraction f. component-wise
export function crComp(p0, p1, p2, p3, f) {
  const f2 = f * f, f3 = f2 * f;
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f3);
}

// Catmull-Rom through pivots P (CLOSED). u in pivot-index space. component-wise
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

// Catmull-Rom through pivots P (OPEN; endpoints clamped). u in [0, K-1]
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

// Arc-length parameterise polyline of dense {x,y,z} samples. pos(s)/tan(s) keyed
// on arc length s; closed wraps s on total, else clamps to ends.
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

// Closed Catmull-Rom spline (pos/tan wrap on s), arc-length parameterised
export function buildSpline(pivots) {
  const K = pivots.length;
  const M = 2048;
  const dense = new Array(M + 1);
  for (let i = 0; i <= M; i++) dense[i] = catmullClosed(pivots, (i / M) * K);
  return arcLengthCurve(dense, true);
}

// OPEN Catmull-Rom spline through pivots (pos/tan clamp at ends), arc-length
// parameterised. arcAtU(u) = arc length at pivot-index u (u in [0, K-1])
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

// Even pivots around ring; z = zAmp*sin(waves*turn) closes at seam, lobes dip
// radius inward up to lobeDepth*radius, lobes times per revolution.
export function orbitPivots(count, radius, zAmp, waves, phase, lobes = 0, lobeDepth = 0) {
  const pts = new Array(count);
  for (let k = 0; k < count; k++) {
    const f = k / count;
    const a = phase + f * TAU;
    // lobe dip phased so pivot 0 (the ring ENTRY) sits on a lobe OUTER
    // (g=0, full radius) — entry tangent stays circular, connector stays tame
    const g = lobes > 0 ? 0.5 - 0.5 * Math.cos(lobes * f * TAU) : 0;
    const r = radius * (1 - lobeDepth * g);
    pts[k] = { x: r * Math.cos(a), y: r * Math.sin(a), z: zAmp * Math.sin(waves * f * TAU) };
  }
  return pts;
}

// Rotate first pivot about split point so head's peel-off bearing stays within
// maxTurn of split heading -> no sharp exit turn.
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

// Turn angle at pivot i on closed ring (angle between incoming/outgoing legs)
export function turnAngle(P, i) {
  const K = P.length;
  const a = P[(i - 1 + K) % K], b = P[i], c = P[(i + 1) % K];
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const vx = c.x - b.x, vy = c.y - b.y, vz = c.z - b.z;
  const ul = Math.hypot(ux, uy, uz) || 1e-6;
  const vl = Math.hypot(vx, vy, vz) || 1e-6;
  return Math.acos(clamp((ux * vx + uy * vy + uz * vz) / (ul * vl), -1, 1));
}

// Shape closed pivot ring's turn angles: push too-straight pivots away from
// neighbour midpoint (more bend), pull Nth-consecutive sharp pivots toward it.
export function relaxTurns(P, minTurn, maxTurn, maxRun, movable, iters) {
  const K = P.length;
  for (let it = 0; it < iters; it++) {
    let sharpRun = 0;
    for (let i = 0; i < K; i++) {
      const ang = turnAngle(P, i);
      const sharp = ang > maxTurn;
      sharpRun = sharp ? sharpRun + 1 : 0;
      if (!movable(i)) continue;
      let w = 0;
      if (sharp) {
        if (sharpRun < maxRun) continue;
        w = 0.5; sharpRun = 0;
      } else if (ang < minTurn) {
        w = -clamp((minTurn - ang) * 0.6, 0, 0.3);
      } else continue;
      const a = P[(i - 1 + K) % K], b = P[i], c = P[(i + 1) % K];
      const mx = (a.x + c.x) * 0.5, my = (a.y + c.y) * 0.5, mz = (a.z + c.z) * 0.5;
      P[i] = { x: lerp(b.x, mx, w), y: lerp(b.y, my, w), z: lerp(b.z, mz, w) };
    }
  }
}
