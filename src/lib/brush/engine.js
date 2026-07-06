// quad bezier through ctrl: B(t) = (1-t)^2 p1 + 2(1-t)t ctrl + t^2 p2

let _id = 0;
export const uid = () => ++_id;
export const setUidFloor = (n) => { if (n > _id) _id = n; };

const DEFAULT_PATH = () => ({
  delay: 0.0,
  duration: 1.0,
  ctrl: null,
  pctrl: null,
});

const AUTO_TENSION = 0.5;

export function resolveControl(stroke, segIdx) {
  const path = stroke.paths[segIdx];
  if (path.ctrl) return { x: path.ctrl.x, y: path.ctrl.y };
  const pts = stroke.points;
  const p1 = pts[segIdx];
  const p2 = pts[segIdx + 1];
  const p0 = pts[segIdx - 1] || mirror(p2, p1);
  const p3 = pts[segIdx + 2] || mirror(p1, p2);
  return autoControl(p0, p1, p2, p3);
}

// auto quad control at intersection of Catmull-rom endpoint tangent lines (tangent at p1 ∝ p2-p0, at p2 ∝ p3-p1);
// degenerate/overshoot -> averaged Catmull handles.
function autoControl(p0, p1, p2, p3) {
  const t1x = p2.x - p0.x, t1y = p2.y - p0.y;
  const t2x = p3.x - p1.x, t2y = p3.y - p1.y;
  const wx = p2.x - p1.x, wy = p2.y - p1.y;
  const det = t1x * t2y - t1y * t2x;
  if (Math.abs(det) > 1e-9) {
    const a = (wx * t2y - wy * t2x) / det;   // dist along t1 from p1
    const b = (t1x * wy - t1y * wx) / det;   // dist along t2 back from p2
    const chord = Math.hypot(wx, wy) || 1e-6;
    const m1 = Math.hypot(t1x, t1y), m2 = Math.hypot(t2x, t2y);
    if (a > 0 && b > 0 && a * m1 < 4 * chord && b * m2 < 4 * chord) {
      return { x: p1.x + t1x * a, y: p1.y + t1y * a };
    }
  }
  const k = (1 - AUTO_TENSION) / 6;
  const h1x = p1.x + (p2.x - p0.x) * k, h1y = p1.y + (p2.y - p0.y) * k;
  const h2x = p2.x - (p3.x - p1.x) * k, h2y = p2.y - (p3.y - p1.y) * k;
  return { x: (h1x + h2x) / 2, y: (h1y + h2y) / 2 };
}

export function makePoint(x, y, pressure = 0.5) {
  return { id: uid(), x, y, pressure };
}

export function makeStrokeRaw(points) {
  const paths = new Array(Math.max(0, points.length - 1)).fill(0).map(DEFAULT_PATH);
  return { id: uid(), points: [...points], paths };
}

export function insertPointAfter(stroke, idx, x, y, pressure = 0.5) {
  const q = makePoint(x, y, pressure);
  stroke.points.splice(idx + 1, 0, q);
  stroke.paths.splice(idx, 0, DEFAULT_PATH());
  return q;
}

export function removePoint(stroke, idx) {
  if (stroke.points.length <= 1) return stroke;
  stroke.points.splice(idx, 1);
  const pathIdx = idx < stroke.paths.length ? idx : stroke.paths.length - 1;
  stroke.paths.splice(pathIdx, 1);
  return stroke;
}

function cubic(p0, h1, h2, p1, t) {
  const u = 1 - t;
  const b0 = u * u * u;
  const b1 = 3 * u * u * t;
  const b2 = 3 * u * t * t;
  const b3 = t * t * t;
  return {
    x: b0 * p0.x + b1 * h1.x + b2 * h2.x + b3 * p1.x,
    y: b0 * p0.y + b1 * h1.y + b2 * h2.y + b3 * p1.y,
  };
}

