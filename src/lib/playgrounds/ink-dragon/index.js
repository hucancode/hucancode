import { createDevice, mat4, planeGeometry } from "$lib/engine/index.js";
import BASIC_VERT from "./shaders/basic.vert.glsl?raw";
import POLYLINE_VERT from "./shaders/stroke-polyline.vert.glsl?raw";
import STROKE_FRAG from "./shaders/stroke.frag.glsl?raw";
import PAPER_FRAG from "./shaders/paper-background.frag.glsl?raw";
import WATERDROP_FRAGMENT_SHADER from "./shaders/waterdrop.frag.glsl?raw";
import DRAGON_HEAD_FRAGMENT_SHADER from "./shaders/dragon-head.frag.glsl?raw";
import PAPER_WGSL from "./shaders/paper.wgsl?raw";
import STROKE_WGSL from "./shaders/stroke.wgsl?raw";
import WATERDROP_WGSL from "./shaders/waterdrop.wgsl?raw";
import HEAD_WGSL from "./shaders/dragon-head.wgsl?raw";
import {
  makePolylineStroke,
  updatePolylineStroke,
  setStrokeLineWidth,
} from "./stroke-mesh.js";

const PAPER_COLOR = [1.0, 1.0, 0.875, 1.0];

const BODY_MAX_POINTS = 64;
const WHISKER_MAX_POINTS = 80;
const WHISKER_SAMPLES_PER_SEGMENT = 4;

const HEAD_PLANE_W = 2.4;
const HEAD_PLANE_H = 1.6;

const brushColor = [0.05, 0.05, 0.05, 0.95];

const F32 = (name) => ({ name, type: "f32" });
const VEC4 = (name) => ({ name, type: "vec4" });
const MAT4 = (name) => ({ name, type: "mat4" });

const BUF_POS = { stride: 12, step: "vertex", attributes: [{ name: "position", location: 0, format: "float32x3", offset: 0 }] };
const BUF_UV = { stride: 8, step: "vertex", attributes: [{ name: "uv", location: 1, format: "float32x2", offset: 0 }] };
const BUF_STROKE_POS = { stride: 12, step: "vertex", attributes: [{ name: "position", location: 0, format: "float32x3", offset: 0 }] };
const BUF_STROKE_UV = { stride: 8, step: "vertex", attributes: [{ name: "aLineUV", location: 1, format: "float32x2", offset: 0 }] };

let canvas, device, disposed = false;
let pPaper, pBody, pBodyWire, pWhisker, pHead;
let quadPosBuf, quadUVBuf, headPosBuf, headUVBuf;
let bodyPosBuf, bodyUVBuf, bodyIdxBuf, bodyIdxCount = 0;
let bodyStroke = null;
let whiskerStrokes = [null, null];
let aspect = 1;
let bodyWireframe = false;

const IDENTITY = mat4.identity(mat4.create());
const headMatrix = mat4.identity(mat4.create());
const headTRS = mat4.create();
const headAspectInv = mat4.create();
const headPos = { x: 0, y: 0, z: 0 };
const headEuler = { x: 0, y: 0, z: 0 };
const headScale = { x: 1, y: 1, z: 1 };
const headState = {
  pos: { x: 0, y: 0 },
  dir: { x: 1, y: 0 },
  size: 0.25,
};
let headVisible = true;

function makeWhiskerStroke({ maxPoints, params }) {
  const data = new Float32Array(maxPoints * 4);
  const tex = device.texture({ width: maxPoints, height: 1, format: "rgba32f", filter: "nearest", data });
  return {
    tex, data, maxPoints,
    lastPts: null,
    bgColor: params.bgColor,
    params: {
      curveLen: 0,
      curveTotalLen: 1,
      curveTexWidth: maxPoints,
      uOffset: 0.0,
      uArcLength: 1.0,
      uLineWidth: params.width,
      uInkFlow: params.inkFlow,
      uOpacity: params.opacity,
      uWidthEnd: params.widthEnd,
      uWidthOffset: params.widthOffset,
      uWidthRange: params.widthRange,
    },
  };
}

// cubic-bezier control points per segment from neighbor tangents
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

