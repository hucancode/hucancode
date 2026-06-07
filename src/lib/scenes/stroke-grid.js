// Spatial grid SDF acceleration for polyline strokes.
// Builds a GW × GH cell grid; each cell lists up to 8 segment indices.
// Stored as a (GW*2) × GH RGBA float texture (2 RGBA pixels = 8 IDs per cell).
import {
  DataTexture,
  FloatType,
  RGBAFormat,
  NearestFilter,
  ClampToEdgeWrapping,
  Vector2,
} from "three";

export const GRID_W = 32;
export const GRID_H = 32;
export const GRID_K = 8;            // max segments per cell

export function allocGridTex() {
  const data = new Float32Array(GRID_W * 2 * GRID_H * 4);
  data.fill(-1);
  const tex = new DataTexture(data, GRID_W * 2, GRID_H, RGBAFormat, FloatType);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { tex, data };
}

export function makeGridUniforms(gridTex) {
  return {
    gridTex:      { value: gridTex },
    gridSize:     { value: new Vector2(GRID_W, GRID_H) },
    gridOrigin:   { value: new Vector2(0, 0) },
    gridCellSize: { value: new Vector2(1, 1) },
  };
}

// Bin segments [p_i, p_{i+1}] into grid cells. margin = max stroke half-width.
// Mutates `gridData` (Float32Array) and updates uniforms.
//
// Grid extent = canvas world bbox (NDC × aspect), NOT curve bbox. A curve-shaped
// bbox collapses to ~zero in the degenerate axis (straight chains), making cells
// ultra-thin and forcing every segment to overlap all rows → K-cap overflow.
export function buildGrid(points, margin, gridData, gridTex, uniforms) {
  const N = points.length;
  if (N < 2) {
    gridData.fill(-1);
    gridTex.needsUpdate = true;
    return;
  }

  const ires = uniforms.iResolution.value;
  const aspect = (ires && ires.y > 0) ? ires.x / ires.y : 1.0;
  const xmin = -aspect, xmax = aspect;
  const ymin = -1.0, ymax = 1.0;

  const cw = (xmax - xmin) / GRID_W;
  const ch = (ymax - ymin) / GRID_H;

  // counts[cell] tracks how many we've pushed so far (≤ GRID_K)
  gridData.fill(-1);

  // Two-pass: bbox-prefilter candidates per cell, then K-nearest filter.
  // Margin expanded by cell-half-diagonal so a pixel anywhere in a cell still
  // catches any segment that could reach it (otherwise pixels near cell corner
  // could miss a segment whose stroke lies in the next cell over).
  const segCount = N - 1;
  const cellCount = GRID_W * GRID_H;
  const queryMargin = margin + Math.hypot(cw, ch) * 0.5;

  // Pass 1a: count bbox-overlaps per cell.
  const counts = new Int32Array(cellCount);
  const sgx1 = new Int32Array(segCount);
  const sgx2 = new Int32Array(segCount);
  const sgy1 = new Int32Array(segCount);
  const sgy2 = new Int32Array(segCount);

  for (let s = 0; s < segCount; s++) {
    const a = points[s], b = points[s + 1];
    const x1 = Math.min(a.x, b.x) - queryMargin;
    const x2 = Math.max(a.x, b.x) + queryMargin;
    const y1 = Math.min(a.y, b.y) - queryMargin;
    const y2 = Math.max(a.y, b.y) + queryMargin;
    const gx1 = Math.max(0, Math.floor((x1 - xmin) / cw));
    const gx2 = Math.min(GRID_W - 1, Math.floor((x2 - xmin) / cw));
    const gy1 = Math.max(0, Math.floor((y1 - ymin) / ch));
    const gy2 = Math.min(GRID_H - 1, Math.floor((y2 - ymin) / ch));
    sgx1[s] = gx1; sgx2[s] = gx2; sgy1[s] = gy1; sgy2[s] = gy2;
    for (let gy = gy1; gy <= gy2; gy++) {
      for (let gx = gx1; gx <= gx2; gx++) counts[gy * GRID_W + gx]++;
    }
  }

  // Pass 1b: prefix-sum offsets into a flat candidate buffer.
  const offsets = new Int32Array(cellCount + 1);
  for (let i = 0; i < cellCount; i++) offsets[i + 1] = offsets[i] + counts[i];
  const flat = new Int32Array(offsets[cellCount]);
  const cursor = new Int32Array(cellCount);

  // Pass 1c: write candidates.
  for (let s = 0; s < segCount; s++) {
    const gx1 = sgx1[s], gx2 = sgx2[s], gy1 = sgy1[s], gy2 = sgy2[s];
    for (let gy = gy1; gy <= gy2; gy++) {
      const base = gy * GRID_W;
      for (let gx = gx1; gx <= gx2; gx++) {
        const ci = base + gx;
        flat[offsets[ci] + cursor[ci]++] = s;
      }
    }
  }

  // Pass 2: per cell, pick K nearest candidates by distance to cell center.
  const bestD = new Float64Array(GRID_K);
  const bestS = new Int32Array(GRID_K);
  for (let gy = 0; gy < GRID_H; gy++) {
    const cy = ymin + (gy + 0.5) * ch;
    for (let gx = 0; gx < GRID_W; gx++) {
      const ci = gy * GRID_W + gx;
      const start = offsets[ci];
      const end   = start + counts[ci];
      if (end === start) continue;

      const cx = xmin + (gx + 0.5) * cw;
      for (let k = 0; k < GRID_K; k++) { bestD[k] = Infinity; bestS[k] = -1; }
      let worstIdx = 0;
      let worstD   = Infinity;

      for (let i = start; i < end; i++) {
        const s = flat[i];
        const a = points[s], b = points[s + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const ll = dx * dx + dy * dy;
        let t = 0;
        if (ll > 1e-12) t = ((cx - a.x) * dx + (cy - a.y) * dy) / ll;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const px = a.x + t * dx, py = a.y + t * dy;
        const ddx = cx - px, ddy = cy - py;
        const d = ddx * ddx + ddy * ddy;
        if (d >= worstD) continue;

        bestD[worstIdx] = d;
        bestS[worstIdx] = s;
        worstD = -Infinity;
        for (let k = 0; k < GRID_K; k++) {
          if (bestD[k] > worstD) { worstD = bestD[k]; worstIdx = k; }
        }
      }

      const baseRow = gy * (GRID_W * 2);
      for (let slot = 0; slot < GRID_K; slot++) {
        const seg = bestS[slot];
        if (seg < 0) continue;
        const texCol = gx * 2 + (slot >> 2);
        const o = (baseRow + texCol) * 4 + (slot & 3);
        gridData[o] = seg;
      }
    }
  }

  gridTex.needsUpdate = true;
  uniforms.gridOrigin.value.set(xmin, ymin);
  uniforms.gridCellSize.value.set(cw, ch);
}
