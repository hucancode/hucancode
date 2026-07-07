// Shared ribbon geometry builder for ink strokes (polyline -> triangle-strip-style quads).
// Exact-width meshes: fragment shaders are flat fills, so all width shaping
// lives in the mesh via widthAt.

const MITER_LIMIT = 4.0;

// standard 6-index quad layout for a ribbon of quadCount quads
export function writeQuadIndices(indices, quadCount) {
  for (let i = 0; i < quadCount; i++) {
    const v = i * 2, o = i * 6;
    indices[o + 0] = v; indices[o + 1] = v + 1; indices[o + 2] = v + 2;
    indices[o + 3] = v + 2; indices[o + 4] = v + 1; indices[o + 5] = v + 3;
  }
}

let _arcsScratch = null;

// Core builder. Reads points[0..nPoly-1] and writes ribbon vertex data into
// caller-provided arrays:
//   out.positions — Float32Array, 2 floats per vertex when stride === 2,
//                   3 floats (z = 0) when stride === 3; 2 vertices per ribbon point
//   out.uvs       — Float32Array, 2 floats per vertex (u ∈ {0,1}, v = arc-length t)
//   out.indices   — optional Uint16Array; filled with the 6-index quad layout
//   out.arcs      — optional Float32Array(≥ nPoly) arc-length scratch
//   out.stride    — 2 (default) or 3
//   out.widthAt   — optional (arcT: 0..1) => absolute width; overrides lineWidth per
//                   ribbon point so tapers live in the MESH, not the fragment shader
// Returns { nRibbon, indexCount } or null when nPoly < 2.
export function buildRibbonGeometry(points, nPoly, lineWidth, out) {
  if (nPoly < 2) return null;
  const stride = out.stride ?? 2;
  const widthAt = out.widthAt || null;
  const { positions, uvs, indices } = out;

  const halfW0 = (lineWidth || 0) * 0.5;

  let arcs = out.arcs;
  if (!arcs || arcs.length < nPoly) {
    if (!_arcsScratch || _arcsScratch.length < nPoly) _arcsScratch = new Float32Array(nPoly);
    arcs = _arcsScratch;
  }
  arcs[0] = 0;
  for (let i = 1; i < nPoly; i++) {
    arcs[i] = arcs[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  const totalArc = Math.max(arcs[nPoly - 1], 1e-6);

  let prevTx = 0, prevTy = 0;
  for (let i = 0; i < nPoly; i++) {
    const cur = points[i];
    let fx = 0, fy = 0, fL = 0;
    if (i < nPoly - 1) { fx = points[i + 1].x - cur.x; fy = points[i + 1].y - cur.y; fL = Math.hypot(fx, fy); }

    // averaged-tangent joint normal
    let tx, ty;
    if (i === 0) { tx = fL > 1e-9 ? fx / fL : 1; ty = fL > 1e-9 ? fy / fL : 0; }
    else if (i === nPoly - 1) { tx = prevTx; ty = prevTy; }
    else {
      const ftx = fL > 1e-9 ? fx / fL : prevTx;
      const fty = fL > 1e-9 ? fy / fL : prevTy;
      const sx = prevTx + ftx, sy = prevTy + fty;
      const sL = Math.hypot(sx, sy);
      if (sL > 1e-6) { tx = sx / sL; ty = sy / sL; } else { tx = ftx; ty = fty; }
    }
    const nx = -ty, ny = tx;

    let miterScale = 1;
    if (i > 0 && i < nPoly - 1) {
      const segNx = -prevTy, segNy = prevTx;
      const cosHalf = nx * segNx + ny * segNy;
      miterScale = 1 / Math.max(Math.abs(cosHalf), 1 / MITER_LIMIT);
    }
    const arcT = arcs[i] / totalArc;
    const halfW = widthAt ? widthAt(arcT) * 0.5 : halfW0;
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

    if (i < nPoly - 1 && fL > 1e-9) { prevTx = fx / fL; prevTy = fy / fL; }
  }

  if (indices) writeQuadIndices(indices, nPoly - 1);

  return { nRibbon: nPoly, indexCount: (nPoly - 1) * 6 };
}
