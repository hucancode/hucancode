// Simple-shape POC renderer. No shader, no GL.
// For each sample stamp a solid filled circle: radius = baseRadius * pressure.
// No speed-based fade, no jitter.
//
// World coords: x in [-aspect, +aspect], y in [-1, +1]. Origin centred.

import { sampleStroke, strokeDuration, expandStrokes } from "./engine";

// view: { zoom, panX, panY } applied as: pScreen = view( (p - pan) * zoom ).
const IDV = { zoom: 1, panX: 0, panY: 0 };

export function worldToScreen(p, w, h, view = IDV) {
  const aspect = w / h;
  const vx = (p.x - view.panX) * view.zoom;
  const vy = (p.y - view.panY) * view.zoom;
  const u = (vx / aspect + 1) / 2;
  const v = 1 - (vy + 1) / 2;
  return { x: u * w, y: v * h };
}

export function screenToWorld(x, y, w, h, view = IDV) {
  const aspect = w / h;
  const u = x / w;
  const v = 1 - y / h;
  const vx = (u * 2 - 1) * aspect;
  const vy = v * 2 - 1;
  return { x: vx / view.zoom + view.panX, y: vy / view.zoom + view.panY };
}

export function clearCanvas(ctx, w, h, bg = "#fffce0") {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

// brushParams: { baseRadius, color }
//   baseRadius in world units. Each sample = a solid circle of baseRadius·pressure.
export function drawStroke(ctx, w, h, stroke, params) {
  const samples = sampleStroke(stroke, params.sampleDensity || 80, params.timing);
  if (samples.length < 2) return;
  const baseR = (params.baseRadius || 0.04);
  const color = params.color || "#111";
  const view = params.view || IDV;
  // tMax: local stroke time cutoff (s). undefined = draw whole stroke.
  const tMax = params.tMax;
  const aspect = w / h;
  const worldToPx = (w / (2 * aspect)) * view.zoom;

  ctx.fillStyle = color;
  ctx.globalAlpha = 1;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    // samples are ascending in gTime; stop once past the cutoff.
    if (tMax !== undefined && s.gTime > tMax) break;
    const radiusW = baseR * Math.max(0.05, s.pressure);
    const sp = worldToScreen({ x: s.x, y: s.y }, w, h, view);
    const rPx = Math.max(0.5, radiusW * worldToPx);
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, rPx, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Chinese calligraphy "米" guide grid: square frame + center cross + two
// diagonals. Drawn in world space, centered at origin with given side length.
export function drawMiGrid(ctx, w, h, view, side = 1.6) {
  const half = side / 2;
  const corners = [
    { x: -half, y: -half }, { x:  half, y: -half },
    { x:  half, y:  half }, { x: -half, y:  half },
  ];
  const pts = corners.map(p => worldToScreen(p, w, h, view));
  const top    = worldToScreen({ x:  0, y:  half }, w, h, view);
  const bottom = worldToScreen({ x:  0, y: -half }, w, h, view);
  const left   = worldToScreen({ x: -half, y: 0 }, w, h, view);
  const right  = worldToScreen({ x:  half, y: 0 }, w, h, view);

  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(200, 60, 60, 0.45)";
  // outer square
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.stroke();

  // dashed inner lines
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(200, 60, 60, 0.35)";
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);   ctx.lineTo(right.x, right.y);
  ctx.moveTo(top.x, top.y);     ctx.lineTo(bottom.x, bottom.y);
  ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[2].x, pts[2].y);
  ctx.moveTo(pts[1].x, pts[1].y); ctx.lineTo(pts[3].x, pts[3].y);
  ctx.stroke();
  ctx.restore();
}

// params.playhead: global time (s) for animated draw. Strokes run
//   sequentially in array order. undefined = draw everything (edit view).
export function drawSymbol(ctx, w, h, symbol, params) {
  clearCanvas(ctx, w, h, params.bg);
  if (params.showGrid) drawMiGrid(ctx, w, h, params.view || IDV, params.gridSize || 1.6);
  const strokes = expandStrokes(symbol, params.connect);
  const playhead = params.playhead;
  if (playhead === undefined) {
    for (const stroke of strokes) drawStroke(ctx, w, h, stroke, params);
    return;
  }
  let start = 0;
  for (const stroke of strokes) {
    const dur = strokeDuration(stroke, params.timing);
    const localMax = playhead - start;
    if (localMax > 0) drawStroke(ctx, w, h, stroke, { ...params, tMax: localMax });
    start += dur;
  }
}
