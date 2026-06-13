// Brush engine.
// Data model:
//   Symbol = { strokes: Stroke[] }
//   Stroke = { id, points: Point[], paths: Path[] }   (paths.length === points.length - 1)
//   Point  = { id, x, y, pressure }                   (pressure 0..1)
//   Path   = { timeEase, duration, ctrl, pctrl }
//             ctrl  = third point {x,y} steering the segment, or null = auto.
//                     A straight segment has ctrl at the chord midpoint.
//             pctrl = pressure curve control {k}, or null = linear.
//                     The pressure of a path is a quadratic bezier value curve
//                     with endpoints (0,A) and (1,B); pctrl bends it so the
//                     curve passes through value k at the belly — the arc
//                     position of the geometry control point ctrl.
//
// Sampling:
//   For each path between point i and i+1, build a quadratic bezier through the
//   control point: B(t) = (1-t)^2 p1 + 2(1-t)t ctrl + t^2 p2.
//   Resample the curve so samples are roughly arc-length uniform; for each
//   arc fraction s in [0..1]:
//     - position p(s) on the curve
//     - pressure = pressureAt(pctrl, A, B, s)             (pressure curve)
//     - localTime = timeEase(s) * duration                (time curve; s -> t)
//   Speed = ds_world / dt. Higher speed -> lower ink, more dither.

import { applyEasing } from "./easing";

let _id = 0;
export const uid = () => ++_id;
export const setUidFloor = (n) => { if (n > _id) _id = n; };

export const DEFAULT_PATH = () => ({
  timeEase: "linear",
  duration: 1.0,
  ctrl: null,    // third point {x,y}, or null = auto from neighbours
  pctrl: null,   // pressure control {k}, or null = linear A->B
});

const AUTO_TENSION = 0.5;

// Resolve the control point. Explicit override, else catmull-rom auto
// (midpoint of the two cubic tangent handles → smooth default join).
export function resolveControl(stroke, segIdx) {
  const path = stroke.paths[segIdx];
  if (path.ctrl) return { x: path.ctrl.x, y: path.ctrl.y };
  const pts = stroke.points;
  const p1 = pts[segIdx];
  const p2 = pts[segIdx + 1];
  const p0 = pts[segIdx - 1] || mirror(p2, p1);
  const p3 = pts[segIdx + 2] || mirror(p1, p2);
  const k = (1 - AUTO_TENSION) / 6;
  const h1x = p1.x + (p2.x - p0.x) * k, h1y = p1.y + (p2.y - p0.y) * k;
  const h2x = p2.x - (p3.x - p1.x) * k, h2y = p2.y - (p3.y - p1.y) * k;
  return { x: (h1x + h2x) / 2, y: (h1y + h2y) / 2 };
}

export function makePoint(x, y, pressure = 0.5) {
  return { id: uid(), x, y, pressure };
}

export function makeStroke(points = []) {
  const pts = points.length >= 2
    ? points
    : [makePoint(-0.5, 0, 0.4), makePoint(0.5, 0, 0.8)];
  const paths = new Array(Math.max(0, pts.length - 1)).fill(0).map(DEFAULT_PATH);
  return { id: uid(), points: pts, paths };
}

// Stroke with raw point list (no auto 2-point default). 1-point strokes
// are valid but not rendered (need >=2 points for any path).
export function makeStrokeRaw(points) {
  const paths = new Array(Math.max(0, points.length - 1)).fill(0).map(DEFAULT_PATH);
  return { id: uid(), points: [...points], paths };
}

// Append new point at end of stroke.
export function addPoint(stroke, x, y, pressure = 0.5) {
  stroke.points.push(makePoint(x, y, pressure));
  if (stroke.points.length >= 2) stroke.paths.push(DEFAULT_PATH());
  return stroke;
}

// Insert new point immediately after points[idx]. New path between
// points[idx] and the new point; the path previously connecting
// points[idx] -> points[idx+1] now connects new point -> points[idx+1].
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

