// Ribbon geometry for ink strokes - raw-WebGL2 port of the geometry math in
// scenes/stroke-polyline-mesh.js. Pure math: given a polyline + line width it
// returns interleaved-free typed arrays (positions xy, lineUV) + indices the
// renderer uploads to dynamic buffers. The clearance margins match the stroke
// fragment shader so ink can bleed past the nominal edge.

const MITER_LIMIT = 4.0;
export const PERP_CLEARANCE = 0.35;
export const ARC_CLEARANCE = 0.15;

function totalArcOf(points, n) {
  let acc = 0;
  for (let i = 1; i < n; i++) acc += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return acc;
}

// Returns { positions: Float32Array(2*V), uvs: Float32Array(2*V),
//           indices: Uint16Array, indexCount } or null if < 2 points.
export function buildRibbon(points, lineWidth) {
  const nPoly = points.length;
  if (nPoly < 2) return null;

  const totalPolyArc = totalArcOf(points, nPoly);
  const extLen = (ARC_CLEARANCE > 0 && ARC_CLEARANCE < 0.5)
    ? (totalPolyArc * ARC_CLEARANCE) / (1 - 2 * ARC_CLEARANCE)
    : 0;

  const t0x = points[1].x - points[0].x, t0y = points[1].y - points[0].y;
  const t0L = Math.hypot(t0x, t0y) || 1;
  const tNx = points[nPoly - 1].x - points[nPoly - 2].x, tNy = points[nPoly - 1].y - points[nPoly - 2].y;
  const tNL = Math.hypot(tNx, tNy) || 1;

  const ribbon = new Array(nPoly + 2);
  ribbon[0] = { x: points[0].x - (t0x / t0L) * extLen, y: points[0].y - (t0y / t0L) * extLen };
  for (let i = 0; i < nPoly; i++) ribbon[i + 1] = points[i];
  ribbon[nPoly + 1] = { x: points[nPoly - 1].x + (tNx / tNL) * extLen, y: points[nPoly - 1].y + (tNy / tNL) * extLen };
  const nRibbon = ribbon.length;

  const halfStrokeW = (lineWidth || 0) * 0.5;
  const halfMeshW = (PERP_CLEARANCE > 0 && PERP_CLEARANCE < 0.5)
    ? halfStrokeW / (1 - 2 * PERP_CLEARANCE)
    : halfStrokeW;

  const positions = new Float32Array(nRibbon * 2 * 2);
  const uvs = new Float32Array(nRibbon * 2 * 2);
  const indices = new Uint16Array((nRibbon - 1) * 6);

  const arcs = new Float32Array(nRibbon);
  for (let i = 1; i < nRibbon; i++) {
    arcs[i] = arcs[i - 1] + Math.hypot(ribbon[i].x - ribbon[i - 1].x, ribbon[i].y - ribbon[i - 1].y);
  }
  const totalArc = Math.max(arcs[nRibbon - 1], 1e-6);

  let prevTx = 0, prevTy = 0;
  for (let i = 0; i < nRibbon; i++) {
    const cur = ribbon[i];
    let fx = 0, fy = 0, fL = 0;
    if (i < nRibbon - 1) { fx = ribbon[i + 1].x - cur.x; fy = ribbon[i + 1].y - cur.y; fL = Math.hypot(fx, fy); }

    let tx, ty;
    if (i === 0) { tx = fL > 1e-9 ? fx / fL : 1; ty = fL > 1e-9 ? fy / fL : 0; }
    else if (i === nRibbon - 1) { tx = prevTx; ty = prevTy; }
    else {
      const ftx = fL > 1e-9 ? fx / fL : prevTx;
      const fty = fL > 1e-9 ? fy / fL : prevTy;
      const sx = prevTx + ftx, sy = prevTy + fty;
      const sL = Math.hypot(sx, sy);
      if (sL > 1e-6) { tx = sx / sL; ty = sy / sL; } else { tx = ftx; ty = fty; }
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

    const o2 = i * 4;
    positions[o2 + 0] = cur.x + offx;
    positions[o2 + 1] = cur.y + offy;
    positions[o2 + 2] = cur.x - offx;
    positions[o2 + 3] = cur.y - offy;

    const arcT = arcs[i] / totalArc;
    uvs[o2 + 0] = 0.0; uvs[o2 + 1] = arcT;
    uvs[o2 + 2] = 1.0; uvs[o2 + 3] = arcT;

    if (i < nRibbon - 1) {
      const v = i * 2, o = i * 6;
      indices[o + 0] = v; indices[o + 1] = v + 1; indices[o + 2] = v + 2;
      indices[o + 3] = v + 2; indices[o + 4] = v + 1; indices[o + 5] = v + 3;
    }
    if (i < nRibbon - 1 && fL > 1e-9) { prevTx = fx / fL; prevTy = fy / fL; }
  }

  return { positions, uvs, indices, indexCount: (nRibbon - 1) * 6 };
}
