import {
  Color,
  DataTexture,
  FloatType,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  ClampToEdgeWrapping,
} from "three";
import VERTEX_SHADER from "$lib/scenes/shaders/basic.vert.glsl?raw";
import BRUSH_FRAGMENT_SHADER from "$lib/scenes/shaders/brush.frag.glsl?raw";

const MAX_POINTS = 256;
const SAMPLES_PER_SEGMENT = 12;

let scene, camera, renderer, mesh;
let curveTex;
let curveData;       // Float32Array RGBA per pixel
let curveLen = 0;
let curveTotalLen = 0;

// uniforms shared
const uniforms = {
  iResolution: { value: new Vector2(1, 1) },
  curveTex: { value: null },
  curveLen: { value: 0 },
  curveTexWidth: { value: MAX_POINTS },
  curveTotalLen: { value: 1 },
  uOffset: { value: 0.0 },
  uArcLength: { value: 1.0 },
  uWidth: { value: 0.12 },
  uTaper: { value: 4.0 },
  uInkFlow: { value: 1.0 },
  uBrushColor: { value: [0.05, 0.05, 0.05, 0.95] },
  uBgColor: { value: new Color(1.0, 1.0, 0.875) },
};

function allocTexture() {
  curveData = new Float32Array(MAX_POINTS * 4);
  curveTex = new DataTexture(curveData, MAX_POINTS, 1, RGBAFormat, FloatType);
  curveTex.minFilter = NearestFilter;
  curveTex.magFilter = NearestFilter;
  curveTex.wrapS = ClampToEdgeWrapping;
  curveTex.wrapT = ClampToEdgeWrapping;
  curveTex.needsUpdate = true;
  uniforms.curveTex.value = curveTex;
}

// Build cubic-bezier control points per segment using neighbor tangents.
// For segment (Pi -> Pi+1):
//   c1 = Pi + (Pi+1 - Pi-1) / 6
//   c2 = Pi+1 - (Pi+2 - Pi) / 6
// Endpoints clamp to extrapolated neighbor.
function buildBezierSegments(pts) {
  const n = pts.length;
  const segs = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const prev = i > 0     ? pts[i - 1] : p0;
    const next = i < n - 2 ? pts[i + 2] : p1;
    const c1 = {
      x: p0.x + (p1.x - prev.x) / 6,
      y: p0.y + (p1.y - prev.y) / 6,
    };
    const c2 = {
      x: p1.x - (next.x - p0.x) / 6,
      y: p1.y - (next.y - p0.y) / 6,
    };
    segs.push({ p0, c1, c2, p1 });
  }
  return segs;
}

function sampleBezier(seg, t) {
  const omt = 1 - t;
  const a = omt * omt * omt;
  const b = 3 * omt * omt * t;
  const c = 3 * omt * t * t;
  const d = t * t * t;
  return {
    x: a * seg.p0.x + b * seg.c1.x + c * seg.c2.x + d * seg.p1.x,
    y: a * seg.p0.y + b * seg.c1.y + c * seg.c2.y + d * seg.p1.y,
  };
}

function rebuildCurve(controlPoints) {
  if (controlPoints.length < 2) {
    curveLen = 0;
    curveTotalLen = 0;
    uniforms.curveLen.value = 0;
    uniforms.curveTotalLen.value = 1;
    return;
  }

  const segs = buildBezierSegments(controlPoints);
  // cap per-segment sample count so total samples fit MAX_POINTS even with high N
  const perSeg = Math.max(1, Math.min(SAMPLES_PER_SEGMENT, Math.floor((MAX_POINTS - 1) / segs.length)));
  let totalSamples = segs.length * perSeg + 1;
  if (totalSamples > MAX_POINTS) totalSamples = MAX_POINTS;

  // generate samples
  const pts = new Array(totalSamples);
  let idx = 0;
  for (let s = 0; s < segs.length && idx < totalSamples; s++) {
    for (let k = 0; k < perSeg && idx < totalSamples; k++) {
      pts[idx++] = sampleBezier(segs[s], k / perSeg);
    }
  }
  if (idx < totalSamples) {
    const last = segs[segs.length - 1];
    pts[idx++] = { x: last.p1.x, y: last.p1.y };
  }
  totalSamples = idx;

  // cumulative arc length + write to texture
  let acc = 0;
  for (let i = 0; i < totalSamples; i++) {
    if (i > 0) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      acc += Math.hypot(dx, dy);
    }
    curveData[i * 4 + 0] = pts[i].x;
    curveData[i * 4 + 1] = pts[i].y;
    curveData[i * 4 + 2] = acc;
    curveData[i * 4 + 3] = 0;
  }
  // zero remainder
  for (let i = totalSamples; i < MAX_POINTS; i++) {
    curveData[i * 4 + 0] = 0;
    curveData[i * 4 + 1] = 0;
    curveData[i * 4 + 2] = 0;
    curveData[i * 4 + 3] = 0;
  }
  curveTex.needsUpdate = true;
  curveLen = totalSamples;
  curveTotalLen = acc;
  uniforms.curveLen.value = curveLen;
  uniforms.curveTotalLen.value = Math.max(curveTotalLen, 1e-6);
}

function makeMesh() {
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: BRUSH_FRAGMENT_SHADER,
    transparent: false,
  });
  const geom = new PlaneGeometry(2, 2);
  return new Mesh(geom, material);
}

export function init(canvas) {
  scene = new Scene();
  camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  resize(canvas.clientWidth, canvas.clientHeight);

  allocTexture();

  mesh = makeMesh();
  scene.add(mesh);
}

export function resize(w, h) {
  if (!renderer) return;
  renderer.setSize(w, h, false);
  uniforms.iResolution.value.set(w * window.devicePixelRatio, h * window.devicePixelRatio);
}

export function render() {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
}

export function setOffset(v)    { uniforms.uOffset.value = v; }
export function setArcLength(v) { uniforms.uArcLength.value = v; }
export function setWidth(v)     { uniforms.uWidth.value = v; }
export function setTaper(v)     { uniforms.uTaper.value = v; }
export function setInkFlow(v)   { uniforms.uInkFlow.value = v; }

export function setControlPoints(points) {
  rebuildCurve(points);
}

export function destroy() {
  if (mesh) {
    mesh.geometry.dispose();
    mesh.material.dispose();
    scene.remove(mesh);
    mesh = null;
  }
  if (curveTex) {
    curveTex.dispose();
    curveTex = null;
  }
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
}

// screen [0..w, 0..h] -> world [-aspect..aspect, -1..1] (matching shader)
export function screenToWorld(x, y, w, h) {
  const aspect = w / h;
  const u = x / w;
  const v = 1.0 - y / h;
  return { x: (u * 2 - 1) * aspect, y: v * 2 - 1 };
}
