import { createPlayground, mat4, planeGeometry, F32, VEC4, MAT4 } from "$lib/engine/index.js";
import { catmullOpen } from "$lib/math/curve.js";
import { clamp, smooth } from "$lib/math/scalar.js";
import BASIC_VERT from "./shaders/basic.vert.glsl?raw";
import POLYLINE_VERT from "./shaders/stroke-polyline.vert.glsl?raw";
import STROKE_FRAG from "./shaders/stroke.frag.glsl?raw";
import PAPER_FRAG from "./shaders/paper-background.frag.glsl?raw";
import DRAGON_HEAD_FRAGMENT_SHADER from "./shaders/dragon-head.frag.glsl?raw";
import WHISKER_VERT from "./shaders/whisker.vert.glsl?raw";
import WHISKER_FRAG from "./shaders/whisker.frag.glsl?raw";
import PAPER_WGSL from "./shaders/paper.wgsl?raw";
import STROKE_WGSL from "./shaders/stroke.wgsl?raw";
import WHISKER_WGSL from "./shaders/whisker.wgsl?raw";
import HEAD_WGSL from "./shaders/dragon-head.wgsl?raw";
import {
  makePolylineStroke,
  updatePolylineStroke,
  setStrokeLineWidth,
} from "./stroke-mesh.js";

const PAPER_COLOR = [1.0, 1.0, 0.875, 1.0];

const BODY_MAX_POINTS = 64;
const BODY_TAPER_SPAN = 0.7;
const WHISKER_MAX_POINTS = 80;
const WHISKER_SAMPLES_PER_SEGMENT = 4;
const WHISKER_TAPER = { end: 0.0, offset: 0.4, range: 0.8 };

const HEAD_PLANE_W = 2.4;
const HEAD_PLANE_H = 1.6;

const brushColor = [0.05, 0.05, 0.05, 0.95];

const BUF_POS = { stride: 12, step: "vertex", attributes: [{ name: "position", location: 0, format: "float32x3", offset: 0 }] };
const BUF_UV = { stride: 8, step: "vertex", attributes: [{ name: "uv", location: 1, format: "float32x2", offset: 0 }] };
const BUF_STROKE_UV = { stride: 8, step: "vertex", attributes: [{ name: "aLineUV", location: 1, format: "float32x2", offset: 0 }] };

let canvas = null, device = null;
let pPaper, pBody, pWhisker, pHead;
let quadPosBuf, quadUVBuf, headPosBuf, headUVBuf;
// body + whiskers share the same ribbon record shape:
// { stroke, posBuf, uvBuf?, idxBuf, idxCount }. Whiskers are ribbon strokes
// like the body (thin clean line: 1 strand, no wobble/water).
let bodyRibbon = null;
let whiskers = [null, null];
let aspect = 1;

const IDENTITY = mat4.identity(mat4.create());
const headMatrix = mat4.identity(mat4.create());
const headTRS = mat4.create();
const headAspectInv = mat4.create();
const camMatrix = mat4.create();

// camera: world -> view is (w - pan) * zoom, applied CPU-side (meshes re-upload
// every step, head via its matrix), so shaders stay camera-free.
const view = { zoom: 1, panX: 0, panY: 0 };

export function setView(v) {
  if (typeof v.zoom === "number") view.zoom = v.zoom;
  if (typeof v.panX === "number") view.panX = v.panX;
  if (typeof v.panY === "number") view.panY = v.panY;
  updateHeadTransform();
}
const headPos = { x: 0, y: 0, z: 0 };
const headEuler = { x: 0, y: 0, z: 0 };
const headScale = { x: 1, y: 1, z: 1 };
const headState = {
  pos: { x: 0, y: 0 },
  dir: { x: 1, y: 0 },
  size: 0.25,
};
let headVisible = true;

// smooth control polyline with an open Catmull-Rom spline (endpoints clamped);
// identical curve to the old per-segment cubic-bezier (handles p+(next-prev)/6
// ARE the Catmull-Rom -> Bezier conversion). Sample distribution preserved:
// perSeg samples per control segment at t = k/perSeg, final endpoint appended.
function smoothChain(controlPoints, perSegment, maxPoints) {
  if (controlPoints.length < 2) return [];
  if (perSegment <= 1) {
    return controlPoints.slice(0, Math.min(controlPoints.length, maxPoints));
  }
  const nSeg = controlPoints.length - 1;
  const perSeg = Math.max(1, Math.min(perSegment, Math.floor((maxPoints - 1) / nSeg)));
  const totalSamples = Math.min(nSeg * perSeg + 1, maxPoints);
  const pts = new Array(totalSamples);
  let idx = 0;
  for (let s = 0; s < nSeg && idx < totalSamples; s++) {
    for (let k = 0; k < perSeg && idx < totalSamples; k++) {
      const p = catmullOpen(controlPoints, s + k / perSeg);
      pts[idx++] = { x: p.x, y: p.y };
    }
  }
  if (idx < totalSamples) {
    const last = controlPoints[controlPoints.length - 1];
    pts[idx++] = { x: last.x, y: last.y };
  }
  pts.length = idx;
  return pts;
}

