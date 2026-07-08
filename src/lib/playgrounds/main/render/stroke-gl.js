// Ribbon geometry for the flat ink stroke — thin adapter over the shared builder.
// Exact-width mesh (no bleed margins): the fragment shader is a flat fill, so
// the taper lives in the MESH via widthAt.

import { buildRibbonGeometry } from "$lib/brush/ribbon.js";

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

export function buildRibbon(points, lineWidth, widthAt = null) {
  const nPoly = points.length;
  if (nPoly < 2) return null;
  ensureScratch(nPoly);

  const built = buildRibbonGeometry(points, nPoly, lineWidth, {
    positions: _positions,
    uvs: _uvs,
    indices: _indices,
    arcs: _arcs,
    stride: 2,
    widthAt,
  });

  return { positions: _positions, uvs: _uvs, indices: _indices, indexCount: built.indexCount };
}
