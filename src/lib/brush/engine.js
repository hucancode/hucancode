// Data model:
//   Symbol = { strokes: Stroke[] }
//   Stroke = { id, points, paths }   paths.length === points.length - 1
//   Point  = { id, x, y, pressure }  pressure 0..1
//   Path   = { duration, ctrl, pctrl }
//     ctrl  = third point {x,y} steering segment, null = auto. straight seg -> ctrl at chord midpoint.
//     pctrl = pressure curve control {k}, null = linear. pressure is quadratic bezier value curve
//             endpoints (0,A),(1,B); pctrl bends it through value k at belly (arc pos of ctrl).
//
// Sampling: per path between point i, i+1, quad bezier through ctrl:
//   B(t) = (1-t)^2 p1 + 2(1-t)t ctrl + t^2 p2. resample arc-length uniform; per arc fraction s:
//   pos p(s); pressure = pressureAt(pctrl,A,B,s); localTime = s*duration. width from pressure.

let _id = 0;
export const uid = () => ++_id;
export const setUidFloor = (n) => { if (n > _id) _id = n; };

export const DEFAULT_PATH = () => ({
  delay: 0.0,    // dead time (s) before path starts drawing
  duration: 1.0,
  ctrl: null,    // third point {x,y}, null = auto from neighbours
  pctrl: null,   // pressure control {k}, null = linear A->B
});

const AUTO_TENSION = 0.5;

// explicit override, else G1 catmull-rom auto
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

// auto quad control for seg p1->p2 given neighbours p0,p3.
// place at intersection of Catmull-rom endpoint tangent lines (tangent at p1 ∝ p2-p0, at p2 ∝ p3-p1).
// adjacent auto segs share tangent at each anchor -> G1 joins, no corners.
// degenerate/overshoot (near-straight, or inflection inside seg) -> fall back to averaged Catmull handles.
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

export function makeStroke(points = []) {
  const pts = points.length >= 2
    ? points
    : [makePoint(-0.5, 0, 0.4), makePoint(0.5, 0, 0.8)];
  const paths = new Array(Math.max(0, pts.length - 1)).fill(0).map(DEFAULT_PATH);
  return { id: uid(), points: pts, paths };
}

// 1-point strokes valid but not rendered (need >=2 points for any path)
export function makeStrokeRaw(points) {
  const paths = new Array(Math.max(0, points.length - 1)).fill(0).map(DEFAULT_PATH);
  return { id: uid(), points: [...points], paths };
}

export function addPoint(stroke, x, y, pressure = 0.5) {
  stroke.points.push(makePoint(x, y, pressure));
  if (stroke.points.length >= 2) stroke.paths.push(DEFAULT_PATH());
  return stroke;
}

// insert point after points[idx]. new path between points[idx] and new point;
// old path points[idx]->points[idx+1] now connects new point->points[idx+1].
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

// sample one path with arc-length uniform fractions s in [0..1]
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

  // belly = arc fraction of curve point nearest control point. where pressure thins/swells to pctrl.k.
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

// Auto timing: derive brush velocity from geometry + pressure, integrate for time.
// slow at pivot (sharp turn), accelerate leaving pivot, accelerate on thin line (low pressure -> faster, drier).
// timing = { speed } = base velocity (world units/sec) on straight full-ink run.
// corner brake + thin boost are fixed constants; only base speed configurable.
export const DEFAULT_TIMING = () => ({ speed: 1.0 });

const MIN_SPEED = 0.05;
const THIN_GAIN = 2.0;
const CORNER = 0.7;   // pivot brake strength (0..1)
const THIN   = 0.6;   // low-pressure speed boost (0..1)

// fixed resolution so duration independent of render sample density -> stable playback timeline
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

// pivot sharpness at interior point i: 0 = straight through, 1 = full reversal
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

// target brush speed at point i: braked by pivot sharpness, boosted when thin
function pointSpeed(stroke, i, timing) {
  const cf = 1 - CORNER * turnSharp(stroke, i);          // pivot brake
  const tf = 1 + THIN * (1 - stroke.points[i].pressure) * THIN_GAIN; // thin boost
  return Math.max(MIN_SPEED, (timing.speed || 1) * cf * tf);
}

