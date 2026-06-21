// Real-lego assembly queries: stud mating + collision, built on the connector
// map from solid.js. These answer the three questions an assembly needs:
//   - what connector sits at a given face cell?            (studAt)
//   - can brick B clutch onto brick A as placed?           (mate / canConnect)
//   - does a placed brick collide with the existing set?   (collides)
//
// A "placed" part is { def, R, C }: an op-model def, a row-major 3x3 rotation R
// (axis-aligned 90deg multiples in practice), and a world center C. resolveAssembly
// produces these; the queries are pure functions over them.

import { PLATE_H, CONN, partConnectors, solidCells } from "./solid.js";

const FACE_AXIS = { "y+": 1, "y-": 1, "x+": 0, "x-": 0, "z+": 2, "z-": 2 };
const FACE_SIGN = { "y+": 1, "y-": -1, "x+": 1, "x-": -1, "z+": 1, "z-": -1 };

const apply3 = (R, v) => [
  R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
  R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
  R[6] * v[0] + R[7] * v[1] + R[8] * v[2],
];

// partConnectors is pure in def; cache per def object so repeated queries on the
// same spec (the common case) don't re-evaluate the cut/op stack.
const connCache = new WeakMap();
function connectorsOf(def) {
  let c = connCache.get(def);
  if (!c) { c = partConnectors(def); connCache.set(def, c); }
  return c;
}

const NAME = ["none", "flat", "socket", "male"];

// studAt(def, face, u, v) -> "none" | "flat" | "socket" | "male".
// (u,v) index the face grid: y -> X*Z, x -> Z*Y, z -> X*Y.
export function studAt(def, face, u, v) {
  const f = connectorsOf(def).faces[face];
  if (!f || u < 0 || v < 0 || u >= f.U || v >= f.V) return "none";
  return NAME[f.grid[v * f.U + u]];
}

// Local-space center, on the part surface, of every male/socket cell — the point
// that must coincide with a mating cell on the neighbour. y in plate units, x/z
// in stud units, matching the mesher's cell layout.
function localConnectors(def) {
  const { W, H, D, faces } = connectorsOf(def);
  const hw = W / 2, hd = D / 2, hh = (H / 2) * PLATE_H;
  const out = [];
  for (const face in faces) {
    const { U, V, grid } = faces[face];
    const fa = FACE_AXIS[face], fs = FACE_SIGN[face];
    for (let u = 0; u < U; u++) for (let v = 0; v < V; v++) {
      const c = grid[v * U + u];
      if (c !== CONN.male && c !== CONN.socket) continue;
      let p, n;
      if (fa === 1) { p = [u + 0.5 - hw, fs * hh, v + 0.5 - hd]; n = [0, fs, 0]; }
      else if (fa === 0) { p = [fs * hw, (v + 0.5 - H / 2) * PLATE_H, u + 0.5 - hd]; n = [fs, 0, 0]; }
      else { p = [u + 0.5 - hw, (v + 0.5 - H / 2) * PLATE_H, fs * hd]; n = [0, 0, fs]; }
      out.push({ p, n, male: c === CONN.male });
    }
  }
  return out;
}

// World-space connectors of a placed part: rotate + translate each local one.
export function worldConnectors({ def, R, C }) {
  return localConnectors(def).map(({ p, n, male }) => {
    const wp = apply3(R, p);
    return { p: [wp[0] + C[0], wp[1] + C[1], wp[2] + C[2]], n: apply3(R, n), male };
  });
}

const TOL = 0.2;   // a connector pair counts as touching within a fifth of a stud

// mate(A, B): pair up coincident, oppositely-facing connectors of two placed
// parts. A male meeting a socket is a clutch; two males meeting is a conflict
// (studs can't share a cell). { clutch, conflict, connected }.
export function mate(A, B) {
  const ca = worldConnectors(A), cb = worldConnectors(B);
  let clutch = 0, conflict = 0;
  for (const a of ca) for (const b of cb) {
    const dx = a.p[0] - b.p[0], dy = a.p[1] - b.p[1], dz = a.p[2] - b.p[2];
    if (dx * dx + dy * dy + dz * dz > TOL * TOL) continue;
    if (a.n[0] * b.n[0] + a.n[1] * b.n[1] + a.n[2] * b.n[2] > -0.9) continue; // not face-to-face
    if (a.male && b.male) conflict++;
    else if (a.male !== b.male) clutch++;
  }
  return { clutch, conflict, connected: clutch > 0 && conflict === 0 };
}

// World axis-aligned boxes of a placed part's solid cells (R is a 90deg-multiple
// rotation, so each unit cell stays axis-aligned in world space).
export function cellBoxes({ def, R, C }) {
  const { W, H, D, cells } = solidCells(def);
  const hw = W / 2, hd = D / 2, hh = (H / 2) * PLATE_H;
  return cells.map(([i, j, k]) => {
    const lo = [i - hw, (j - H / 2) * PLATE_H, k - hd];
    const hi = [i + 1 - hw, (j + 1 - H / 2) * PLATE_H, k + 1 - hd];
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const cx of [lo[0], hi[0]]) for (const cy of [lo[1], hi[1]]) for (const cz of [lo[2], hi[2]]) {
      const w = apply3(R, [cx, cy, cz]);
      for (let a = 0; a < 3; a++) {
        const val = w[a] + C[a];
        if (val < min[a]) min[a] = val;
        if (val > max[a]) max[a] = val;
      }
    }
    return { min, max };
  });
}

const OVERLAP_EPS = 0.05;   // flush faces (zero overlap) are NOT a collision
const boxOverlap = (a, b) =>
  a.min[0] < b.max[0] - OVERLAP_EPS && b.min[0] < a.max[0] - OVERLAP_EPS &&
  a.min[1] < b.max[1] - OVERLAP_EPS && b.min[1] < a.max[1] - OVERLAP_EPS &&
  a.min[2] < b.max[2] - OVERLAP_EPS && b.min[2] < a.max[2] - OVERLAP_EPS;

// collides(existing, p): does placed part p interpenetrate any already-placed
// part? Per-cell box overlap, so flush stacking and clutched studs (studs add no
// cell) do not register; only shared solid volume does. existing items may carry
// a precomputed `boxes` to avoid recompute. -> { hit, with: [ids] }.
export function collides(existing, p) {
  const pb = cellBoxes(p);
  const with_ = [];
  for (const e of existing) {
    const eb = e.boxes ?? cellBoxes(e);
    if (pb.some((a) => eb.some((b) => boxOverlap(a, b)))) with_.push(e.id ?? null);
  }
  return { hit: with_.length > 0, with: with_ };
}
