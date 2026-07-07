import { Geometry } from "$lib/engine/index.js";
import { buildRibbonGeometry, writeQuadIndices } from "$lib/brush/ribbon.js";

// Exact-width ribbon record (no bleed margins): the fragment shaders are flat
// fills, so all width shaping lives in the MESH via widthAt.
export function makePolylineStroke({ maxPoints, lineWidth, brushColor, widthAt }) {
  const ribbonCap = maxPoints;
  const maxVerts  = ribbonCap * 2;
  const positions = new Float32Array(maxVerts * 3);
  const lineUVs   = new Float32Array(maxVerts * 2);
  const indices   = new Uint16Array((ribbonCap - 1) * 6);
  writeQuadIndices(indices, ribbonCap - 1);

  const geom = new Geometry();
  geom.setAttribute("position", positions, 3);
  geom.setAttribute("aLineUV", lineUVs, 2);
  geom.setIndex(indices);
  geom.setDrawRange(0, 0);

  return {
    geom, positions, lineUVs,
    maxPoints, ribbonCap, n: 0,
    lineWidth,
    lastPts: null,
    brushColor,
    widthAt: widthAt ?? null, // (arcT, stroke) => absolute width; taper in mesh
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

  const { positions, lineUVs, geom } = stroke;
  const built = buildRibbonGeometry(points, nPoly, stroke.lineWidth, {
    positions,
    uvs: lineUVs,
    stride: 3,
    widthAt: stroke.widthAt ? (t) => stroke.widthAt(t, stroke) : null,
  });

  geom.setDrawRange(0, built.indexCount);
  stroke.n = nPoly;
  stroke.lastPts = points;
}
