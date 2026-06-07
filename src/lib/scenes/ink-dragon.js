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
import STROKE_FRAGMENT_SHADER from "$lib/scenes/shaders/stroke.frag.glsl?raw";
import WATERDROP_FRAGMENT_SHADER from "$lib/scenes/shaders/waterdrop.frag.glsl?raw";
import DRAGON_HEAD_FRAGMENT_SHADER from "$lib/scenes/shaders/dragon-head.frag.glsl?raw";
import { allocGridTex, makeGridUniforms, buildGrid } from "$lib/scenes/stroke-grid";

const BODY_MAX_POINTS = 320;
const WHISKER_MAX_POINTS = 80;
const BODY_SAMPLES_PER_SEGMENT = 12;
const WHISKER_SAMPLES_PER_SEGMENT = 4;

let scene, camera, renderer, sharedGeometry, headMesh;
let bodyStroke = null;
let whiskerStrokes = [null, null];

const resolution = new Vector2(1, 1);
const brushColor = [0.05, 0.05, 0.05, 0.95];

const headUniforms = {
  iResolution: { value: resolution },
  uBrushColor: { value: brushColor },
  uHeadPos: { value: new Vector2(0, 0) },
  uHeadDir: { value: new Vector2(1, 0) },
  uHeadSize: { value: 0.25 },
  uShowHead: { value: 1.0 },
};

function makeStrokeUniforms({ lineWidth, widthEnd, widthOffset, widthRange,
                              inkFlow, strands, waterFlow, wobble,
                              opacity, bgColor }, curveTex, maxPoints, gridUniforms) {
  return {
    iResolution: { value: resolution },
    uMode: { value: 2 },
    curveTex: { value: curveTex },
    curveLen: { value: 0 },
    curveTexWidth: { value: maxPoints },
    curveTotalLen: { value: 1 },
    uLineWidth:   { value: lineWidth },
    uInkFlow:     { value: inkFlow },
    uStrands:     { value: strands },
    uWaterFlow:   { value: waterFlow },
    uOpacity:     { value: opacity },
    uWobble:      { value: wobble },
    uWidthEnd:    { value: widthEnd },
    uWidthOffset: { value: widthOffset },
    uWidthRange:  { value: widthRange },
    uBrushColor:  { value: brushColor },
    uBgColor:     { value: bgColor },
    // polar/cartesian uniforms unused in polyline mode but declared so the shader compiles
    uRadius:      { value: 0.0 },
    uAngleStart:  { value: 0.0 },
    uSweepAmt:    { value: 1.0 },
    uClockwise:   { value: 0.0 },
    uWidthAnchor: { value: 0.5 },
    ...gridUniforms,
  };
}

function makeStroke({ maxPoints, opaque, params }) {
  const data = new Float32Array(maxPoints * 4);
  const tex = new DataTexture(data, maxPoints, 1, RGBAFormat, FloatType);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;

  const g = allocGridTex();
  const gridUniforms = makeGridUniforms(g.tex);
  const uniforms = makeStrokeUniforms(params, tex, maxPoints, gridUniforms);

  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: STROKE_FRAGMENT_SHADER,
    transparent: !opaque,
    depthWrite: opaque,
    blending: opaque ? undefined : NormalBlending,
  });
  const mesh = new Mesh(sharedGeometry, material);
  mesh.frustumCulled = false;

  return {
    mesh, material, uniforms,
    tex, data,
    gridTex: g.tex, gridData: g.data,
    maxPoints,
    lastPts: null,
  };
}

function disposeStroke(s) {
  if (!s) return;
  if (s.mesh && scene) scene.remove(s.mesh);
  s.material.dispose();
  s.tex.dispose();
  if (s.gridTex) s.gridTex.dispose();
}

function makeWhiskerStroke({ maxPoints, params }) {
  const data = new Float32Array(maxPoints * 4);
  const tex = new DataTexture(data, maxPoints, 1, RGBAFormat, FloatType);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;

  const uniforms = {
    iResolution: { value: resolution },
    curveTex: { value: tex },
    curveLen: { value: 0 },
    curveTexWidth: { value: maxPoints },
    curveTotalLen: { value: 1 },
    uOffset:      { value: 0.0 },
    uArcLength:   { value: 1.0 },
    uLineWidth:   { value: params.width },
    uInkFlow:     { value: params.inkFlow },
    uOpacity:     { value: params.opacity },
    uWidthEnd:    { value: params.widthEnd },
    uWidthOffset: { value: params.widthOffset },
    uWidthRange:  { value: params.widthRange },
    uBrushColor:  { value: brushColor },
    uBgColor:     { value: params.bgColor },
  };

  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: WATERDROP_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  const mesh = new Mesh(sharedGeometry, material);
  mesh.frustumCulled = false;

  return {
    mesh, material, uniforms,
    tex, data,
    maxPoints,
    lastPts: null,
  };
}

