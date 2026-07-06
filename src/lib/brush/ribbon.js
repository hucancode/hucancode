// Shared ribbon geometry builder for ink strokes (polyline -> triangle-strip-style quads).
// Clearance margins MUST match the stroke fragment shaders
// (main/render/webgl/shaders/stroke.frag.glsl, ink-dragon/shaders/stroke.frag.glsl + wgsl twins),
// which receive them as uPerpClearance/uArcClearance uniforms — do not change these values.

export const MITER_LIMIT = 4.0;
export const PERP_CLEARANCE = 0.35; // fraction of mesh perp_t reserved per side
export const ARC_CLEARANCE = 0.15; // fraction of mesh arc_t reserved per end
// two extra ribbon points (one before tail, one after tip) carry arc clearance
export const ARC_EXTRA_POINTS = 2;

export function computeTotalArc(points, n = points.length) {
  let acc = 0;
  for (let i = 1; i < n; i++) {
    acc += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return acc;
}

// standard 6-index quad layout for a ribbon of quadCount quads
export function writeQuadIndices(indices, quadCount) {
  for (let i = 0; i < quadCount; i++) {
    const v = i * 2, o = i * 6;
    indices[o + 0] = v; indices[o + 1] = v + 1; indices[o + 2] = v + 2;
    indices[o + 3] = v + 2; indices[o + 4] = v + 1; indices[o + 5] = v + 3;
  }
}

// persistent scratch reused across builds; each build is consumed synchronously
// (uploaded / copied) before the next one, so sharing between callers is safe
const _ext0 = { x: 0, y: 0 };
const _extN = { x: 0, y: 0 };
let _ribbon = null;
let _arcsScratch = null;

// Core builder. Reads points[0..nPoly-1] and writes ribbon vertex data into
// caller-provided arrays:
//   out.positions — Float32Array, 2 floats per vertex when stride === 2,
//                   3 floats (z = 0) when stride === 3; 2 vertices per ribbon point
//   out.uvs       — Float32Array, 2 floats per vertex (u ∈ {0,1}, v = arc-length t)
//   out.indices   — optional Uint16Array; filled with the 6-index quad layout
//   out.arcs      — optional Float32Array(≥ nPoly + ARC_EXTRA_POINTS) arc-length scratch
//   out.stride    — 2 (default) or 3
//   out.perpClearance / out.arcClearance — optional margin overrides (0 = exact-width
//                   mesh with no bleed margins, for flat shaders with no clearance logic)
//   out.widthAt   — optional (arcT: 0..1) => absolute width; overrides lineWidth per
//                   ribbon point so tapers live in the MESH, not the fragment shader
// Returns { nRibbon, indexCount } or null when nPoly < 2.
export function buildRibbonGeometry(points, nPoly, lineWidth, out) {
  if (nPoly < 2) return null;
  const stride = out.stride ?? 2;
  const perpC = out.perpClearance ?? PERP_CLEARANCE;
  const arcC = out.arcClearance ?? ARC_CLEARANCE;
  const widthAt = out.widthAt || null;
  const nRibbon = nPoly + ARC_EXTRA_POINTS;
  const { positions, uvs, indices } = out;

  // extend ribbon past polyline tail/tip along end tangents so the shader's
  // arc clearance zone has geometry to bleed into
  const totalPolyArc = computeTotalArc(points, nPoly);
  const extLen = (arcC > 0 && arcC < 0.5)
    ? (totalPolyArc * arcC) / (1 - 2 * arcC)
    : 0;

  const t0x = points[1].x - points[0].x, t0y = points[1].y - points[0].y;
  const t0L = Math.hypot(t0x, t0y) || 1;
  const tNx = points[nPoly - 1].x - points[nPoly - 2].x, tNy = points[nPoly - 1].y - points[nPoly - 2].y;
  const tNL = Math.hypot(tNx, tNy) || 1;

  if (!_ribbon || _ribbon.length !== nRibbon) _ribbon = new Array(nRibbon);
  const ribbon = _ribbon;
  _ext0.x = points[0].x - (t0x / t0L) * extLen;
  _ext0.y = points[0].y - (t0y / t0L) * extLen;
  ribbon[0] = _ext0;
  for (let i = 0; i < nPoly; i++) ribbon[i + 1] = points[i];
  _extN.x = points[nPoly - 1].x + (tNx / tNL) * extLen;
  _extN.y = points[nPoly - 1].y + (tNy / tNL) * extLen;
  ribbon[nPoly + 1] = _extN;

  // halfMeshW larger than stroke half-width so perp clearance fits
  const halfStrokeW = (lineWidth || 0) * 0.5;
  const perpScale = (perpC > 0 && perpC < 0.5) ? 1 - 2 * perpC : 1;
  const halfMeshW = halfStrokeW / perpScale;

  let arcs = out.arcs;
  if (!arcs || arcs.length < nRibbon) {
    if (!_arcsScratch || _arcsScratch.length < nRibbon) _arcsScratch = new Float32Array(nRibbon);
    arcs = _arcsScratch;
  }
  arcs[0] = 0;
  for (let i = 1; i < nRibbon; i++) {
    arcs[i] = arcs[i - 1] + Math.hypot(ribbon[i].x - ribbon[i - 1].x, ribbon[i].y - ribbon[i - 1].y);
  }
  const totalArc = Math.max(arcs[nRibbon - 1], 1e-6);

  let prevTx = 0, prevTy = 0;
  for (let i = 0; i < nRibbon; i++) {
    const cur = ribbon[i];
    let fx = 0, fy = 0, fL = 0;
    if (i < nRibbon - 1) { fx = ribbon[i + 1].x - cur.x; fy = ribbon[i + 1].y - cur.y; fL = Math.hypot(fx, fy); }

    // averaged-tangent joint normal
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
    const arcT = arcs[i] / totalArc;
    const halfW = widthAt ? (widthAt(arcT) * 0.5) / perpScale : halfMeshW;
    const offx = nx * halfW * miterScale;
    const offy = ny * halfW * miterScale;

    const op = i * 2 * stride;
    positions[op + 0] = cur.x + offx;
    positions[op + 1] = cur.y + offy;
    positions[op + stride + 0] = cur.x - offx;
    positions[op + stride + 1] = cur.y - offy;
    if (stride === 3) {
      positions[op + 2] = 0;
      positions[op + 5] = 0;
    }

    const o2 = i * 4;
    uvs[o2 + 0] = 0.0; uvs[o2 + 1] = arcT;
    uvs[o2 + 2] = 1.0; uvs[o2 + 3] = arcT;

    if (i < nRibbon - 1 && fL > 1e-9) { prevTx = fx / fL; prevTy = fy / fL; }
  }

  if (indices) writeQuadIndices(indices, nRibbon - 1);

  return { nRibbon, indexCount: (nRibbon - 1) * 6 };
}