function smoothChain(controlPoints, perSegment, maxPoints) {
  if (controlPoints.length < 2) return [];
  if (perSegment <= 1) {
    return controlPoints.slice(0, Math.min(controlPoints.length, maxPoints));
  }
  const segs = buildBezierSegments(controlPoints);
  const perSeg = Math.max(1, Math.min(perSegment, Math.floor((maxPoints - 1) / segs.length)));
  const totalSamples = Math.min(segs.length * perSeg + 1, maxPoints);
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
  pts.length = idx;
  return pts;
}

function writeWhisker(stroke, controlPoints, perSegment) {
  const { data, tex, params, maxPoints } = stroke;
  const pts = smoothChain(controlPoints, perSegment, maxPoints);
  if (pts.length < 2) {
    params.curveLen = 0;
    params.curveTotalLen = 1;
    stroke.lastPts = null;
    return;
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
  tex.write(data, maxPoints, 1);
  params.curveLen = pts.length;
  params.curveTotalLen = Math.max(acc, 1e-6);
  stroke.lastPts = pts;
}

function updateHeadTransform() {
  const theta = Math.atan2(headState.dir.y, headState.dir.x);
  headPos.x = headState.pos.x;
  headPos.y = headState.pos.y;
  headEuler.z = theta;
  headScale.x = headState.size;
  headScale.y = headState.size;
  mat4.compose(headTRS, headPos, headEuler, headScale);
  mat4.identity(headAspectInv);
  headAspectInv[0] = 1 / aspect;
  mat4.multiply(headMatrix, headAspectInv, headTRS);
}

function quadBuffer(geom, name) {
  return device.buffer({ kind: "vertex", data: geom.attributes[name].array });
}

export async function init(canvasEl) {
  canvas = canvasEl;
  disposed = false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  device = await createDevice(canvas);
  if (disposed) { device.destroy(); device = null; return; }
  device.resize(canvas.width, canvas.height);
  aspect = canvas.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1;

  pPaper = device.shader({
    glsl: { vertex: BASIC_VERT, fragment: PAPER_FRAG }, wgsl: PAPER_WGSL,
    buffers: [BUF_POS, BUF_UV],
    uniforms: [MAT4("uModel"), F32("uAspect"), VEC4("uBgColor")],
    blend: "none", topology: "tri", target: "screen", sampleCount: 4,
  });
  const strokeUniforms = [
    F32("uAspect"), F32("uInkFlow"), F32("uStrands"), F32("uWaterFlow"), F32("uOpacity"),
    F32("uWobble"), F32("uWidthEnd"), F32("uWidthOffset"), F32("uWidthRange"), F32("uWidthAnchor"),
    F32("uPerpClearance"), F32("uArcClearance"), VEC4("uBrushColor"),
  ];
  pBody = device.shader({
    glsl: { vertex: POLYLINE_VERT, fragment: STROKE_FRAG }, wgsl: STROKE_WGSL,
    buffers: [BUF_STROKE_POS, BUF_STROKE_UV],
    uniforms: strokeUniforms,
    blend: "straight", topology: "tri", target: "screen", sampleCount: 4,
  });
  pBodyWire = device.shader({
    glsl: { vertex: POLYLINE_VERT, fragment: STROKE_FRAG }, wgsl: STROKE_WGSL,
    buffers: [BUF_STROKE_POS, BUF_STROKE_UV],
    uniforms: strokeUniforms,
    blend: "straight", topology: "line-strip", target: "screen", sampleCount: 4,
  });
  pWhisker = device.shader({
    glsl: { vertex: BASIC_VERT, fragment: WATERDROP_FRAGMENT_SHADER }, wgsl: WATERDROP_WGSL,
    buffers: [BUF_POS, BUF_UV],
    uniforms: [
      MAT4("uModel"), F32("uAspect"), F32("curveLen"), F32("curveTotalLen"), F32("curveTexWidth"),
      F32("uOffset"), F32("uArcLength"), F32("uLineWidth"), F32("uInkFlow"), F32("uOpacity"),
      F32("uWidthEnd"), F32("uWidthOffset"), F32("uWidthRange"), VEC4("uBrushColor"), VEC4("uBgColor"),
    ],
    textures: [{ name: "curveTex", binding: 1 }],
    blend: "straight", topology: "tri", target: "screen", sampleCount: 4,
  });
  pHead = device.shader({
    glsl: { vertex: BASIC_VERT, fragment: DRAGON_HEAD_FRAGMENT_SHADER }, wgsl: HEAD_WGSL,
    buffers: [BUF_POS, BUF_UV],
    uniforms: [MAT4("uModel"), VEC4("uBrushColor")],
    blend: "straight", topology: "tri", target: "screen", sampleCount: 4,
  });

  const paperQuad = planeGeometry(2, 2);
  const headQuad = planeGeometry(HEAD_PLANE_W, HEAD_PLANE_H);
  quadPosBuf = quadBuffer(paperQuad, "position");
  quadUVBuf = quadBuffer(paperQuad, "uv");
  headPosBuf = quadBuffer(headQuad, "position");
  headUVBuf = quadBuffer(headQuad, "uv");

  bodyStroke = makePolylineStroke({
    maxPoints: BODY_MAX_POINTS,
    params: {
      lineWidth: 0.12,
      widthEnd: 0.1, widthOffset: 0.5, widthRange: 1.0,
      inkFlow: 1.0, strands: 1.0, waterFlow: 0.5, wobble: 0.3,
      opacity: 1.0,
      widthAnchor: 0.5,
    },
    brushColor,
  });
  bodyPosBuf = device.buffer({ kind: "vertex", size: 0, dynamic: true });
  bodyUVBuf = device.buffer({ kind: "vertex", size: 0, dynamic: true });
  bodyIdxBuf = device.buffer({ kind: "index", size: 0, dynamic: true });
  bodyIdxBuf.write(bodyStroke.geom.index.array);

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
  }

  updateHeadTransform();
}

