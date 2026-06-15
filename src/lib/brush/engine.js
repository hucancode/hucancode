// Brush engine.
// Data model:
//   Symbol = { strokes: Stroke[] }
//   Stroke = { id, points: Point[], paths: Path[] }   (paths.length === points.length - 1)
//   Point  = { id, x, y, pressure }                   (pressure 0..1)
//   Path   = { duration, ctrl, pctrl }
//             ctrl  = third point {x,y} steering the segment, or null = auto.
//                     A straight segment has ctrl at the chord midpoint.
//             pctrl = pressure curve control {k}, or null = linear.
//                     The pressure of a path is a quadratic bezier value curve
//                     with endpoints (0,A) and (1,B); pctrl bends it so the
//                     curve passes through value k at the belly - the arc
//                     position of the geometry control point ctrl.
//
// Sampling:
//   For each path between point i and i+1, build a quadratic bezier through the
//   control point: B(t) = (1-t)^2 p1 + 2(1-t)t ctrl + t^2 p2.
//   Resample the curve so samples are roughly arc-length uniform; for each
//   arc fraction s in [0..1]:
//     - position p(s) on the curve
//     - pressure = pressureAt(pctrl, A, B, s)             (pressure curve)
//     - localTime = s * duration                          (linear; s -> t)
//   Width comes from pressure alone; the renderer stamps solid circles.

let _id = 0;
export const uid = () => ++_id;
export const setUidFloor = (n) => { if (n > _id) _id = n; };