// Cubic-bezier control points per segment using neighbor tangents.
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

// Smooth-and-write a control polyline into a stroke. perSegment > 1 bezier-smooths;
// perSegment <= 1 writes raw control points.
function writeChain(stroke, controlPoints, perSegment) {
  const { data, tex, uniforms, maxPoints } = stroke;
  if (controlPoints.length < 2) {
    uniforms.curveLen.value = 0;
    uniforms.curveTotalLen.value = 1;
    stroke.lastPts = null;
    return;
  }

  let pts;
  if (perSegment <= 1) {
    pts = controlPoints.slice(0, Math.min(controlPoints.length, maxPoints));
  } else {
    const segs = buildBezierSegments(controlPoints);
    const perSeg = Math.max(1, Math.min(perSegment, Math.floor((maxPoints - 1) / segs.length)));
    let totalSamples = Math.min(segs.length * perSeg + 1, maxPoints);
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
    const o = i * 4;
    data[o + 0] = pts[i].x;
    data[o + 1] = pts[i].y;
    data[o + 2] = acc;
    data[o + 3] = 0;
  }
  for (let i = pts.length; i < maxPoints; i++) {
    const o = i * 4;
    data[o + 0] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
  }
  tex.needsUpdate = true;
  uniforms.curveLen.value = pts.length;
  uniforms.curveTotalLen.value = Math.max(acc, 1e-6);
  stroke.lastPts = pts;
  rebuildStrokeGrid(stroke);
}

function rebuildStrokeGrid(stroke) {
  if (!stroke || !stroke.gridTex || !stroke.lastPts || stroke.lastPts.length < 2) return;
  const margin = (stroke.uniforms.uLineWidth.value || 0) * 0.5 + 0.02;
  buildGrid(stroke.lastPts, margin, stroke.gridData, stroke.gridTex, stroke.uniforms);
}

