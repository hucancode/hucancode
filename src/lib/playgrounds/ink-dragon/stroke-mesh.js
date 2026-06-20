import { Geometry } from "$lib/engine/index.js";

const MITER_LIMIT     = 4.0;
export const PERP_CLEARANCE = 0.35;  // fraction of mesh perp_t reserved per side
export const ARC_CLEARANCE  = 0.15;  // fraction of mesh arc_t reserved per end
// two extra ribbon points (one before tail, one after tip) carry arc clearance
const ARC_EXTRA_POINTS = 2;

export function makePolylineStroke({ maxPoints, params, brushColor }) {
  const ribbonCap = maxPoints + ARC_EXTRA_POINTS;
  const maxVerts  = ribbonCap * 2;
  const positions = new Float32Array(maxVerts * 3);
  const lineUVs   = new Float32Array(maxVerts * 2);
  const indices   = new Uint16Array((ribbonCap - 1) * 6);

  for (let i = 0; i < ribbonCap - 1; i++) {
    const v = i * 2;
    const o = i * 6;
    indices[o + 0] = v;
    indices[o + 1] = v + 1;
    indices[o + 2] = v + 2;
    indices[o + 3] = v + 2;
    indices[o + 4] = v + 1;
    indices[o + 5] = v + 3;
  }

  const geom = new Geometry();
  geom.dynamic = true;
  geom.setAttribute("position", positions, 3);
  geom.setAttribute("aLineUV", lineUVs, 2);
  geom.setIndex(indices);
  geom.setDrawRange(0, 0);

  return {
    geom, positions, lineUVs,
    maxPoints, ribbonCap, n: 0,
    lineWidth: params.lineWidth,
    lastPts: null,
    brushColor,
    params: {
      uInkFlow:       params.inkFlow,
      uStrands:       params.strands,
      uWaterFlow:     params.waterFlow,
      uOpacity:       params.opacity,
      uWobble:        params.wobble,
      uWidthEnd:      params.widthEnd,
      uWidthOffset:   params.widthOffset,
      uWidthRange:    params.widthRange,
      uWidthAnchor:   params.widthAnchor ?? 0.5,
      uPerpClearance: PERP_CLEARANCE,
      uArcClearance:  ARC_CLEARANCE,
    },
  };
}

export function setStrokeLineWidth(stroke, w) {
  stroke.lineWidth = w;
  if (stroke.lastPts) updatePolylineStroke(stroke, stroke.lastPts);
}

export function updatePolylineStroke(stroke, points) {
  const nPoly = Math.min(points.length, stroke.maxPoints);
  if (nPoly < 2) {
    stroke.geom.setDrawRange(0, 0);
    stroke.n = 0;
    stroke.lastPts = points;
    return;
  }

  // extend ribbon past polyline tail/tip along end tangents so shader's
  // clearance zone has geometry to bleed into
  const totalPolyArc = computeTotalArc(points, nPoly);
  const extLen = (ARC_CLEARANCE > 0 && ARC_CLEARANCE < 0.5)
    ? totalPolyArc * ARC_CLEARANCE / (1 - 2 * ARC_CLEARANCE)
    : 0;

  const t0x = points[1].x - points[0].x;
  const t0y = points[1].y - points[0].y;
  const t0L = Math.hypot(t0x, t0y) || 1;
  const tNx = points[nPoly - 1].x - points[nPoly - 2].x;
  const tNy = points[nPoly - 1].y - points[nPoly - 2].y;
  const tNL = Math.hypot(tNx, tNy) || 1;

  const extStart = {
    x: points[0].x - (t0x / t0L) * extLen,
    y: points[0].y - (t0y / t0L) * extLen,
  };
  const extEnd = {
    x: points[nPoly - 1].x + (tNx / tNL) * extLen,
    y: points[nPoly - 1].y + (tNy / tNL) * extLen,
  };

  const ribbon = new Array(nPoly + 2);
  ribbon[0] = extStart;
  for (let i = 0; i < nPoly; i++) ribbon[i + 1] = points[i];
  ribbon[nPoly + 1] = extEnd;
  const nRibbon = ribbon.length;

  // halfMeshW larger than stroke half-width so perp clearance fits
  const halfStrokeW = (stroke.lineWidth || 0) * 0.5;
  const halfMeshW = (PERP_CLEARANCE > 0 && PERP_CLEARANCE < 0.5)
    ? halfStrokeW / (1 - 2 * PERP_CLEARANCE)
    : halfStrokeW;

  const { positions, lineUVs, geom } = stroke;

  const arcs = new Float32Array(nRibbon);
  for (let i = 1; i < nRibbon; i++) {
    const dx = ribbon[i].x - ribbon[i - 1].x;
    const dy = ribbon[i].y - ribbon[i - 1].y;
    arcs[i] = arcs[i - 1] + Math.hypot(dx, dy);
  }
  const totalArc = Math.max(arcs[nRibbon - 1], 1e-6);

  let prevTx = 0, prevTy = 0;

  for (let i = 0; i < nRibbon; i++) {
    const cur = ribbon[i];

    let fx = 0, fy = 0, fL = 0;
    if (i < nRibbon - 1) {
      fx = ribbon[i + 1].x - cur.x;
      fy = ribbon[i + 1].y - cur.y;
      fL = Math.hypot(fx, fy);
    }

    let tx, ty;
    if (i === 0) {
      tx = fL > 1e-9 ? fx / fL : 1;
      ty = fL > 1e-9 ? fy / fL : 0;
    } else if (i === nRibbon - 1) {
      tx = prevTx; ty = prevTy;
    } else {
      const ftx = fL > 1e-9 ? fx / fL : prevTx;
      const fty = fL > 1e-9 ? fy / fL : prevTy;
      const sx = prevTx + ftx, sy = prevTy + fty;
      const sL = Math.hypot(sx, sy);
      if (sL > 1e-6) { tx = sx / sL; ty = sy / sL; }
      else           { tx = ftx;     ty = fty; }
    }

    const nx = -ty, ny = tx;

    let miterScale = 1;
    if (i > 0 && i < nRibbon - 1) {
      const segNx = -prevTy, segNy = prevTx;
      const cosHalf = nx * segNx + ny * segNy;
      miterScale = 1 / Math.max(Math.abs(cosHalf), 1 / MITER_LIMIT);
    }
    const offx = nx * halfMeshW * miterScale;
    const offy = ny * halfMeshW * miterScale;

    const o3 = i * 6;
    positions[o3 + 0] = cur.x + offx;
    positions[o3 + 1] = cur.y + offy;
    positions[o3 + 2] = 0;
    positions[o3 + 3] = cur.x - offx;
    positions[o3 + 4] = cur.y - offy;
    positions[o3 + 5] = 0;

    const arcT = arcs[i] / totalArc;
    const o2 = i * 4;
    lineUVs[o2 + 0] = 0.0;
    lineUVs[o2 + 1] = arcT;
    lineUVs[o2 + 2] = 1.0;
    lineUVs[o2 + 3] = arcT;

    if (i < nRibbon - 1 && fL > 1e-9) {
      prevTx = fx / fL; prevTy = fy / fL;
    }
  }

  geom.attributes.position.needsUpdate = true;
  geom.attributes.aLineUV.needsUpdate  = true;
  geom.setDrawRange(0, (nRibbon - 1) * 6);
  stroke.n = nPoly;
  stroke.lastPts = points;
}

function computeTotalArc(points, n) {
  let acc = 0;
  for (let i = 1; i < n; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    acc += Math.hypot(dx, dy);
  }
  return acc;
}
