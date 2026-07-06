import { Geometry } from "$lib/engine/index.js";
import {
  buildRibbonGeometry,
  writeQuadIndices,
  ARC_EXTRA_POINTS,
  PERP_CLEARANCE,
  ARC_CLEARANCE,
} from "$lib/brush/ribbon.js";

export { PERP_CLEARANCE, ARC_CLEARANCE };

export function makePolylineStroke({ maxPoints, params, brushColor, widthAt, perpClearance, arcClearance }) {
  const ribbonCap = maxPoints + ARC_EXTRA_POINTS;
  const maxVerts  = ribbonCap * 2;
  const positions = new Float32Array(maxVerts * 3);
  const lineUVs   = new Float32Array(maxVerts * 2);
  const indices   = new Uint16Array((ribbonCap - 1) * 6);
  writeQuadIndices(indices, ribbonCap - 1);

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
    widthAt: widthAt ?? null,           // (arcT, stroke) => absolute width; taper in mesh
    perpClearance, arcClearance,        // undefined = shared defaults
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

  const { positions, lineUVs, geom } = stroke;
  const built = buildRibbonGeometry(points, nPoly, stroke.lineWidth, {
    positions,
    uvs: lineUVs,
    stride: 3,
    perpClearance: stroke.perpClearance,
    arcClearance: stroke.arcClearance,
    widthAt: stroke.widthAt ? (t) => stroke.widthAt(t, stroke) : null,
  });

  geom.attributes.position.needsUpdate = true;
  geom.attributes.aLineUV.needsUpdate  = true;
  geom.setDrawRange(0, built.indexCount);
  stroke.n = nPoly;
  stroke.lastPts = points;
}