function makeHeadMesh() {
  const material = new ShaderMaterial({
    uniforms: headUniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: DRAGON_HEAD_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  const m = new Mesh(sharedGeometry, material);
  m.renderOrder = 3;
  return m;
}

export function init(canvas) {
  scene = new Scene();
  camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  resize(canvas.clientWidth, canvas.clientHeight);
  sharedGeometry = new PlaneGeometry(2, 2);

  bodyStroke = makeStroke({
    maxPoints: BODY_MAX_POINTS,
    opaque: true,
    params: {
      lineWidth: 0.12,
      widthEnd: 0.1, widthOffset: 0.5, widthRange: 1.0,
      inkFlow: 1.0, strands: 1.0, waterFlow: 0.5, wobble: 0.3,
      opacity: 1.0,
      bgColor: [1.0, 1.0, 0.875, 1.0],
    },
  });
  scene.add(bodyStroke.mesh);

  for (let i = 0; i < 2; i++) {
    whiskerStrokes[i] = makeWhiskerStroke({
      maxPoints: WHISKER_MAX_POINTS,
      params: {
        width: 0.01,
        widthEnd: 0.0, widthOffset: 0.4, widthRange: 0.8,
        inkFlow: 0.6,
        opacity: 1.0,
        bgColor: [0, 0, 0, 0],
      },
    });
    whiskerStrokes[i].mesh.renderOrder = 2;
    scene.add(whiskerStrokes[i].mesh);
  }

  headMesh = makeHeadMesh();
  scene.add(headMesh);
}

export function resize(w, h) {
  if (!renderer) return;
  renderer.setSize(w, h, false);
  resolution.set(w * window.devicePixelRatio, h * window.devicePixelRatio);
  rebuildStrokeGrid(bodyStroke);
  for (const s of whiskerStrokes) rebuildStrokeGrid(s);
}

export function render() {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
}

export function setWidth(v) {
  if (!bodyStroke) return;
  bodyStroke.uniforms.uLineWidth.value = v;
  rebuildStrokeGrid(bodyStroke);
}
export function setInkFlow(v)   { if (bodyStroke) bodyStroke.uniforms.uInkFlow.value = v; }
export function setStrands(v)   { if (bodyStroke) bodyStroke.uniforms.uStrands.value = v; }
export function setWaterFlow(v) { if (bodyStroke) bodyStroke.uniforms.uWaterFlow.value = v; }
export function setWobble(v)    { if (bodyStroke) bodyStroke.uniforms.uWobble.value = v; }
export function setWidthEnd(v)    { if (bodyStroke) bodyStroke.uniforms.uWidthEnd.value = v; }
export function setWidthOffset(v) { if (bodyStroke) bodyStroke.uniforms.uWidthOffset.value = v; }
export function setWidthRange(v)  { if (bodyStroke) bodyStroke.uniforms.uWidthRange.value = v; }

export function setControlPoints(points) {
  if (!bodyStroke) return;
  writeChain(bodyStroke, points, BODY_SAMPLES_PER_SEGMENT);
}

export function setWhisker(slot, points) {
  const s = whiskerStrokes[slot];
  if (!s) return;
  // Caller passes anchor → free-tip. Stroke convention: arc=0 = thick end.
  // Reverse so anchor (at dragon head) sits at arc=0 → renders thick.
  writeChain(s, points.slice().reverse(), WHISKER_SAMPLES_PER_SEGMENT);
}

export function setWhiskerWidth(v) {
  for (const s of whiskerStrokes) {
    if (!s) continue;
    s.uniforms.uLineWidth.value = v;
  }
}

export function setHead(pos, dir, size, show) {
  if (pos) headUniforms.uHeadPos.value.set(pos.x, pos.y);
  if (dir) headUniforms.uHeadDir.value.set(dir.x, dir.y);
  if (typeof size === "number") headUniforms.uHeadSize.value = size;
  if (typeof show === "boolean") headUniforms.uShowHead.value = show ? 1.0 : 0.0;
}

export function destroy() {
  if (headMesh) {
    headMesh.material.dispose();
    if (scene) scene.remove(headMesh);
    headMesh = null;
  }
  disposeStroke(bodyStroke); bodyStroke = null;
  for (let i = 0; i < whiskerStrokes.length; i++) {
    disposeStroke(whiskerStrokes[i]);
    whiskerStrokes[i] = null;
  }
  if (sharedGeometry) { sharedGeometry.dispose(); sharedGeometry = null; }
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  scene = null;
  camera = null;
}

// screen [0..w, 0..h] -> world [-aspect..aspect, -1..1] (matching shader)
export function screenToWorld(x, y, w, h) {
  const aspect = w / h;
  const u = x / w;
  const v = 1.0 - y / h;
  return { x: (u * 2 - 1) * aspect, y: v * 2 - 1 };
}

// Canvas-clamped pointer → world. Clamping at the source stops a
// pointer-captured off-canvas drag from yanking the chain to extreme coords.
export function eventToWorld(canvasEl, e) {
  if (!canvasEl) return { x: 0, y: 0 };
  const r = canvasEl.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return { x: 0, y: 0 };
  const x = Math.max(0, Math.min(r.width,  e.clientX - r.left));
  const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
  return screenToWorld(x, y, r.width, r.height);
}

export function worldToScreen(p, w, h) {
  const aspect = w / h;
  const u = (p.x / aspect + 1) * 0.5;
  const v = (p.y + 1) * 0.5;
  return { x: u * w, y: (1 - v) * h };
}

// ============================================================================
// Chain physics — body + two verlet whiskers. State lives here; the svelte
// component reads parameters in and reads back overlay snapshots out.
// ============================================================================

// anchor offset in head-local space (origin = eye/chain-tip, +x = forward)
const WHISKER_ANCHOR_X = 0.5;
const WHISKER_ANCHOR_Y = 0.08;

// Physics params — set from the svelte sliders via setPhysicsParam().
const phys = {
  vertexCount: 16,
  bodyLen: 1.2,
  propagationSpeed: 0.6,
  maxBendDeg: 60,
  whiskerSegs: 5,
  whiskerLen: 1.2,
  whiskerDamping: 0.88,
  headSize: 0.15,
};

// state
let body = [];                      // [{x,y}]
let whiskerL = [], whiskerR = [];   // [{x,y,px,py}]
let tipTarget = null;

export function setPhysicsParam(name, value) {
  if (!(name in phys)) return;
  const prev = phys[name];
  phys[name] = value;
  if (name === "vertexCount" || name === "bodyLen") resetBaseline();
  if (name === "whiskerSegs" || name === "headSize" || name === "whiskerLen") {
    if (prev !== value) resetWhiskers();
  }
}

export function setTipTarget(p) { tipTarget = p; }

export function resetBaseline() {
  const N = Math.max(2, Math.floor(phys.vertexCount));
  const L = phys.bodyLen;
  body = new Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    body[i] = { x: -L / 2 + t * L, y: 0 };
  }
}

function headFrame() {
  const N = body.length;
  if (N < 2) return { pos: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, perp: { x: 0, y: 1 } };
  const tip = body[N - 1];
  const prev = body[N - 2];
  let dx = tip.x - prev.x, dy = tip.y - prev.y;
  const m = Math.hypot(dx, dy);
  if (m < 1e-6) { dx = 1; dy = 0; }
  else { dx /= m; dy /= m; }
  const neckLen = 0.05;
  return {
    pos:  { x: tip.x + dx * neckLen, y: tip.y + dy * neckLen },
    dir:  { x: dx, y: dy },
    perp: { x: -dy, y: dx },
  };
}

function whiskerAnchor(side) {
  const f = headFrame();
  const ax = f.pos.x + f.dir.x * (WHISKER_ANCHOR_X * phys.headSize) + f.perp.x * (side * WHISKER_ANCHOR_Y * phys.headSize);
  const ay = f.pos.y + f.dir.y * (WHISKER_ANCHOR_X * phys.headSize) + f.perp.y * (side * WHISKER_ANCHOR_Y * phys.headSize);
  return { x: ax, y: ay, dir: f.dir, perp: f.perp };
}

function makeWhisker(side) {
  const N = Math.max(2, Math.floor(phys.whiskerSegs));
  const a = whiskerAnchor(side);
  const total = phys.whiskerLen * phys.headSize;
  const step = total / (N - 1);
  const pts = new Array(N);
  for (let i = 0; i < N; i++) {
    const t = i * step;
    const x = a.x - a.dir.x * t + a.perp.x * (side * 0.02 * phys.headSize * i);
    const y = a.y - a.dir.y * t + a.perp.y * (side * 0.02 * phys.headSize * i);
    pts[i] = { x, y, px: x, py: y };
  }
  return pts;
}

export function resetWhiskers() {
  whiskerL = makeWhisker(+1);
  whiskerR = makeWhisker(-1);
}

function stepBody() {
  if (!tipTarget || body.length < 2) return;
  const N = body.length;
  const linkLen = N >= 2 ? phys.bodyLen / (N - 1) : 0;
  const next = body.slice();
  const speed = Math.max(0, Math.min(1, phys.propagationSpeed));
  next[N - 1] = { x: tipTarget.x, y: tipTarget.y };

  for (let i = N - 2; i >= 0; i--) {
    const dx = next[i + 1].x - next[i].x;
    const dy = next[i + 1].y - next[i].y;
    const d = Math.hypot(dx, dy);
    if (d > linkLen && d > 1e-6) {
      const inv = ((d - linkLen) * speed) / d;
      next[i] = { x: next[i].x + dx * inv, y: next[i].y + dy * inv };
    }
  }

  const maxBend = (phys.maxBendDeg * Math.PI) / 180;
  if (maxBend < Math.PI - 1e-3 && N >= 3) {
    const minCosForClamp = -Math.cos(maxBend);
    for (let i = N - 2; i >= 1; i--) {
      const tip = next[i + 1], mid = next[i], head = next[i - 1];
      const ax = tip.x - mid.x, ay = tip.y - mid.y;
      const bx = head.x - mid.x, by = head.y - mid.y;
      const aLen = Math.hypot(ax, ay);
      const bLen = Math.hypot(bx, by);
      if (aLen < 1e-6 || bLen < 1e-6) continue;
      const adx = ax / aLen, ady = ay / aLen;
      const bdx = bx / bLen, bdy = by / bLen;
      const cosAng = adx * bdx + ady * bdy;
      if (cosAng > minCosForClamp) {
        const curAng = Math.atan2(adx * bdy - ady * bdx, adx * bdx + ady * bdy);
        const sgn = curAng >= 0 ? 1 : -1;
        const targetAng = (Math.PI - maxBend) * sgn;
        const newAng = curAng + (targetAng - curAng) * speed;
        const c = Math.cos(newAng), s = Math.sin(newAng);
        const newBdx = adx * c - ady * s;
        const newBdy = adx * s + ady * c;
        next[i - 1] = { x: mid.x + newBdx * bLen, y: mid.y + newBdy * bLen };
      }
    }
    for (let i = N - 2; i >= 0; i--) {
      const dx = next[i + 1].x - next[i].x;
      const dy = next[i + 1].y - next[i].y;
      const d = Math.hypot(dx, dy);
      if (d > linkLen && d > 1e-6) {
        const inv = ((d - linkLen) * speed) / d;
        next[i] = { x: next[i].x + dx * inv, y: next[i].y + dy * inv };
      }
    }
  }
  body = next;
}

function stepWhisker(chain, side) {
  const N = chain.length;
  if (N < 2) return;
  const a = whiskerAnchor(side);
  const segLen = (phys.whiskerLen * phys.headSize) / (N - 1);
  const damping = Math.max(0, Math.min(0.999, phys.whiskerDamping));

  // anchor teleport guard — solver diverges from a wildly stretched start.
  const ax = a.x - chain[0].x, ay = a.y - chain[0].y;
  if (Math.hypot(ax, ay) > phys.whiskerLen * phys.headSize * 0.5) {
    const fresh = makeWhisker(side);
    for (let i = 0; i < N && i < fresh.length; i++) {
      chain[i].x = fresh[i].x; chain[i].y = fresh[i].y;
      chain[i].px = fresh[i].x; chain[i].py = fresh[i].y;
    }
    return;
  }

  for (let i = 1; i < N; i++) {
    const p = chain[i];
    const vx = (p.x - p.px) * damping;
    const vy = (p.y - p.py) * damping;
    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy;
  }
  chain[0].x = a.x; chain[0].y = a.y;
  chain[0].px = a.x; chain[0].py = a.y;

  const ITERS = 6;
  const ROOT_FAN = (145 * Math.PI) / 180;
  const ROOT_TOL = (5   * Math.PI) / 180;
  const TIP_TOL  = (45  * Math.PI) / 180;
  const lastSeg = N - 2;
  const hd = a.dir;

  for (let it = 0; it < ITERS; it++) {
    for (let i = 1; i < N; i++) {
      const a0 = chain[i - 1], b0 = chain[i];
      const dx = b0.x - a0.x, dy = b0.y - a0.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1e-6) continue;
      const diff = (dist - segLen) / dist;
      if (i === 1) { b0.x -= dx * diff; b0.y -= dy * diff; }
      else {
        const half = diff * 0.5;
        a0.x += dx * half; a0.y += dy * half;
        b0.x -= dx * half; b0.y -= dy * half;
      }
    }
    for (let k = 0; k <= lastSeg; k++) {
      const bx = chain[k + 1].x - chain[k].x;
      const by = chain[k + 1].y - chain[k].y;
      const bLen = Math.hypot(bx, by);
      if (bLen < 1e-6) continue;
      let pdx, pdy, center, tol;
      if (k === 0) {
        pdx = hd.x; pdy = hd.y;
        center = ROOT_FAN * side;
        tol = ROOT_TOL;
      } else {
        const ax2 = chain[k].x - chain[k - 1].x;
        const ay2 = chain[k].y - chain[k - 1].y;
        const aLen = Math.hypot(ax2, ay2);
        if (aLen < 1e-6) continue;
        pdx = ax2 / aLen; pdy = ay2 / aLen;
        center = 0;
        const t = lastSeg > 1 ? (k - 1) / (lastSeg - 1) : 1.0;
        tol = ROOT_TOL + (TIP_TOL - ROOT_TOL) * t;
      }
      const bdx = bx / bLen, bdy = by / bLen;
      const cross = pdx * bdy - pdy * bdx;
      const dot   = pdx * bdx + pdy * bdy;
      const ang   = Math.atan2(cross, dot);
      let target = ang;
      if (ang > center + tol) target = center + tol;
      else if (ang < center - tol) target = center - tol;
      if (target !== ang) {
        const c = Math.cos(target), s = Math.sin(target);
        const ndx = pdx * c - pdy * s;
        const ndy = pdx * s + pdy * c;
        chain[k + 1].x = chain[k].x + ndx * bLen;
        chain[k + 1].y = chain[k].y + ndy * bLen;
      }
    }
  }
}

// One physics tick: body chain pull + both whisker verlets + push results to
// scene uniforms. Call once per rAF before render().
export function step() {
  stepBody();
  stepWhisker(whiskerL, +1);
  stepWhisker(whiskerR, -1);
  if (body.length >= 2) {
    setControlPoints(body);
    const f = headFrame();
    setHead(f.pos, f.dir);
  }
  if (whiskerL.length >= 2) setWhisker(0, whiskerL);
  if (whiskerR.length >= 2) setWhisker(1, whiskerR);
}

// Snapshot for SVG overlay. Plain {x,y} copies so the consumer can assign to
// $state without leaking internal references.
export function getOverlay() {
  return {
    body: body.map(p => ({ x: p.x, y: p.y })),
    whiskerL: whiskerL.map(p => ({ x: p.x, y: p.y })),
    whiskerR: whiskerR.map(p => ({ x: p.x, y: p.y })),
  };
}