function mirror(a, b) {
  return { x: 2 * b.x - a.x, y: 2 * b.y - a.y };
}
function clampN(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export const DEFAULT_TIMING = () => ({ speed: 1.0 });

const MIN_SPEED = 0.05;
const THIN_GAIN = 2.0;
const CORNER = 0.7;
const THIN   = 0.6;

export function pathArc(stroke, segIdx) {
  const pts = stroke.points;
  const c = resolveControl(stroke, segIdx);
  const p1 = pts[segIdx], p2 = pts[segIdx + 1];
  const dense = 64;
  let prev = cubic(p1, c, c, p2, 0), total = 0;
  for (let i = 1; i <= dense; i++) {
    const cur = cubic(p1, c, c, p2, i / dense);
    total += Math.hypot(cur.x - prev.x, cur.y - prev.y);
    prev = cur;
  }
  return total || 1e-6;
}

// belly arc fraction = nearest curve point to control
export function bellyArc(stroke, segIdx) {
  const pts = stroke.points;
  const c = resolveControl(stroke, segIdx);
  const p1 = pts[segIdx], p2 = pts[segIdx + 1];
  const dense = 96;
  const xs = new Array(dense + 1);
  const cum = new Float64Array(dense + 1);
  xs[0] = cubic(p1, c, c, p2, 0);
  for (let i = 1; i <= dense; i++) {
    const t = i / dense;
    xs[i] = cubic(p1, c, c, p2, t);
    cum[i] = cum[i - 1] + Math.hypot(xs[i].x - xs[i - 1].x, xs[i].y - xs[i - 1].y);
  }
  const total = cum[dense] || 1e-6;
  let bellyX = 0.5, bestD = Infinity;
  for (let i = 0; i <= dense; i++) {
    const dx = xs[i].x - c.x, dy = xs[i].y - c.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; bellyX = cum[i] / total; }
  }
  return bellyX;
}

// pivot sharpness at interior point i: 0 = straight through, 1 = full reversal
function turnSharp(stroke, i) {
  const pts = stroke.points;
  if (i <= 0 || i >= pts.length - 1) return 0;
  const a = pts[i - 1], b = pts[i], c = pts[i + 1];
  const ix = b.x - a.x, iy = b.y - a.y;
  const ox = c.x - b.x, oy = c.y - b.y;
  const mi = Math.hypot(ix, iy) || 1, mo = Math.hypot(ox, oy) || 1;
  const dot = clampN((ix * ox + iy * oy) / (mi * mo), -1, 1);
  return (1 - dot) / 2;
}

export function pointSpeed(stroke, i, speed) {
  const cf = 1 - CORNER * turnSharp(stroke, i);
  const tf = 1 + THIN * (1 - stroke.points[i].pressure) * THIN_GAIN;
  return Math.max(MIN_SPEED, (speed || 1) * cf * tf);
}

// time to travel arc a (0..L), speed linear sa->sb: ∫ ds/(sa+(sb-sa)·s/L); reduces to a/sa when constant.
export function travelTime(L, sa, sb, a) {
  if (L <= 0) return 0;
  const d = sb - sa;
  if (Math.abs(d) < 1e-6) return a / sa;
  const m = d / L;
  return Math.log((sa + m * a) / sa) / m;
}

export const DEFAULT_CONNECT = () => ({ enabled: false, thread: 0.18 });

// unit tangent leaving stroke at last point (quad derivative at t=1)
function tangentOut(stroke) {
  const pts = stroke.points;
  const n = pts.length;
  if (n < 2) return null;
  const end = pts[n - 1];
  const seg = stroke.paths[n - 2];
  const c = seg && seg.ctrl ? seg.ctrl : resolveControl(stroke, n - 2);
  const dx = end.x - c.x, dy = end.y - c.y;
  const m = Math.hypot(dx, dy) || 1;
  return { x: dx / m, y: dy / m };
}

