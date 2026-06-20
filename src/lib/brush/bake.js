// Bake symbol into flat GLSL data table for caligraphy shadertoy glsl.
// mirrors engine.js math: derives auto connectors (牽絲), auto control points,
// pressure-belly arc, auto timing once, then emits const Seg[] table shader walks
// directly (no Catmull-rom / belly search / timing loop).
// pure JS so tools/bake_caligraphy.mjs and Svelte playground share one source of truth.

const AUTO_TENSION = 0.5;
const MIN_SPEED = 0.05, THIN_GAIN = 2.0, CORNER = 0.7, THIN = 0.6;

const clampN = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const mirror = (a, b) => ({ x: 2 * b.x - a.x, y: 2 * b.y - a.y });

function resolveControl(stroke, segIdx) {
  const path = stroke.paths[segIdx];
  if (path.ctrl) return { x: path.ctrl.x, y: path.ctrl.y };
  const pts = stroke.points;
  const p1 = pts[segIdx], p2 = pts[segIdx + 1];
  const p0 = pts[segIdx - 1] || mirror(p2, p1);
  const p3 = pts[segIdx + 2] || mirror(p1, p2);
  return autoControl(p0, p1, p2, p3);
}

// G1 auto control: intersection of Catmull-rom endpoint tangent lines so
// neighbouring auto segs share tangent at each anchor (no corners). degenerate/
// overshoot -> averaged Catmull handles. mirror of engine.js autoControl.
function autoControl(p0, p1, p2, p3) {
  const t1x = p2.x - p0.x, t1y = p2.y - p0.y;
  const t2x = p3.x - p1.x, t2y = p3.y - p1.y;
  const wx = p2.x - p1.x, wy = p2.y - p1.y;
  const det = t1x * t2y - t1y * t2x;
  if (Math.abs(det) > 1e-9) {
    const a = (wx * t2y - wy * t2x) / det;
    const b = (t1x * wy - t1y * wx) / det;
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

function cubic(p0, h1, h2, p1, t) {
  const u = 1 - t;
  const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
  return { x: b0 * p0.x + b1 * h1.x + b2 * h2.x + b3 * p1.x,
           y: b0 * p0.y + b1 * h1.y + b2 * h2.y + b3 * p1.y };
}

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

// belly arc fraction (dense 96, nearest curve point to control); mirror of samplePath
function bellyArc(stroke, segIdx) {
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

function turnSharp(stroke, i) {
  const pts = stroke.points;
  if (i <= 0 || i >= pts.length - 1) return 0;
  const a = pts[i - 1], b = pts[i], c = pts[i + 1];
  const ix = b.x - a.x, iy = b.y - a.y, ox = c.x - b.x, oy = c.y - b.y;
  const mi = Math.hypot(ix, iy) || 1, mo = Math.hypot(ox, oy) || 1;
  const dot = clampN((ix * ox + iy * oy) / (mi * mo), -1, 1);
  return (1 - dot) / 2;
}

function pointSpeed(stroke, i, speed) {
  const cf = 1 - CORNER * turnSharp(stroke, i);
  const tf = 1 + THIN * (1 - stroke.points[i].pressure) * THIN_GAIN;
  return Math.max(MIN_SPEED, (speed || 1) * cf * tf);
}

function travelTime(L, sa, sb, a) {
  if (L <= 0) return 0;
  const d = sb - sa;
  if (Math.abs(d) < 1e-6) return a / sa;
  const m = d / L;
  return Math.log((sa + m * a) / sa) / m;
}

// connectors, mirror of engine.js
function tangentOut(stroke) {
  const pts = stroke.points, n = pts.length;
  if (n < 2) return null;
  const end = pts[n - 1], seg = stroke.paths[n - 2];
  const c = seg && seg.ctrl ? seg.ctrl : resolveControl(stroke, n - 2);
  const dx = end.x - c.x, dy = end.y - c.y, m = Math.hypot(dx, dy) || 1;
  return { x: dx / m, y: dy / m };
}
function tangentIn(stroke) {
  const pts = stroke.points;
  if (pts.length < 2) return null;
  const start = pts[0], seg = stroke.paths[0];
  const c = seg && seg.ctrl ? seg.ctrl : resolveControl(stroke, 0);
  const dx = c.x - start.x, dy = c.y - start.y, m = Math.hypot(dx, dy) || 1;
  return { x: dx / m, y: dy / m };
}
function connectorControl(A, u, B, v, g) {
  const wx = B.x - A.x, wy = B.y - A.y;
  const det = u.x * v.y - u.y * v.x;
  if (Math.abs(det) < 1e-6) {
    return { x: (A.x + B.x) / 2 - u.y * g * 0.15, y: (A.y + B.y) / 2 + u.x * g * 0.15 };
  }
  let a = (wx * v.y - wy * v.x) / det;
  a = Math.max(0.05 * g, Math.min(0.95 * g, a));
  return { x: A.x + u.x * a, y: A.y + u.y * a };
}
function connectorStroke(a, b, connect) {
  if (!a.points.length || !b.points.length) return null;
  const A = a.points[a.points.length - 1], B = b.points[0];
  const g = Math.hypot(B.x - A.x, B.y - A.y);
  if (g < 1e-4) return null;
  const chord = { x: (B.x - A.x) / g, y: (B.y - A.y) / g };
  const u = tangentOut(a) || chord, v = tangentIn(b) || chord;
  const ctrl = connectorControl(A, u, B, v, g);
  const pA = A.pressure, pB = B.pressure;
  const k = Math.min(connect.thread, pA, pB);
  return {
    id: `c:${a.id}>${b.id}`, _connector: true,
    points: [ { id: -1, x: A.x, y: A.y, pressure: pA }, { id: -2, x: B.x, y: B.y, pressure: pB } ],
    paths: [{ delay: 0, duration: Math.max(0.05, g), ctrl, pctrl: { k } }],
  };
}
// expand to {stroke, si, connector}: original strokes keep source index si;
// auto-connectors carry index of stroke they follow (connector:true).
function expandStrokes(symbol, connect) {
  const strokes = symbol.strokes;
  const out = [];
  for (let i = 0; i < strokes.length; i++) {
    out.push({ stroke: strokes[i], si: i, connector: false });
    if (!connect || !connect.enabled) continue;
    const b = strokes[i + 1];
    if (b) { const c = connectorStroke(strokes[i], b, connect); if (c) out.push({ stroke: c, si: i, connector: true }); }
  }
  return out;
}

// seg table shared by bakeGLSL text emit + live GL renderer. walk symbol once,
// deriving auto connectors, control points, pressure belly, auto timing into flat
// array of self-contained Segs. returns { segs, strokeCount, total }.
export function bakeSegs(symbol, opts = {}) {
  const connect = opts.connect || { enabled: true, thread: 0.18 };
  const speed = opts.timing ? opts.timing.speed : 1.0;

  const expanded = expandStrokes(symbol, connect);
  const segs = [];
  let cursor = 0;
  for (const e of expanded) {
    const stroke = e.stroke;
    for (let i = 0; i < stroke.paths.length; i++) {
      const path = stroke.paths[i];
      cursor += path.delay || 0;
      const p1 = stroke.points[i], p2 = stroke.points[i + 1];
      const c = resolveControl(stroke, i);
      const v0 = pointSpeed(stroke, i, speed), v1 = pointSpeed(stroke, i + 1, speed);
      const L = pathArc(stroke, i);
      const dur = travelTime(L, v0, v1, L);
      const hasBelly = path.pctrl ? 1 : 0;
      const k = path.pctrl ? path.pctrl.k : 0;
      const belly = hasBelly ? bellyArc(stroke, i) : 0.5;
      segs.push({
        p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y }, ctrl: c,
        pr1: p1.pressure, pr2: p2.pressure, k, hasBelly, belly,
        t0: cursor, dur, v0, v1, connector: e.connector ? 1 : 0, stroke: e.si,
      });
      cursor += dur;
    }
  }
  return { segs, strokeCount: expanded.length, total: cursor };
}

// returns { glsl, segCount, strokeCount, total }
export function bakeGLSL(symbol, opts = {}) {
  const glyph = opts.glyph || "?";
  const { segs, strokeCount: expandedCount, total } = bakeSegs(symbol, opts);

  const f = n => {
    const s = Number(n).toFixed(5);
    return s.replace(/0+$/, "").replace(/\.$/, ".0");
  };
  const v2 = p => `vec2(${f(p.x)}, ${f(p.y)})`;
  const N = segs.length;
  let out = "";
  out += `// ===== BAKED by src/lib/brush/bake.js - DO NOT HAND-EDIT =====\n`;
  out += `// ${glyph}, ${expandedCount} strokes expanded with auto connectors (牽絲), auto timing.\n`;
  out += `// Each Seg is self-contained: endpoints, control, pressures, belly, timeline.\n`;
  out += `//   p1,p2   segment endpoints (world)\n`;
  out += `//   ctrl    resolved bezier control (auto Catmull-rom already applied)\n`;
  out += `//   pr1,pr2 endpoint pressures (0..1)\n`;
  out += `//   k       belly pressure value (only if hasBelly)\n`;
  out += `//   belly   parametric belly position; hasBelly 1 = use belly curve\n`;
  out += `//   t0,dur  reveal timeline (seconds); v0,v1 endpoint speeds (reveal shape)\n`;
  out += `struct Seg {\n`;
  out += `    vec2 p1; vec2 p2; vec2 ctrl;\n`;
  out += `    float pr1; float pr2; float k; float belly; int hasBelly;\n`;
  out += `    float t0; float dur; float v0; float v1;\n`;
  out += `};\n`;
  out += `const int NSEG = ${N};\n`;
  out += `const float TOTAL_TIME = ${f(total)};\n`;
  out += `const Seg SEGS[NSEG] = Seg[NSEG](\n`;
  out += segs.map(s =>
    `    Seg(${v2(s.p1)}, ${v2(s.p2)}, ${v2(s.ctrl)}, ` +
    `${f(s.pr1)}, ${f(s.pr2)}, ${f(s.k)}, ${f(s.belly)}, ${s.hasBelly}, ` +
    `${f(s.t0)}, ${f(s.dur)}, ${f(s.v0)}, ${f(s.v1)})`
  ).join(",\n");
  out += `\n);\n`;

  return { glsl: out, segCount: N, strokeCount: expandedCount, total };
}
