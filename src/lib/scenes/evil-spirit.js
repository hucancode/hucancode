import {
  DataTexture,
  FloatType,
  Mesh,
  NearestFilter,
  NormalBlending,
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
import WATERDROP_FRAGMENT_SHADER from "$lib/scenes/shaders/waterdrop.frag.glsl?raw";

const SHADERS = {
  brush: BRUSH_FRAGMENT_SHADER,
  waterdrop: WATERDROP_FRAGMENT_SHADER,
};
let currentStyle = "waterdrop";

const MAX_POINTS = 128;
const SAMPLES_PER_SEGMENT = 8;

let scene, camera, renderer;
let sharedGeometry;
let resolution = new Vector2(1, 1);

const spiritMeshes = []; // {mesh, mat, uniforms, curveTex, curveData}

function makeSpirit() {
  const curveData = new Float32Array(MAX_POINTS * 4);
  const curveTex = new DataTexture(curveData, MAX_POINTS, 1, RGBAFormat, FloatType);
  curveTex.minFilter = NearestFilter;
  curveTex.magFilter = NearestFilter;
  curveTex.wrapS = ClampToEdgeWrapping;
  curveTex.wrapT = ClampToEdgeWrapping;
  curveTex.needsUpdate = true;

  const uniforms = {
    iResolution: { value: resolution },
    curveTex: { value: curveTex },
    curveLen: { value: 0 },
    curveTexWidth: { value: MAX_POINTS },
    curveTotalLen: { value: 1 },
    uOffset: { value: 0.0 },
    uArcLength: { value: 1.0 },
    uWidth: { value: 0.05 },
    uTaper: { value: 4.0 },
    uInkFlow: { value: 0.25 },
    uOpacity: { value: 1.0 },
    uBrushColor: { value: [0.05, 0.05, 0.05, 0.95] },
    uBgColor: { value: [0.0, 0.0, 0.0, 0.0] },
  };

  const mat = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: SHADERS[currentStyle],
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  const mesh = new Mesh(sharedGeometry, mat);
  mesh.frustumCulled = false;
  return { mesh, mat, uniforms, curveTex, curveData };
}

function disposeSpirit(c) {
  scene.remove(c.mesh);
  c.mat.dispose();
  c.curveTex.dispose();
}

function buildBezierSegments(pts) {
  const n = pts.length;
  const segs = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const prev = i > 0     ? pts[i - 1] : p0;
    const next = i < n - 2 ? pts[i + 2] : p1;
    const c1 = { x: p0.x + (p1.x - prev.x) / 6, y: p0.y + (p1.y - prev.y) / 6 };
    const c2 = { x: p1.x - (next.x - p0.x) / 6, y: p1.y - (next.y - p0.y) / 6 };
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

function rebuildCurve(spirit, controlPoints) {
  const { uniforms, curveData, curveTex } = spirit;
  if (controlPoints.length < 2) {
    uniforms.curveLen.value = 0;
    uniforms.curveTotalLen.value = 1;
    return;
  }

  const segs = buildBezierSegments(controlPoints);
  const perSeg = Math.max(1, Math.min(SAMPLES_PER_SEGMENT, Math.floor((MAX_POINTS - 1) / segs.length)));
  let totalSamples = segs.length * perSeg + 1;
  if (totalSamples > MAX_POINTS) totalSamples = MAX_POINTS;

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
  for (let i = totalSamples; i < MAX_POINTS; i++) {
    curveData[i * 4 + 0] = 0;
    curveData[i * 4 + 1] = 0;
    curveData[i * 4 + 2] = 0;
    curveData[i * 4 + 3] = 0;
  }
  curveTex.needsUpdate = true;
  uniforms.curveLen.value = totalSamples;
  uniforms.curveTotalLen.value = Math.max(acc, 1e-6);
}

export function init(canvas) {
  scene = new Scene();
  camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  resize(canvas.clientWidth, canvas.clientHeight);
  sharedGeometry = new PlaneGeometry(2, 2);
}

export function resize(w, h) {
  if (!renderer) return;
  renderer.setSize(w, h, false);
  resolution.set(w * window.devicePixelRatio, h * window.devicePixelRatio);
}

export function render() {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
}

// spirits: [{points, width, taper, inkFlow, offset, arcLength, color}]
export function updateSpirits(spirits) {
  while (spiritMeshes.length < spirits.length) {
    const c = makeSpirit();
    scene.add(c.mesh);
    spiritMeshes.push(c);
  }
  while (spiritMeshes.length > spirits.length) {
    const c = spiritMeshes.pop();
    disposeSpirit(c);
  }
  for (let i = 0; i < spirits.length; i++) {
    const src = spirits[i];
    const dst = spiritMeshes[i];
    rebuildCurve(dst, src.points);
    if (src.width    != null) dst.uniforms.uWidth.value    = src.width;
    if (src.taper    != null) dst.uniforms.uTaper.value    = src.taper;
    if (src.inkFlow  != null) dst.uniforms.uInkFlow.value  = src.inkFlow;
    if (src.offset   != null) dst.uniforms.uOffset.value   = src.offset;
    if (src.arcLength!= null) dst.uniforms.uArcLength.value= src.arcLength;
    if (src.opacity  != null) dst.uniforms.uOpacity.value  = src.opacity;
    if (src.color)            dst.uniforms.uBrushColor.value = src.color;
  }
}

export function setStyle(name) {
  if (!SHADERS[name] || name === currentStyle) return;
  currentStyle = name;
  for (const c of spiritMeshes) {
    c.mat.dispose();
    c.mat = new ShaderMaterial({
      uniforms: c.uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: SHADERS[currentStyle],
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    });
    c.mesh.material = c.mat;
  }
}

export function destroy() {
  while (spiritMeshes.length) disposeSpirit(spiritMeshes.pop());
  if (sharedGeometry) { sharedGeometry.dispose(); sharedGeometry = null; }
  if (renderer) { renderer.dispose(); renderer = null; }
  scene = null;
  camera = null;
}

export function screenToWorld(x, y, w, h) {
  const aspect = w / h;
  const u = x / w;
  const v = 1.0 - y / h;
  return { x: (u * 2 - 1) * aspect, y: v * 2 - 1 };
}

export function getAspect(w, h) { return w / h; }