// Sample one path with arc-length uniform fractions s in [0..1].
function samplePath(stroke, segIdx, sampleDensity) {
  const pts = stroke.points;
  const path = stroke.paths[segIdx];
  const p1 = pts[segIdx];
  const p2 = pts[segIdx + 1];
  const c = resolveControl(stroke, segIdx);

  // dense pre-sample to estimate arc length
  const dense = 96;
  const xs = new Array(dense + 1);
  const cum = new Float32Array(dense + 1);
  xs[0] = cubic(p1, c, c, p2, 0);
  for (let i = 1; i <= dense; i++) {
    const t = i / dense;
    xs[i] = cubic(p1, c, c, p2, t);
    cum[i] = cum[i - 1] + Math.hypot(xs[i].x - xs[i - 1].x, xs[i].y - xs[i - 1].y);
  }
  const total = cum[dense] || 1e-6;

  // belly = arc fraction of the curve point nearest the control point.
  // this is where the pressure curve thins/swells to pctrl.k.
  let bellyX = 0.5, bestD = Infinity;
  for (let i = 0; i <= dense; i++) {
    const dx = xs[i].x - c.x, dy = xs[i].y - c.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; bellyX = cum[i] / total; }
  }

  // samples scale with arc length: more length -> more samples
  const samplesPerPath = Math.max(4, Math.ceil(total * sampleDensity));
  const samples = new Array(samplesPerPath + 1);
  let j = 0;
  for (let k = 0; k <= samplesPerPath; k++) {
    const s = k / samplesPerPath;
    const targetArc = s * total;
    while (j < dense && cum[j + 1] < targetArc) j++;
    const a = cum[j], b = cum[j + 1];
    const localT = b > a ? (targetArc - a) / (b - a) : 0;
    const tCurve = (j + localT) / dense;
    const pos = cubic(p1, c, c, p2, tCurve);
    const te = applyEasing(path.timeEase, s);
    samples[k] = {
      x: pos.x,
      y: pos.y,
      s,
      arc: targetArc,
      pressure: pressureAt(path.pctrl, p1.pressure, p2.pressure, s, bellyX),
      time: te * path.duration,
      duration: path.duration,
    };
  }
  return { samples, totalArc: total };
}

function mirror(a, b) {
  return { x: 2 * b.x - a.x, y: 2 * b.y - a.y };
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// Pressure value along a path at progress s in [0..1].
// Endpoints (0,A) and (1,B). With pctrl = {k} the curve is the quadratic
// bezier through control (bellyX,k): the "belly" thins (or swells) to k at the
// belly position bellyX (arc fraction of the geometry control point).
// pctrl null -> straight line (linear A->B).
//   The bezier is P(t) = (1-t)^2 P0 + 2(1-t)t C + t^2 P2 in (progress,value).
//   Solve bezier_x(t) = s for t, then return bezier_y(t).
export function pressureAt(pctrl, A, B, s, bellyX = 0.5) {
  if (!pctrl) return A + (B - A) * s;
  const cx = clamp01(bellyX);
  const k = pctrl.k;
  // bezier_x(t) = (1-2cx) t^2 + 2cx t  ; solve = s
  const a = 1 - 2 * cx, b = 2 * cx, c = -s;
  let t;
  if (Math.abs(a) < 1e-6) {
    t = b > 1e-6 ? -c / b : s;                  // cx≈0.5 -> linear in t
  } else {
    const disc = Math.max(0, b * b - 4 * a * c);
    t = (-b + Math.sqrt(disc)) / (2 * a);
  }
  t = clamp01(t);
  const u = 1 - t;
  return u * u * A + 2 * u * t * k + t * t * B;
}

// Returns flat array of samples across all paths with global time and speed.
export function sampleStroke(stroke, sampleDensity = 80) {
  if (!stroke || stroke.points.length < 2) return [];
  let tOffset = 0;
  const all = [];
  for (let i = 0; i < stroke.paths.length; i++) {
    const { samples } = samplePath(stroke, i, sampleDensity);
    // skip the first sample on subsequent paths (duplicate of prev tail)
    const start = i === 0 ? 0 : 1;
    for (let k = start; k < samples.length; k++) {
      const s = samples[k];
      all.push({
        x: s.x,
        y: s.y,
        pressure: s.pressure,
        gTime: tOffset + s.time,
        arc: s.arc,
      });
    }
    tOffset += stroke.paths[i].duration;
  }
  // compute speed: ds_world / dt (smoothed via neighbour deltas)
  for (let i = 0; i < all.length; i++) {
    const prev = all[Math.max(0, i - 1)];
    const next = all[Math.min(all.length - 1, i + 1)];
    const ds = Math.hypot(next.x - prev.x, next.y - prev.y);
    const dt = Math.max(1e-4, next.gTime - prev.gTime);
    all[i].speed = ds / dt;
  }
  return all;
}
