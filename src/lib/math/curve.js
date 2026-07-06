import { clamp, lerp } from "./scalar.js";

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

