import {
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

const MAX_POINTS = 512;
const SAMPLES_PER_SEGMENT = 12;
const WHISKER_SAMPLES_PER_SEG = 4;
const BODY_BUDGET = 320;          // reserved slots for body samples
const WHISKER_BUDGET = 80;        // reserved slots per whisker (W1 / W2)

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
  uWidth: { value: 0.12 },
  uTaper: { value: 4.0 },
  uInkFlow: { value: 1.0 },
  uOpacity: { value: 1.0 },
  uWobble: { value: 0.3 },
  uWidthEnd: { value: 0.1 },
  uWidthOffset: { value: 0.5 },
  uWidthRange: { value: 1.0 },
  uBrushColor: { value: [0.05, 0.05, 0.05, 0.95] },
  uBgColor: { value: [1.0, 1.0, 0.875, 1.0] },
  uHeadPos: { value: new Vector2(0, 0) },
  uHeadDir: { value: new Vector2(1, 0) },
  uHeadSize: { value: 0.25 },
  uShowHead: { value: 1.0 },
  curveW1Start: { value: BODY_BUDGET },
  curveW1Len: { value: 0 },
  curveW1TotalLen: { value: 1 },
  curveW2Start: { value: BODY_BUDGET + WHISKER_BUDGET },
  curveW2Len: { value: 0 },
  curveW2TotalLen: { value: 1 },
  uWhiskerWidth: { value: 0.015 },
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

// Write a smoothed polyline into curveData[startSlot ... startSlot+budget).
// Returns { len, totalLen }. Bezier-smooths when perSegment > 1; with perSegment=1
// the raw control polyline is written directly (used for whiskers).
function writeChain(controlPoints, startSlot, budget, perSegment) {
  if (controlPoints.length < 2 || budget < 2) {
    return { len: 0, totalLen: 0 };
  }

  let pts;
  if (perSegment <= 1) {
    pts = controlPoints.slice(0, Math.min(controlPoints.length, budget));
  } else {
    const segs = buildBezierSegments(controlPoints);
    const perSeg = Math.max(1, Math.min(perSegment, Math.floor((budget - 1) / segs.length)));
    let totalSamples = Math.min(segs.length * perSeg + 1, budget);
    pts = new Array(totalSamples);
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
    pts.length = idx;
  }

  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      acc += Math.hypot(dx, dy);
    }
    const o = (startSlot + i) * 4;
    curveData[o + 0] = pts[i].x;
    curveData[o + 1] = pts[i].y;
    curveData[o + 2] = acc;
    curveData[o + 3] = 0;
  }
  for (let i = pts.length; i < budget; i++) {
    const o = (startSlot + i) * 4;
    curveData[o + 0] = 0;
    curveData[o + 1] = 0;
    curveData[o + 2] = 0;
    curveData[o + 3] = 0;
  }
  return { len: pts.length, totalLen: acc };
}

function rebuildCurve(controlPoints) {
  const r = writeChain(controlPoints, 0, BODY_BUDGET, SAMPLES_PER_SEGMENT);
  curveLen = r.len;
  curveTotalLen = r.totalLen;
  uniforms.curveLen.value = curveLen;
  uniforms.curveTotalLen.value = Math.max(curveTotalLen, 1e-6);
  curveTex.needsUpdate = true;
}

function rebuildWhisker(controlPoints, slot) {
  const r = writeChain(controlPoints, slot === 0 ? BODY_BUDGET : BODY_BUDGET + WHISKER_BUDGET,
                       WHISKER_BUDGET, WHISKER_SAMPLES_PER_SEG);
  if (slot === 0) {
    uniforms.curveW1Len.value = r.len;
    uniforms.curveW1TotalLen.value = Math.max(r.totalLen, 1e-6);
  } else {
    uniforms.curveW2Len.value = r.len;
    uniforms.curveW2TotalLen.value = Math.max(r.totalLen, 1e-6);
  }
  curveTex.needsUpdate = true;
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

export function setWidth(v)     { uniforms.uWidth.value = v; }
export function setTaper(v)     { uniforms.uTaper.value = v; }
export function setInkFlow(v)   { uniforms.uInkFlow.value = v; }
export function setWobble(v)    { uniforms.uWobble.value = v; }
export function setWidthEnd(v)    { uniforms.uWidthEnd.value = v; }
export function setWidthOffset(v) { uniforms.uWidthOffset.value = v; }
export function setWidthRange(v)  { uniforms.uWidthRange.value = v; }

export function setControlPoints(points) {
  rebuildCurve(points);
}

export function setWhisker(slot, points) {
  rebuildWhisker(points, slot);
}

export function setWhiskerWidth(v) { uniforms.uWhiskerWidth.value = v; }

export function setHead(pos, dir, size, show) {
  if (pos) uniforms.uHeadPos.value.set(pos.x, pos.y);
  if (dir) uniforms.uHeadDir.value.set(dir.x, dir.y);
  if (typeof size === "number") uniforms.uHeadSize.value = size;
  if (typeof show === "boolean") uniforms.uShowHead.value = show ? 1.0 : 0.0;
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