export function resize(w, h) {
  if (!device) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.max(1, Math.floor(w * dpr)), ch = Math.max(1, Math.floor(h * dpr));
  canvas.width = cw; canvas.height = ch;
  device.resize(cw, ch);
  aspect = h > 0 ? w / h : 1;
  updateHeadTransform();
}

export function render() {
  if (!device) return;

  device.beginFrame();
  device.pass({ target: "screen", clear: [PAPER_COLOR[0], PAPER_COLOR[1], PAPER_COLOR[2], 1.0] }, (p) => {
    p.draw(pPaper, { buffers: [quadPosBuf, quadUVBuf], count: 6, uniforms: { uModel: IDENTITY, uAspect: aspect, uBgColor: PAPER_COLOR } });

    if (bodyStroke && bodyStroke.n >= 2 && bodyIdxCount > 0) {
      const bp = bodyStroke.params;
      const prog = bodyWireframe ? pBodyWire : pBody;
      p.draw(prog, {
        buffers: [bodyPosBuf, bodyUVBuf], index: bodyIdxBuf, count: bodyIdxCount,
        uniforms: {
          uAspect: aspect, uInkFlow: bp.uInkFlow, uStrands: bp.uStrands, uWaterFlow: bp.uWaterFlow,
          uOpacity: bp.uOpacity, uWobble: bp.uWobble, uWidthEnd: bp.uWidthEnd, uWidthOffset: bp.uWidthOffset,
          uWidthRange: bp.uWidthRange, uWidthAnchor: bp.uWidthAnchor, uPerpClearance: bp.uPerpClearance,
          uArcClearance: bp.uArcClearance, uBrushColor: bodyStroke.brushColor,
        },
      });
    }

    for (const s of whiskerStrokes) {
      if (!s || s.params.curveLen < 2) continue;
      const wp = s.params;
      p.draw(pWhisker, {
        buffers: [quadPosBuf, quadUVBuf], count: 6, textures: { curveTex: s.tex },
        uniforms: {
          uModel: IDENTITY, uAspect: aspect, curveLen: wp.curveLen, curveTotalLen: wp.curveTotalLen,
          curveTexWidth: wp.curveTexWidth, uOffset: wp.uOffset, uArcLength: wp.uArcLength,
          uLineWidth: wp.uLineWidth, uInkFlow: wp.uInkFlow, uOpacity: wp.uOpacity, uWidthEnd: wp.uWidthEnd,
          uWidthOffset: wp.uWidthOffset, uWidthRange: wp.uWidthRange, uBrushColor: brushColor, uBgColor: s.bgColor,
        },
      });
    }

    if (headVisible) {
      p.draw(pHead, { buffers: [headPosBuf, headUVBuf], count: 6, uniforms: { uModel: headMatrix, uBrushColor: brushColor } });
    }
  });
  device.endFrame();
}