// time to travel arc a (0..L) when speed varies linearly sa->sb along arc.
// ∫ ds / (sa + (sb-sa)·s/L) closed form; reduces to a/sa when speed constant.
function travelTime(L, sa, sb, a) {
  if (L <= 0) return 0;
  const d = sb - sa;
  if (Math.abs(d) < 1e-6) return a / sa;
  const m = d / L;
  return Math.log((sa + m * a) / sa) / m;
}

const useAuto = (stroke, timing) => !!timing;

// pressure value along path at progress s in [0..1]. endpoints (0,A),(1,B).
// pctrl={k} -> quad bezier through control (bellyX,k): belly thins/swells to k at
// bellyX (arc fraction of geometry control point). pctrl null -> linear A->B.
// bezier P(t) = (1-t)^2 P0 + 2(1-t)t C + t^2 P2 in (progress,value).
// solve bezier_x(t) = s for t, return bezier_y(t).
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

// Auto connectors (牽絲 / trailing silk): thin threads linking end of one stroke
// to start of next, derived per consecutive pair. pure derived geometry: never
// stored on symbol, never editable, regenerated each frame.
// connect = { enabled, thread }. thread = max belly thickness (thin waist).
// ends match stroke end pressure; belly capped at thread, never exceeds an end.
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

// connector control point: point on A's exit tangent that also lies on B's entry
// tangent -> thread leaves A and arrives B tangentially. clamped to gap; degenerate -> midpoint bow.
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

// build virtual connector stroke from stroke a -> stroke b, or null
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
  // belly thin waist: capped at thread, never thicker than either end, gap-independent so never collapses
  const k = Math.min(connect.thread, pA, pB);
  // manual-mode fallback only; auto timing overrides
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

// real strokes interleaved with derived connectors, in draw/timeline order.
// connect falsy or disabled -> real strokes only.
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

// total time of one stroke. auto -> integrate speed field per path; manual -> sum
// authored path durations. authored delays always apply.
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

export function symbolDuration(symbol, connect, timing) {
  let t = 0;
  for (const s of expandStrokes(symbol, connect)) t += strokeDuration(s, timing);
  return t;
}

// playback state tracks global time cursor over symbol's sequential timeline:
// { t, playing, duration }. feed to drawSymbol via { playhead }.
export function makePlayback(symbol, connect, timing) {
  return { t: 0, playing: false, duration: symbolDuration(symbol, connect, timing) };
}

// keep duration in sync with edited symbol, re-clamp t
export function syncPlayback(state, symbol, connect, timing) {
  state.duration = symbolDuration(symbol, connect, timing);
  if (state.t > state.duration) state.t = state.duration;
  return state;
}

// advance (dt>0) or rewind (dt<0) cursor, clamped to [0, duration].
// reaching end stops playback. mutates and returns state.
export function step(state, dt) {
  let t = state.t + dt;
  if (t <= 0) { t = 0; }
  else if (t >= state.duration) { t = state.duration; state.playing = false; }
  state.t = t;
  return state;
}

// flat array of samples across all paths with global time and speed
export function sampleStroke(stroke, sampleDensity = 80, timing) {
  if (!stroke || stroke.points.length < 2) return [];
  const auto = useAuto(stroke, timing);
  let tOffset = 0;
  const all = [];
  for (let i = 0; i < stroke.paths.length; i++) {
    const path = stroke.paths[i];
    tOffset += path.delay || 0;          // dead time before path draws
    const { samples } = samplePath(stroke, i, sampleDensity);
    // auto: integrate linear speed field over arc so sample time matches strokeDuration integral exactly
    let L = 0, sa = 0, sb = 0, dur = 0;
    if (auto) {
      L = pathArc(stroke, i);
      sa = pointSpeed(stroke, i, timing);
      sb = pointSpeed(stroke, i + 1, timing);
      dur = travelTime(L, sa, sb, L);
    }
    // skip first sample on subsequent paths (duplicate of prev tail)
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
  // speed: ds_world / dt, smoothed via neighbour deltas
  for (let i = 0; i < all.length; i++) {
    const prev = all[Math.max(0, i - 1)];
    const next = all[Math.min(all.length - 1, i + 1)];
    const ds = Math.hypot(next.x - prev.x, next.y - prev.y);
    const dt = Math.max(1e-4, next.gTime - prev.gTime);
    all[i].speed = ds / dt;
  }
  return all;
}