// head/whisker positions bake in the current aspect, so refresh it from the
// live canvas size before each use (physics step and frame).
function syncAspect() {
  if (!canvas) return;
  const a = canvas.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1;
  if (a !== aspect) {
    aspect = a;
    updateHeadTransform();
  }
}

// ribbon record { stroke, posBuf, uvBuf?, idxBuf, idxCount } with its GPU
// buffers; the (static) quad index table is uploaded once here.
function makeRibbon(strokeOpts, { withUV = false } = {}) {
  const stroke = makePolylineStroke(strokeOpts);
  const r = {
    stroke,
    posBuf: device.buffer({ kind: "vertex", size: 0, dynamic: true }),
    uvBuf: withUV ? device.buffer({ kind: "vertex", size: 0, dynamic: true }) : null,
    idxBuf: device.buffer({ kind: "index", size: 0, dynamic: true }),
    idxCount: 0,
  };
  r.idxBuf.write(stroke.geom.index.array);
  return r;
}

// re-mesh a ribbon and upload to its GPU buffers. bakeAspect divides x by
// aspect (the whisker vertex shader is a pure passthrough); the body shader
// applies aspect itself but needs the line UVs.
function uploadRibbon(r, points, { bakeAspect = false } = {}) {
  updatePolylineStroke(r.stroke, points);
  if (r.stroke.n >= 2) {
    // camera applied post-meshing so stroke width scales with zoom
    const pos = r.stroke.positions;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = (pos[i] - view.panX) * view.zoom;
      pos[i + 1] = (pos[i + 1] - view.panY) * view.zoom;
      if (bakeAspect) pos[i] /= aspect;
    }
    r.posBuf.write(pos);
    if (r.uvBuf) r.uvBuf.write(r.stroke.lineUVs);
    r.idxCount = r.stroke.geom.drawRange ? r.stroke.geom.drawRange.count : 0;
  } else {
    r.idxCount = 0;
  }
}

function updateHeadTransform() {
  const theta = Math.atan2(headState.dir.y, headState.dir.x);
  headPos.x = headState.pos.x;
  headPos.y = headState.pos.y;
  headEuler.z = theta;
  headScale.x = headState.size;
  headScale.y = headState.size;
  mat4.compose(headTRS, headPos, headEuler, headScale);
  mat4.identity(camMatrix);
  camMatrix[0] = view.zoom;
  camMatrix[5] = view.zoom;
  camMatrix[12] = -view.panX * view.zoom;
  camMatrix[13] = -view.panY * view.zoom;
  mat4.identity(headAspectInv);
  headAspectInv[0] = 1 / aspect;
  mat4.multiply(headMatrix, camMatrix, headTRS);
  mat4.multiply(headMatrix, headAspectInv, headMatrix);
}

function quadBuffer(geom, name) {
  return device.buffer({ kind: "vertex", data: geom.attributes[name].array });
}