export function setWidth(v) {
  if (bodyStroke) setStrokeLineWidth(bodyStroke, v);
}
export function setWireframe(on) {
  bodyWireframe = !!on;
}
export function setInkFlow(v)   { if (bodyStroke) bodyStroke.params.uInkFlow = v; }
export function setStrands(v)   { if (bodyStroke) bodyStroke.params.uStrands = v; }
export function setWaterFlow(v) { if (bodyStroke) bodyStroke.params.uWaterFlow = v; }
export function setWobble(v)    { if (bodyStroke) bodyStroke.params.uWobble = v; }
export function setWidthEnd(v)    { if (bodyStroke) bodyStroke.params.uWidthEnd = v; }
export function setWidthOffset(v) { if (bodyStroke) bodyStroke.params.uWidthOffset = v; }
export function setWidthRange(v)  { if (bodyStroke) bodyStroke.params.uWidthRange = v; }

export function setControlPoints(points) {
  if (!bodyStroke) return;
  updatePolylineStroke(bodyStroke, points);
  if (bodyStroke.n >= 2 && device) {
    bodyPosBuf.write(bodyStroke.positions);
    bodyUVBuf.write(bodyStroke.lineUVs);
    bodyIdxCount = bodyStroke.geom.drawRange ? bodyStroke.geom.drawRange.count : 0;
  } else {
    bodyIdxCount = 0;
  }
}

export function setWhisker(slot, points) {
  const s = whiskerStrokes[slot];
  if (!s) return;
  // caller passes anchor -> free-tip. stroke convention: arc=0 = thick end.
  // reverse so anchor (at dragon head) sits at arc=0 -> renders thick
  writeWhisker(s, points.slice().reverse(), WHISKER_SAMPLES_PER_SEGMENT);
}

export function setWhiskerWidth(v) {
  for (const s of whiskerStrokes) {
    if (!s) continue;
    s.params.uLineWidth = v;
  }
}

export function setHead(pos, dir, size, show) {
  if (pos) { headState.pos.x = pos.x; headState.pos.y = pos.y; }
  if (dir) { headState.dir.x = dir.x; headState.dir.y = dir.y; }
  if (typeof size === "number") headState.size = size;
  if (typeof show === "boolean") headVisible = show;
  updateHeadTransform();
}

export function destroy() {
  disposed = true;
  quadPosBuf?.destroy(); quadUVBuf?.destroy(); headPosBuf?.destroy(); headUVBuf?.destroy();
  bodyPosBuf?.destroy(); bodyUVBuf?.destroy(); bodyIdxBuf?.destroy();
  for (const s of whiskerStrokes) s?.tex?.destroy();
  quadPosBuf = quadUVBuf = headPosBuf = headUVBuf = null;
  bodyPosBuf = bodyUVBuf = bodyIdxBuf = null;
  pPaper = pBody = pBodyWire = pWhisker = pHead = null;
  bodyStroke = null;
  whiskerStrokes = [null, null];
  if (device) { device.destroy(); device = null; }
}

export function screenToWorld(x, y, w, h) {
  const a = w / h;
  const u = x / w;
  const v = 1.0 - y / h;
  return { x: (u * 2 - 1) * a, y: v * 2 - 1 };
}

export function eventToWorld(canvasEl, e) {
  if (!canvasEl) return { x: 0, y: 0 };
  const r = canvasEl.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return { x: 0, y: 0 };
  const x = Math.max(0, Math.min(r.width,  e.clientX - r.left));
  const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
  return screenToWorld(x, y, r.width, r.height);
}

export function worldToScreen(p, w, h) {
  const a = w / h;
  const u = (p.x / a + 1) * 0.5;
  const v = (p.y + 1) * 0.5;
  return { x: u * w, y: (1 - v) * h };
}

const WHISKER_ANCHOR_X = 0.5;
const WHISKER_ANCHOR_Y = 0.08;

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

let body = [];
let whiskerL = [], whiskerR = [];
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

export function getOverlay() {
  return {
    body: body.map(p => ({ x: p.x, y: p.y })),
    whiskerL: whiskerL.map(p => ({ x: p.x, y: p.y })),
    whiskerR: whiskerR.map(p => ({ x: p.x, y: p.y })),
  };
}