export const DEFAULT_PATH = () => ({
  delay: 0.0,    // dead time (s) before this path starts drawing
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
    samples[k] = {
      x: pos.x,
      y: pos.y,
      s,
      arc: targetArc,
      pressure: pressureAt(path.pctrl, p1.pressure, p2.pressure, s, bellyX),
      time: s * path.duration,
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
function clampN(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// --- Auto timing --------------------------------------------------
// Instead of authoring each path's duration, derive the brush velocity from the
// geometry and pressure, then integrate to get time. Calligraphic feel:
//   - slow down at a pivot (sharp turn between segments)
//   - accelerate leaving the pivot (speed recovers along the next segment)
//   - accelerate further on thin line (low pressure → faster, drier stroke)
// timing = { speed }   (the only user knob)
//   speed = base brush velocity (world units / sec) on a straight, full ink run.
// Cornering brake and thin-line boost are fixed internal constants - timing is
// always auto-computed; only the base speed is configurable.
export const DEFAULT_TIMING = () => ({ speed: 1.0 });

const MIN_SPEED = 0.05;
const THIN_GAIN = 2.0;
const CORNER = 0.7;   // pivot brake strength (0..1)
const THIN   = 0.6;   // low-pressure speed boost (0..1)

// Arc length of one path's curve (fixed resolution so duration is independent
// of render sample density → playback timeline stays stable).
function pathArc(stroke, segIdx) {
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

// Pivot sharpness at interior point i: 0 = straight through, 1 = full reversal.
function turnSharp(stroke, i) {
  const pts = stroke.points;
  if (i <= 0 || i >= pts.length - 1) return 0;   // endpoints: no pivot
  const a = pts[i - 1], b = pts[i], c = pts[i + 1];
  const ix = b.x - a.x, iy = b.y - a.y;
  const ox = c.x - b.x, oy = c.y - b.y;
  const mi = Math.hypot(ix, iy) || 1, mo = Math.hypot(ox, oy) || 1;
  const dot = clampN((ix * ox + iy * oy) / (mi * mo), -1, 1);
  return (1 - dot) / 2;
}

// Target brush speed at point i: braked by pivot sharpness, boosted when thin.
function pointSpeed(stroke, i, timing) {
  const cf = 1 - CORNER * turnSharp(stroke, i);          // pivot brake
  const tf = 1 + THIN * (1 - stroke.points[i].pressure) * THIN_GAIN; // thin boost
  return Math.max(MIN_SPEED, (timing.speed || 1) * cf * tf);
}

// Time to travel arc a (0..L) when speed varies linearly sa→sb along the arc.
// ∫ ds / (sa + (sb-sa)·s/L) - closed form; reduces to a/sa when speed constant.
function travelTime(L, sa, sb, a) {
  if (L <= 0) return 0;
  const d = sb - sa;
  if (Math.abs(d) < 1e-6) return a / sa;
  const m = d / L;
  return Math.log((sa + m * a) / sa) / m;
}

// Auto timing always applies (incl. connectors) whenever a timing config exists.
const useAuto = (stroke, timing) => !!timing;

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

// --- Auto connectors (牽絲 / trailing silk) ---------------------------------
// Cursive feel comes from thin threads linking the end of one stroke to the
// start of the next. Rather than authoring them by hand, derive a connector
// stroke between every consecutive pair. Connectors are pure derived geometry:
// never stored on the symbol, never editable, regenerated each frame.
//
// connect = { enabled, thread }
//   thread = max belly thickness - the thin waist. Ends match the stroke's own
//            end pressure; the belly is capped here and never exceeds an end.
// Connector timing is auto-computed like any stroke (driven by base speed).
export const DEFAULT_CONNECT = () => ({ enabled: false, thread: 0.18 });

// Unit tangent leaving a stroke at its last point (quad derivative at t=1).
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

// Unit tangent the stroke departs along from its first point (quad deriv at t=0).
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

// Control point of the connector: the point on A's exit tangent that (for a
// true intersection) also lies on B's entry tangent - so the thread leaves A
// and arrives B tangentially. Clamped to the gap; degenerate -> midpoint bow.
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

// Build the virtual connector stroke from stroke a -> stroke b, or null.
export function connectorStroke(a, b, connect) {
  if (!a.points.length || !b.points.length) return null;
  const A = a.points[a.points.length - 1];
  const B = b.points[0];
  const g = Math.hypot(B.x - A.x, B.y - A.y);
  if (g < 1e-4) return null;                       // coincident: nothing to draw
  const chord = { x: (B.x - A.x) / g, y: (B.y - A.y) / g };
  const u = tangentOut(a) || chord;
  const v = tangentIn(b) || chord;
  const ctrl = connectorControl(A, u, B, v, g);
  const pA = A.pressure;                            // ends match stroke pressure exactly
  const pB = B.pressure;
  // belly is the thin waist: capped at thread, never thicker than either end,
  // independent of gap so it never collapses to nothing.
  const k = Math.min(connect.thread, pA, pB);
  // duration is a manual-mode fallback only; auto timing overrides it.
  const duration = Math.max(0.05, g);
  return {
    id: `c:${a.id}>${b.id}`,
    _connector: true,
    points: [
      { id: -1, x: A.x, y: A.y, pressure: pA },
      { id: -2, x: B.x, y: B.y, pressure: pB },
    ],
    paths: [{ delay: 0, duration, ctrl, pctrl: { k } }],
  };
}

// Real strokes interleaved with derived connectors, in draw/timeline order.
// connect falsy or disabled -> just the real strokes (back-compat).
export function expandStrokes(symbol, connect) {
  const strokes = symbol?.strokes || [];
  if (!connect || !connect.enabled) return strokes;
  const out = [];
  for (let i = 0; i < strokes.length; i++) {
    out.push(strokes[i]);
    const b = strokes[i + 1];
    if (b) {
      const c = connectorStroke(strokes[i], b, connect);
      if (c) out.push(c);
    }
  }
  return out;
}

// Total animation time of one stroke. Auto timing → integrate the speed field
// per path; manual → sum authored path durations. Authored delays always apply.
export function strokeDuration(stroke, timing) {
  if (!stroke || !stroke.paths) return 0;
  let t = 0;
  const auto = useAuto(stroke, timing);
  for (let i = 0; i < stroke.paths.length; i++) {
    const p = stroke.paths[i];
    t += p.delay || 0;
    if (auto) {
      const L = pathArc(stroke, i);
      t += travelTime(L, pointSpeed(stroke, i, timing), pointSpeed(stroke, i + 1, timing), L);
    } else {
      t += p.duration || 0;
    }
  }
  return t;
}

// Total animation time of a whole symbol (strokes + connectors, in order).
export function symbolDuration(symbol, connect, timing) {
  let t = 0;
  for (const s of expandStrokes(symbol, connect)) t += strokeDuration(s, timing);
  return t;
}

// --- Playback ---------------------------------------------------------------
// A playback state tracks a global time cursor over a symbol's sequential
// timeline: { t, playing, duration }. Feed it to drawSymbol via { playhead }.

export function makePlayback(symbol, connect, timing) {
  return { t: 0, playing: false, duration: symbolDuration(symbol, connect, timing) };
}

// Keep duration in sync with the (possibly edited) symbol, re-clamping t.
export function syncPlayback(state, symbol, connect, timing) {
  state.duration = symbolDuration(symbol, connect, timing);
  if (state.t > state.duration) state.t = state.duration;
  return state;
}

// Advance (dt > 0) or rewind (dt < 0) the cursor, clamped to [0, duration].
// Reaching the end stops playback. Mutates and returns the state.
export function step(state, dt) {
  let t = state.t + dt;
  if (t <= 0) { t = 0; }
  else if (t >= state.duration) { t = state.duration; state.playing = false; }
  state.t = t;
  return state;
}

// Returns flat array of samples across all paths with global time and speed.
export function sampleStroke(stroke, sampleDensity = 80, timing) {
  if (!stroke || stroke.points.length < 2) return [];
  const auto = useAuto(stroke, timing);
  let tOffset = 0;
  const all = [];
  for (let i = 0; i < stroke.paths.length; i++) {
    const path = stroke.paths[i];
    tOffset += path.delay || 0;          // dead time before this path draws
    const { samples } = samplePath(stroke, i, sampleDensity);
    // auto: integrate the linear speed field (endpoint speeds) over the arc so
    // sample time matches strokeDuration's integral exactly.
    let L = 0, sa = 0, sb = 0, dur = 0;
    if (auto) {
      L = pathArc(stroke, i);
      sa = pointSpeed(stroke, i, timing);
      sb = pointSpeed(stroke, i + 1, timing);
      dur = travelTime(L, sa, sb, L);
    }
    // skip the first sample on subsequent paths (duplicate of prev tail)
    const start = i === 0 ? 0 : 1;
    for (let k = start; k < samples.length; k++) {
      const s = samples[k];
      const local = auto ? travelTime(L, sa, sb, s.s * L) : s.time;
      all.push({
        x: s.x,
        y: s.y,
        pressure: s.pressure,
        gTime: tOffset + local,
        arc: s.arc,
      });
    }
    tOffset += auto ? dur : path.duration;
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
