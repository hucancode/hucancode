import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  DataTexture,
  RGBAFormat,
  FloatType,
  NearestFilter,
  ClampToEdgeWrapping,
  WebGLRenderer,
} from "three";
import VERTEX_SHADER from "$lib/scenes/shaders/basic.vert.glsl?raw";
import STROKE_FRAGMENT_SHADER from "$lib/scenes/shaders/stroke.frag.glsl?raw";
import { allocGridTex, makeGridUniforms, buildGrid } from "$lib/scenes/stroke-grid";

const MAX_POINTS = 256;
let scene, camera, renderer, mesh, curveTex, curveData;
let gridTex, gridData;
let lastPolyline = null;

const uniforms = {
  iResolution: { value: new Vector2(1, 1) },
  uMode:        { value: 0 },       // 0 = polar arc, 1 = cartesian, 2 = polyline
  uRadius:      { value: 0.6 },
  uAngleStart:  { value: 0.2 },
  uSweepAmt:    { value: 0.92 },
  uLineWidth:   { value: 0.3 },
  uClockwise:   { value: 0.0 },
  uWobble:      { value: 0.25 },
  uStrands:     { value: 1.0 },
  uInkFlow:     { value: 0.8 },
  uWaterFlow:   { value: 0.8 },
  uOpacity:     { value: 1.0 },
  uWidthEnd:    { value: 1.0 },
  uWidthOffset: { value: 0.5 },
  uWidthRange:  { value: 1.0 },
  uWidthAnchor: { value: 0.5 },
  uBrushColor:  { value: [0.0, 0.0, 0.0, 0.9] },
  uBgColor:     { value: [1.0, 1.0, 0.875, 1.0] },
  // polyline mode (also kept declared for non-polyline modes so sampler stays bound):
  curveTex:      { value: null },
  curveTexWidth: { value: MAX_POINTS },
  curveLen:      { value: 0 },
  curveTotalLen: { value: 1 },
};

// grid uniforms attached below after texture allocation

function makeCurveTex() {
  curveData = new Float32Array(MAX_POINTS * 4);
  const tex = new DataTexture(curveData, MAX_POINTS, 1, RGBAFormat, FloatType);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function init(canvas) {
  scene = new Scene();
  camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  resize(canvas.clientWidth, canvas.clientHeight);

  curveTex = makeCurveTex();
  uniforms.curveTex.value = curveTex;

  const g = allocGridTex();
  gridTex = g.tex; gridData = g.data;
  Object.assign(uniforms, makeGridUniforms(gridTex));

  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: STROKE_FRAGMENT_SHADER,
    transparent: false,
  });
  mesh = new Mesh(new PlaneGeometry(2, 2), material);
  scene.add(mesh);
}

export function resize(w, h) {
  if (!renderer) return;
  renderer.setSize(w, h, false);
  uniforms.iResolution.value.set(w * window.devicePixelRatio, h * window.devicePixelRatio);
  rebuildGrid();
}

export function render() {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
}

export function setRadius(v)     { uniforms.uRadius.value = v; }
export function setAngleStart(v) { uniforms.uAngleStart.value = v; }
export function setSweepAmt(v)   { uniforms.uSweepAmt.value = v; }
export function setLineWidth(v)  { uniforms.uLineWidth.value = v; rebuildGrid(); }
export function setClockwise(b)  { uniforms.uClockwise.value = b ? 1.0 : 0.0; }
export function setWobble(v)     { uniforms.uWobble.value = v; }
export function setStrands(v)    { uniforms.uStrands.value = v; }
export function setInkFlow(v)    { uniforms.uInkFlow.value = v; }
export function setWaterFlow(v)  { uniforms.uWaterFlow.value = v; }
export function setWidthEnd(v)    { uniforms.uWidthEnd.value = v; }
export function setWidthOffset(v) { uniforms.uWidthOffset.value = v; }
export function setWidthRange(v)  { uniforms.uWidthRange.value = v; }
export function setWidthAnchor(v) { uniforms.uWidthAnchor.value = v; }
// 0 = polar, 1 = cartesian, 2 = polyline
export function setMode(m)       { uniforms.uMode.value = m | 0; }
// legacy alias
export function setCartesian(b)  { uniforms.uMode.value = b ? 1 : 0; }

// points = [{x, y}, ...] in world space [-aspect..aspect, -1..1]
export function setPolyline(points) {
  if (!curveData) return;
  const n = Math.min(points.length, MAX_POINTS);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      acc += Math.hypot(dx, dy);
    }
    const o = i * 4;
    curveData[o]     = points[i].x;
    curveData[o + 1] = points[i].y;
    curveData[o + 2] = acc;
    curveData[o + 3] = 0;
  }
  for (let i = n; i < MAX_POINTS; i++) {
    const o = i * 4;
    curveData[o] = curveData[o+1] = curveData[o+2] = curveData[o+3] = 0;
  }
  uniforms.curveLen.value = n;
  uniforms.curveTotalLen.value = Math.max(acc, 1e-6);
  curveTex.needsUpdate = true;

  // rebuild spatial grid for SDF acceleration
  lastPolyline = points.slice(0, n);
  rebuildGrid();
}

function rebuildGrid() {
  if (!gridData || !lastPolyline) return;
  const margin = (uniforms.uLineWidth.value || 0) * 0.5 + 0.02;
  buildGrid(lastPolyline, margin, gridData, gridTex, uniforms);
}

// screen [0..w, 0..h] -> world [-aspect..aspect, -1..1] (matching shader)
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

// Generate a circular-arc starter polyline. Tail at i=0 (angle near 2π),
// tip at i=n-1 (angle 0). Matches the polyline arc convention the shader
// uses (arc=0 at tail).
export function makeArcPolyline(n = 16, radius = 0.6, sweep = 0.92) {
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2) * (1 - i / (n - 1)) * sweep;
    pts[i] = { x: Math.sin(a) * radius, y: Math.cos(a) * radius };
  }
  return pts;
}

// Append a point near the current tail, nudged so it isn't coincident.
export function appendPolylinePoint(points, dx = 0.1, dy = 0.1) {
  const last = points[points.length - 1];
  return [...points, { x: last.x + dx, y: last.y + dy }];
}

// Drop the last point. Caller enforces minimum length.
export function dropPolylinePoint(points) {
  return points.length > 2 ? points.slice(0, -1) : points;
}

export function destroy() {
  if (mesh) {
    mesh.geometry.dispose();
    mesh.material.dispose();
    scene.remove(mesh);
    mesh = null;
  }
  if (curveTex) { curveTex.dispose(); curveTex = null; }
  if (gridTex) { gridTex.dispose(); gridTex = null; gridData = null; }
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
}
