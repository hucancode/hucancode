// Mech parts are SDF nodes, NOT meshes. Each node = a primitive + a CSG op,
// packed into an rgba32f data texture the raymarch shader interprets. This is
// what makes the pipeline first-principles: union = base shape, subtract = bool
// cut (holes/vents/splits), round = bevelled edge. Stage tags drive the 1->2->3
// reveal (base shapes -> boolean ops -> micro detail).

const D2R = Math.PI / 180;

// primitive id (matches shader). dims are authored in shader param order:
//   box [hx,hy,hz]  sphere [r]  cyl [r,h]  capsule [r,h]  cone [r1,h,r2]
//   torus [R,r]  pyramid [baseHalf,halfHeight]
export const TYPE = { sphere: 0, box: 1, cyl: 2, capsule: 3, cone: 4, torus: 5, pyramid: 6 };
export const OP = { union: 0, subtract: 1, intersect: 2 };
const TEXELS = 6; // float4s per node

// approx sRGB->linear (square) so lighting reads right; shader gamma-corrects out
function colLin(hex) {
  if (typeof hex === "string") hex = parseInt(hex.replace("#", ""), 16);
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  return [r * r, g * g, b * b];
}

// columns of R = Rz*Ry*Rx (euler XYZ, degrees). shader maps world->local via
// local.i = col_i . (p - t), i.e. R^T(p-t), so we store the columns of R.
function rotCols(rot) {
  const sx = Math.sin(rot[0] * D2R), cx = Math.cos(rot[0] * D2R);
  const sy = Math.sin(rot[1] * D2R), cy = Math.cos(rot[1] * D2R);
  const sz = Math.sin(rot[2] * D2R), cz = Math.cos(rot[2] * D2R);
  const r00 = cz * cy, r01 = cz * sy * sx - sz * cx, r02 = cz * sy * cx + sz * sx;
  const r10 = sz * cy, r11 = sz * sy * sx + cz * cx, r12 = sz * sy * cx - cz * sx;
  const r20 = -sy, r21 = cy * sx, r22 = cy * cx;
  return [[r00, r10, r20], [r01, r11, r21], [r02, r12, r22]];
}

// mirror across the X plane: R' = S R S with S = diag(-1,1,1). keeps a proper
// rotation, so a sym part reads as a true left/right mirror of its sibling.
function mirrorCols(c) {
  return [
    [c[0][0], -c[0][1], -c[0][2]],
    [-c[1][0], c[1][1], c[1][2]],
    [-c[2][0], c[2][1], c[2][2]],
  ];
}

function emit(nd, mirror) {
  let cols = rotCols(nd.rot || [0, 0, 0]);
  const t = (nd.pos || [0, 0, 0]).slice();
  if (mirror) { cols = mirrorCols(cols); t[0] = -t[0]; }
  const d = nd.dims || [1, 1, 1];
  const col = colLin(nd.color || "#9aa4b2");
  const type = TYPE[nd.type] ?? 1, op = OP[nd.op] ?? 0;
  const round = nd.round ?? 0.04, k = nd.k ?? 0, stage = nd.stage ?? 1;
  return [
    cols[0][0], cols[0][1], cols[0][2], type,
    cols[1][0], cols[1][1], cols[1][2], op,
    cols[2][0], cols[2][1], cols[2][2], round,
    t[0], t[1], t[2], k,
    d[0] || 0, d[1] || 0, d[2] || 0, d[3] || 0,
    col[0], col[1], col[2], stage,
  ];
}

// model -> { data, count }. sym nodes expand to two rows (self + mirror), so the
// authored list stays small and bilaterally symmetric by construction.
export function pack(model) {
  const rows = [];
  for (const nd of model.nodes || []) {
    rows.push(emit(nd, false));
    if (nd.sym) rows.push(emit(nd, true));
  }
  const count = rows.length;
  const data = new Float32Array(Math.max(1, count) * TEXELS * 4);
  for (let i = 0; i < count; i++) data.set(rows[i], i * TEXELS * 4);
  return { data, count, width: TEXELS };
}

// index in the packed/expanded node texture for an authored node index (so the
// editor can highlight the right row even when earlier nodes are sym-expanded).
export function texRowOf(model, authorIndex) {
  let row = 0;
  const nodes = model.nodes || [];
  for (let i = 0; i < authorIndex && i < nodes.length; i++) row += nodes[i].sym ? 2 : 1;
  return row;
}
