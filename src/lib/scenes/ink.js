import {
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from "three";
import {
  makePolylineStroke,
  updatePolylineStroke,
  setStrokeLineWidth,
  disposePolylineStroke,
} from "$lib/scenes/stroke-polyline-mesh";
import {
  makePaperBackground,
  disposePaperBackground,
} from "$lib/scenes/paper-background";

const MAX_POINTS = 256;

let scene, camera, renderer, stroke, background;

// Mode drives polyline generation. In mode 1 (user polyline),
// `lastUserPolyline` is the source of truth.
const state = {
  mode: 0,        // 0 straight line, 1 user polyline
  radius: 0.6,
  angleStart: 0.2,
  sweep: 0.92,
  clockwise: false,
  lineWidth: 0.3,
};

const aspectUniform = { value: 1 };
const brushColor = [0.0, 0.0, 0.0, 0.9];
const bgColor    = [1.0, 1.0, 0.875, 1.0];

let lastUserPolyline = null;

export function init(canvas) {
  scene = new Scene();
  camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  resize(canvas.clientWidth, canvas.clientHeight);

  background = makePaperBackground({ bgColor, aspectUniform });
  scene.add(background.mesh);

  stroke = makePolylineStroke({
    maxPoints: MAX_POINTS,
    params: {
      lineWidth:   state.lineWidth,
      inkFlow:     0.8,
      strands:     1.0,
      waterFlow:   0.8,
      wobble:      0.25,
      opacity:     1.0,
      widthEnd:    1.0,
      widthOffset: 0.5,
      widthRange:  1.0,
      widthAnchor: 0.5,
    },
    brushColor,
    aspectUniform,
  });
  stroke.mesh.renderOrder = 1;
  scene.add(stroke.mesh);
  rebuild();
}

export function resize(w, h) {
  if (!renderer) return;
  renderer.setSize(w, h, false);
  aspectUniform.value = h > 0 ? w / h : 1;
  rebuild();
}

export function render() {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
}

// ----------------- polyline generation per mode -----------------

function makeLineSamples(yLevel, angleStart, sweep, clockwise) {
  // Straight horizontal line at y = yLevel, spanning a fraction of the
  // canvas width set by sweep, offset by angleStart. Tip at right end
  // (tail at left), reversed when clockwise.
  const aspect = aspectUniform.value;
  const len = 2 * aspect * Math.max(0, Math.min(1, sweep));
  const xShift = angleStart * yLevel;          // matches old uAngleStart * uRadius semantics
  const xL = -aspect + xShift;
  const xR = xL + len;
  const pts = clockwise
    ? [{ x: xR, y: yLevel }, { x: xL, y: yLevel }]
    : [{ x: xL, y: yLevel }, { x: xR, y: yLevel }];
  return pts;
}

function rebuild() {
  if (!stroke) return;
  let pts;
  if (state.mode === 1) {
    pts = lastUserPolyline;
    if (!pts || pts.length < 2) {
      stroke.geom.setDrawRange(0, 0);
      stroke.n = 0;
      return;
    }
  } else {
    pts = makeLineSamples(state.radius, state.angleStart, state.sweep, state.clockwise);
  }
  updatePolylineStroke(stroke, pts);
}

// ----------------- setters -----------------

export function setRadius(v)     { state.radius = v;     rebuild(); }
export function setAngleStart(v) { state.angleStart = v; rebuild(); }
export function setSweepAmt(v)   { state.sweep = v;      rebuild(); }
export function setClockwise(b)  { state.clockwise = !!b; rebuild(); }
export function setLineWidth(v) {
  state.lineWidth = v;
  if (stroke) setStrokeLineWidth(stroke, v);
}
export function setMode(m) {
  state.mode = m | 0;
  rebuild();
}

function setU(name, v) {
  if (stroke && stroke.uniforms[name]) stroke.uniforms[name].value = v;
}
export function setWobble(v)      { setU("uWobble", v); }
export function setStrands(v)     { setU("uStrands", v); }
export function setInkFlow(v)     { setU("uInkFlow", v); }
export function setWaterFlow(v)   { setU("uWaterFlow", v); }
export function setWidthEnd(v)    { setU("uWidthEnd", v); }
export function setWidthOffset(v) { setU("uWidthOffset", v); }
export function setWidthRange(v)  { setU("uWidthRange", v); }
export function setWidthAnchor(v) { setU("uWidthAnchor", v); }

// points = [{x, y}, ...] in world space [-aspect..aspect, -1..1]
export function setPolyline(points) {
  lastUserPolyline = points.slice(0, Math.min(points.length, MAX_POINTS));
  if (state.mode === 1) rebuild();
}

export function screenToWorld(x, y, w, h) {
  const aspect = w / h;
  const u = x / w;
  const v = 1.0 - y / h;
  return { x: (u * 2 - 1) * aspect, y: v * 2 - 1 };
}
export function worldToScreen(p, w, h) {
  const aspect = w / h;
  const u = (p.x / aspect + 1) / 2;
  const v = 1 - (p.y + 1) / 2;
  return { x: u * w, y: v * h };
}

export function makeLinePolyline(n = 16, yLevel = 0.0, sweep = 0.92) {
  const aspect = aspectUniform.value;
  const len = 2 * aspect * Math.max(0, Math.min(1, sweep));
  const xL = -len / 2;
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts[i] = { x: xL + len * t, y: yLevel };
  }
  return pts;
}

export function makeCirclePolyline(n = 32, radius = 0.6) {
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1)) * Math.PI * 2;
    pts[i] = { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
  }
  return pts;
}

export function appendPolylinePoint(points, dx = 0.1, dy = 0.1) {
  const last = points[points.length - 1];
  return [...points, { x: last.x + dx, y: last.y + dy }];
}

export function dropPolylinePoint(points) {
  return points.length > 2 ? points.slice(0, -1) : points;
}

export function destroy() {
  if (stroke) {
    if (scene) scene.remove(stroke.mesh);
    disposePolylineStroke(stroke);
    stroke = null;
  }
  if (background) {
    if (scene) scene.remove(background.mesh);
    disposePaperBackground(background);
    background = null;
  }
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
}
