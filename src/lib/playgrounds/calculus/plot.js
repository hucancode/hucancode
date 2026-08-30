// Shared math + SVG-path helpers for the Intro to Calculus playgrounds.

export const FN_CATALOG = {
  x2: { f: (x) => x * x, tex: "x^2" },
  x3: { f: (x) => x * x * x, tex: "x^3" },
  cubic: { f: (x) => x * x * x - 3 * x, tex: "x^3-3x" },
  sin: { f: (x) => Math.sin(x), tex: "\\sin x" },
  exp: { f: (x) => Math.exp(x), tex: "e^x" },
  sqrt: { f: (x) => (x >= 0 ? Math.sqrt(x) : NaN), tex: "\\sqrt{x}" },
};

export const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

/** Central-difference estimate of f'(x). */
export function derivative(f, x, h = 1e-6) {
  return (f(x + h) - f(x - h)) / (2 * h);
}

/** Sample f over [x0, x1] into [x, y] pairs; NaN/Infinity become null (a gap). */
export function sample(f, x0, x1, n = 480) {
  const pts = [];
  const step = (x1 - x0) / n;
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * step;
    const y = f(x);
    pts.push(Number.isFinite(y) ? [x, y] : null);
  }
  return pts;
}

/** Turn point pairs into an SVG path string (respects null gaps). */
export function toPath(pts, scale) {
  let d = "";
  let pen = false;
  for (const p of pts) {
    if (!p) {
      pen = false;
      continue;
    }
    const X = scale.x(p[0]);
    const Y = scale.y(p[1]);
    if (!Number.isFinite(X) || !Number.isFinite(Y)) {
      pen = false;
      continue;
    }
    d += (pen ? "L" : "M") + X.toFixed(2) + " " + Y.toFixed(2);
    pen = true;
  }
  return d;
}

/** A straight segment between two data points. */
export function segmentPath(x1, y1, x2, y2, scale) {
  return toPath(
    [
      [x1, y1],
      [x2, y2],
    ],
    scale,
  );
}

/** A line of slope m through (x0, y0), spanning the full x range (clipped later). */
export function linePath(x0, y0, m, xMin, xMax, scale) {
  return segmentPath(xMin, y0 + m * (xMin - x0), xMax, y0 + m * (xMax - x0), scale);
}

/** Filled region under a curve between x0 and x1, closed along a baseline. */
export function areaPath(pts, x0, x1, baseline, scale) {
  const seg = [];
  for (const p of pts) {
    if (!p) continue;
    if (p[0] >= x0 - 1e-9 && p[0] <= x1 + 1e-9) seg.push(p);
  }
  if (seg.length === 0) return "";
  const base = scale.y(baseline).toFixed(2);
  let d = `M${scale.x(x0).toFixed(2)} ${base}`;
  for (const [x, y] of seg) d += `L${scale.x(x).toFixed(2)} ${scale.y(y).toFixed(2)}`;
  d += `L${scale.x(x1).toFixed(2)} ${base}Z`;
  return d;
}

/** Rectangle Riemann sum over [a, b] with n slices. */
export function riemannRects(f, a, b, n, mode = "mid") {
  const dx = (b - a) / n;
  const rects = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x0 = a + i * dx;
    const x1 = x0 + dx;
    const xs = mode === "left" ? x0 : mode === "right" ? x1 : (x0 + x1) / 2;
    const h = f(xs);
    if (!Number.isFinite(h)) continue;
    sum += h * dx;
    rects.push({ x0, x1, h });
  }
  return { rects, sum };
}

/** Trapezoidal integration — used as the "exact" reference value. */
export function integrate(f, a, b, n = 4000) {
  const dx = (b - a) / n;
  let s = (f(a) + f(b)) / 2;
  for (let i = 1; i < n; i++) s += f(a + i * dx);
  return s * dx;
}

/** Area function F(x) = ∫_a^x f(t) dt, sampled as points. */
export function accumulation(f, a, xMax, n = 600) {
  const dx = (xMax - a) / n;
  const pts = [[a, 0]];
  let acc = 0;
  let prev = f(a);
  for (let i = 1; i <= n; i++) {
    const x = a + i * dx;
    const y = f(x);
    acc += ((y + prev) / 2) * dx;
    pts.push([x, acc]);
    prev = y;
  }
  return pts;
}

/** Linear interpolation into an ascending [x, y] point array. */
export function valueAt(pts, x) {
  if (!pts.length) return NaN;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid][0] <= x) lo = mid;
    else hi = mid;
  }
  const [x0, y0] = pts[lo];
  const [x1, y1] = pts[hi];
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

/**
 * Fit a y range around functions and/or point arrays.
 * Sources may be a function `(x) => y` or an array of `[x, y]` pairs.
 */
export function fitY(sources, xMin, xMax, padFrac = 0.18) {
  let lo = Infinity;
  let hi = -Infinity;
  const consider = (y) => {
    if (Number.isFinite(y)) {
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
  };
  for (const src of sources) {
    if (typeof src === "function") {
      for (const p of sample(src, xMin, xMax, 200)) if (p) consider(p[1]);
    } else {
      for (const p of src) if (p) consider(p[1]);
    }
  }
  if (!Number.isFinite(lo)) {
    lo = -1;
    hi = 1;
  }
  if (hi - lo < 1e-6) {
    hi = lo + 1;
    lo = lo - 1;
  }
  const pad = (hi - lo) * padFrac;
  return [lo - pad, hi + pad];
}