function setup(ctx) {
  canvas = ctx.canvas;
  device = ctx.device;
  aspect = canvas.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1;

  pPaper = device.shader({
    glsl: { vertex: BASIC_VERT, fragment: PAPER_FRAG }, wgsl: PAPER_WGSL,
    buffers: [BUF_POS, BUF_UV],
    uniforms: [MAT4("uModel"), F32("uAspect"), VEC4("uBgColor")],
    blend: "none", topology: "tri", target: "screen", sampleCount: 4,
  });
  const strokeUniforms = [F32("uAspect"), VEC4("uBrushColor")];
  const strokeGlsl = { vertex: POLYLINE_VERT, fragment: STROKE_FRAG };
  const strokeWgsl = STROKE_WGSL;
  pBody = device.shader({
    glsl: strokeGlsl, wgsl: strokeWgsl,
    buffers: [BUF_POS, BUF_STROKE_UV],
    uniforms: strokeUniforms,
    blend: "straight", topology: "tri", target: "screen", sampleCount: 4,
  });
  pWhisker = device.shader({
    glsl: { vertex: WHISKER_VERT, fragment: WHISKER_FRAG }, wgsl: WHISKER_WGSL,
    buffers: [BUF_POS],
    uniforms: [VEC4("uBrushColor")],
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

  bodyRibbon = makeRibbon({
    maxPoints: BODY_MAX_POINTS,
    lineWidth: 0.12,
    brushColor,
    // taper in the mesh: widthEnd fraction at the tail (arcT = 0), growing to
    // full width over BODY_TAPER_SPAN of the arc toward the head
    widthAt: (t, s) => s.lineWidth * (s.widthEnd + (1 - s.widthEnd) * smooth(clamp(t / BODY_TAPER_SPAN, 0, 1))),
  }, { withUV: true });
  bodyRibbon.stroke.widthEnd = 0.1;

  for (let i = 0; i < 2; i++) {
    whiskers[i] = makeRibbon({
      maxPoints: WHISKER_MAX_POINTS,
      lineWidth: 0.01,
      brushColor,
      // taper baked into the mesh: full width at the anchor (arcT = 1, points
      // reversed in setWhisker), tapering to zero at the free tip (arcT = 0)
      widthAt: (t, s) => {
        const relArc = 1 - t;
        const curve = smooth(clamp((relArc - WHISKER_TAPER.offset + WHISKER_TAPER.range * 0.5) / WHISKER_TAPER.range, 0, 1));
        return s.lineWidth * (1 - curve * (1 - WHISKER_TAPER.end));
      },
    });
  }

  updateHeadTransform();
}

function frame() {
  syncAspect();

  device.beginFrame();
  device.pass({ target: "screen", clear: [PAPER_COLOR[0], PAPER_COLOR[1], PAPER_COLOR[2], 1.0] }, (p) => {
    p.draw(pPaper, { buffers: [quadPosBuf, quadUVBuf], count: 6, uniforms: { uModel: IDENTITY, uAspect: aspect, uBgColor: PAPER_COLOR } });

    if (bodyRibbon && bodyRibbon.stroke.n >= 2 && bodyRibbon.idxCount > 0) {
      p.draw(pBody, {
        buffers: [bodyRibbon.posBuf, bodyRibbon.uvBuf], index: bodyRibbon.idxBuf, count: bodyRibbon.idxCount,
        uniforms: { uAspect: aspect, uBrushColor: bodyRibbon.stroke.brushColor },
      });
    }

    for (const w of whiskers) {
      if (!w || w.stroke.n < 2 || w.idxCount <= 0) continue;
      p.draw(pWhisker, {
        buffers: [w.posBuf], index: w.idxBuf, count: w.idxCount,
        uniforms: { uBrushColor: w.stroke.brushColor },
      });
    }

    if (headVisible) {
      p.draw(pHead, { buffers: [headPosBuf, headUVBuf], count: 6, uniforms: { uModel: headMatrix, uBrushColor: brushColor } });
    }
  });
  device.endFrame();
}

const PARAM_APPLY = {
  width:     (v) => { if (bodyRibbon && bodyRibbon.stroke.lineWidth !== v) setStrokeLineWidth(bodyRibbon.stroke, v); },
  widthEnd:  (v) => { if (bodyRibbon && bodyRibbon.stroke.widthEnd !== v) { bodyRibbon.stroke.widthEnd = v; setStrokeLineWidth(bodyRibbon.stroke, bodyRibbon.stroke.lineWidth); } },
  // re-meshed (and aspect-baked) on the next setWhisker
  whiskerWidth: (v) => { for (const w of whiskers) if (w) w.stroke.lineWidth = v; },
};

export function setParams(patch) {
  for (const k in patch) PARAM_APPLY[k]?.(patch[k]);
}

export function setControlPoints(points) {
  if (!bodyRibbon || !device) return;
  uploadRibbon(bodyRibbon, points);
}

export function setWhisker(slot, points) {
  const w = whiskers[slot];
  if (!w || !device) return;
  // caller passes anchor -> free-tip. stroke convention: arc=0 = thick end.
  // reverse so anchor (at dragon head) sits at arc=0 -> renders thick.
  // whisker vertex shader is a pure passthrough, so bake the aspect divide in.
  const pts = smoothChain(points.slice().reverse(), WHISKER_SAMPLES_PER_SEGMENT, w.stroke.maxPoints);
  uploadRibbon(w, pts, { bakeAspect: true });
}

export function setHead(pos, dir, size, show) {
  if (pos) { headState.pos.x = pos.x; headState.pos.y = pos.y; }
  if (dir) { headState.dir.x = dir.x; headState.dir.y = dir.y; }
  if (typeof size === "number") headState.size = size;
  if (typeof show === "boolean") headVisible = show;
  updateHeadTransform();
}

function teardown() {
  quadPosBuf?.destroy(); quadUVBuf?.destroy(); headPosBuf?.destroy(); headUVBuf?.destroy();
  for (const r of [bodyRibbon, ...whiskers]) {
    if (!r) continue;
    r.posBuf?.destroy(); r.uvBuf?.destroy(); r.idxBuf?.destroy();
  }
  quadPosBuf = quadUVBuf = headPosBuf = headUVBuf = null;
  pPaper = pBody = pWhisker = pHead = null;
  bodyRibbon = null;
  whiskers = [null, null];
  canvas = null;
  device = null;
}

export const { init, render, destroy } = createPlayground({ init: setup, frame, destroy: teardown });

function screenToWorld(x, y, w, h) {
  const a = w / h;
  const u = x / w;
  const v = 1.0 - y / h;
  return {
    x: ((u * 2 - 1) * a) / view.zoom + view.panX,
    y: (v * 2 - 1) / view.zoom + view.panY,
  };
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
  const vx = (p.x - view.panX) * view.zoom;
  const vy = (p.y - view.panY) * view.zoom;
  const u = (vx / a + 1) * 0.5;
  const v = (vy + 1) * 0.5;
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
  syncAspect(); // whisker/head writes below bake in the aspect
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