// unit tangent stroke departs along from first point (quad deriv at t=0)
function tangentIn(stroke) {
  const pts = stroke.points;
  if (pts.length < 2) return null;
  const start = pts[0];
  const seg = stroke.paths[0];
  const c = seg && seg.ctrl ? seg.ctrl : resolveControl(stroke, 0);
  const dx = c.x - start.x, dy = c.y - start.y;
  const m = Math.hypot(dx, dy) || 1;
  return { x: dx / m, y: dy / m };
}

// connector control: intersection of A's exit tangent and B's entry tangent; degenerate -> midpoint bow.
function connectorControl(A, u, B, v, g) {
  const wx = B.x - A.x, wy = B.y - A.y;
  const det = u.x * v.y - u.y * v.x;
  if (Math.abs(det) < 1e-6) {
    return { x: (A.x + B.x) / 2 - u.y * g * 0.15,
             y: (A.y + B.y) / 2 + u.x * g * 0.15 };
  }
  let a = (wx * v.y - wy * v.x) / det;
  a = Math.max(0.05 * g, Math.min(0.95 * g, a));
  return { x: A.x + u.x * a, y: A.y + u.y * a };
}

function connectorStroke(a, b, connect) {
  if (!a.points.length || !b.points.length) return null;
  const A = a.points[a.points.length - 1];
  const B = b.points[0];
  const g = Math.hypot(B.x - A.x, B.y - A.y);
  if (g < 1e-4) return null;
  const chord = { x: (B.x - A.x) / g, y: (B.y - A.y) / g };
  const u = tangentOut(a) || chord;
  const v = tangentIn(b) || chord;
  const ctrl = connectorControl(A, u, B, v, g);
  const pA = A.pressure;
  const pB = B.pressure;
  const k = Math.min(connect.thread, pA, pB);
  const duration = Math.max(0.05, g);
  return {
    id: `c:${a.id}>${b.id}`,
    points: [
      { id: -1, x: A.x, y: A.y, pressure: pA },
      { id: -2, x: B.x, y: B.y, pressure: pB },
    ],
    paths: [{ delay: 0, duration, ctrl, pctrl: { k } }],
  };
}

// strokes + auto connectors between consecutive pairs, as entries
// { stroke, si (source stroke index), connector (bool) }.
export function expandStrokes(symbol, connect) {
  const strokes = symbol?.strokes || [];
  const out = [];
  for (let i = 0; i < strokes.length; i++) {
    out.push({ stroke: strokes[i], si: i, connector: false });
    if (!connect || !connect.enabled) continue;
    const b = strokes[i + 1];
    if (b) {
      const c = connectorStroke(strokes[i], b, connect);
      if (c) out.push({ stroke: c, si: i, connector: true });
    }
  }
  return out;
}

function strokeDuration(stroke, timing) {
  if (!stroke || !stroke.paths) return 0;
  let t = 0;
  for (let i = 0; i < stroke.paths.length; i++) {
    t += stroke.paths[i].delay || 0;
    const L = pathArc(stroke, i);
    t += travelTime(L, pointSpeed(stroke, i, timing.speed), pointSpeed(stroke, i + 1, timing.speed), L);
  }
  return t;
}

export function symbolDuration(symbol, connect, timing) {
  let t = 0;
  for (const e of expandStrokes(symbol, connect)) t += strokeDuration(e.stroke, timing);
  return t;
}

export function makePlayback(symbol, connect, timing) {
  return { t: 0, playing: false, duration: symbolDuration(symbol, connect, timing) };
}

export function syncPlayback(state, symbol, connect, timing) {
  state.duration = symbolDuration(symbol, connect, timing);
  if (state.t > state.duration) state.t = state.duration;
  return state;
}

export function step(state, dt) {
  let t = state.t + dt;
  if (t <= 0) { t = 0; }
  else if (t >= state.duration) { t = state.duration; state.playing = false; }
  state.t = t;
  return state;
}
