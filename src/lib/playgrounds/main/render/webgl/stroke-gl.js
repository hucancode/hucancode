// Ribbon geometry for ink strokes — thin adapter over the shared builder.
// clearance margins MUST match the stroke fragment shader so ink can bleed past the nominal edge.

import { buildRibbonGeometry, ARC_EXTRA_POINTS } from "$lib/brush/ribbon.js";

export { PERP_CLEARANCE, ARC_CLEARANCE } from "$lib/brush/ribbon.js";

// persistent scratch reused across frames; caller uploads synchronously before the next buildRibbon, so sharing is safe
let _capacity = 0;
let _positions = null, _uvs = null, _indices = null, _arcs = null;
function ensureScratch(nRibbon) {
  if (_capacity === nRibbon) return;
  _capacity = nRibbon;
  _positions = new Float32Array(nRibbon * 4);
  _uvs = new Float32Array(nRibbon * 4);
  _arcs = new Float32Array(nRibbon);
  _indices = new Uint16Array((nRibbon - 1) * 6);
}

export function buildRibbon(points, lineWidth) {
  const nPoly = points.length;
  if (nPoly < 2) return null;
  const nRibbon = nPoly + ARC_EXTRA_POINTS;
  ensureScratch(nRibbon);

  const built = buildRibbonGeometry(points, nPoly, lineWidth, {
    positions: _positions,
    uvs: _uvs,
    indices: _indices,
    arcs: _arcs,
    stride: 2,
  });

  return { positions: _positions, uvs: _uvs, indices: _indices, indexCount: built.indexCount };
}
