// SCULPT ENGINE — surface detail cut INTO or extruded OUT OF a primitive's
// face, along that face's normal. A panel is real geometry (the base face is
// emitted with the panel's footprint removed and re-walled), not a texture and
// not a boolean: no CSG is needed, because a face knows its own parameterisation.
//
// THE ONE ABSTRACTION — a SURFACE is a face expressed as (u,v) in [0,1]^2:
//   p(u,v,dep)  unit-mesh position, pushed `dep` WORLD units along the normal
//   n(u,v)      unit-mesh normal (the renderer's inverse-transpose makes it
//               world-correct, so every normal here stays in unit space)
//   su(v), sv   WORLD length of a unit step in u / v — the metric that makes
//               "half a unit" and "45 degrees" mean the same on every face
//   nu, nv      curvature sampling across the full u / v range (1 = flat)
//   mkey(u)     the face's identity under an x-mirror (see MIRRORING)
// Given those, a box face, a cylinder's unrolled side and a sphere's lat/long
// grid all sculpt through one code path — which IS the spec: unroll the
// cylinder body to a rectangle, treat lat/long as the straight guide lines.
//
// THE GRID — the face splits into cells. A cell may stay flat, grow a BOSS (a
// cylindrical stub), or join a PANEL. A cell's border is always the same uniform
// sample list, so neighbours agree vertex-for-vertex and no crack or T-junction
// can open between them.
//
// PANELS MERGE — adjacent panel cells LINK, and each connected group becomes one
// panel: two cells side by side make a domino, four make a big square, an elbow
// makes an L. The group's outline is traced off the grid, inset by the margin and
// then chamfered at 45 degrees, so a merged panel is a single rectilinear plate
// with cut corners rather than a tidy row of identical squares.
//
// THE RANDOMS — nothing is drawn from a running sequence. A cell, a link and a
// corner each seed their own PRNG from a hash of WHERE they are. That pins a
// panel to its position (nudging `density` toggles panels in place instead of
// reshuffling the face), gives every face its own layout, and is what makes
// MIRRORING nearly free.
//
// MIRRORING — an x-mirror acts on every surface here as a map on u alone, so
// `mkey(u)` folds u to a canonical value and returns the face key it shares with
// its reflection (the box's +X and -X faces reflect onto EACH OTHER, so they
// answer to one key; every other face reflects onto itself). Hash the folded
// identity and a feature and its reflection cannot disagree — chamfers included,
// since a corner and its mirror fold to the same u.
//
// DESIGNS — the layout is a grid, so a grid of TEXT can state it outright (see
// SCULPT_NOTATION). A design replaces the dice for a face: it fixes the cells,
// what merges with what, and which way each plate goes. `slant` and `seed` still
// shape the corners, since the notation says nothing about them.
import { TAU } from "../math/scalar.js";
import { mulberry32, hashStr } from "../math/random.js";
import { geo, tri, triS, quadN } from "./geo.js";
import { handle, q4 } from "./primitives.js";

export const SCULPT_DEFAULTS = {
  cell: 0.5,      // target cell size, world units -> how dense the panelling is
  size: 0.72,     // panel footprint as a fraction of its cell
  depth: 0.1,     // sculpt depth, world units
  slant: 0.5,     // 45-degree corner chamfer, fraction of the longest legal leg
  density: 0.55,  // fraction of cells that host a panel
  merge: 0.45,    // chance two neighbouring panel cells join into one plate
  cuts: 0.6,      // fraction of panels cut IN; the rest extrude OUT
  boss: 0.25,     // fraction of sculpted cells that take a STUD instead
  bossR: 0.55,    // stud radius, fraction of the cell's panel footprint
  bossH: 0.14,    // stud height / hole depth, world units
  bossCuts: 0.35, // fraction of studs bored IN as holes; the rest stand OUT
  mirror: 0,      // 1 = sculpt is symmetric across the YZ plane (mirrored in x)
  seed: 1,        // reseed -> new random panel layout
};

// sculpt params are baked into the mesh, so they belong in its registry key
export function sculptKey(sc) {
  const s = { ...SCULPT_DEFAULTS, ...sc };
  const d = s.design ? hashStr(JSON.stringify(s.design)) : 0;
  return [s.cell, s.size, s.depth, s.slant, s.density, s.merge, s.cuts,
    s.boss, s.bossR, s.bossH, s.bossCuts, s.mirror, s.seed].map(q4).join(",") + `:${d}`;
}

// ---- NOTATION --------------------------------------------------------------
// A design is a picture of the face, one character per cell, drawn the way you
// look at it: the FIRST line is the TOP row. Whitespace is ignored, so
// ".a a ." and ".aa." are the same and columns can be spaced out to stay
// readable. Short rows pad with flat cells.
//
//   .   flat — no sculpt
//   *   stud — a cylindrical stub standing OUT of the face ('O' does the same)
//   o   hole — the same stud bored IN, a round socket
//   a-z plate, CUT INTO the face
//   A-Z plate, RAISED out of the face
//
// Lower case goes IN and upper case comes OUT throughout, studs included, which
// is why 'o' and 'O' are spoken for and cannot name a plate. Every other letter
// can. The LETTER names the plate: cells touching edge-to-edge that carry the
// same letter merge into ONE plate, and different letters stay apart even when
// they touch. That is the whole trick — it is how you draw an L, a long rail, or
// two plates butted against each other without them fusing:
//
//   a a . B B B      one L-shaped cut plate 'a', one raised rail 'B', a stud
//   a . . . . *      standing out, a hole bored in, and 'c'/'d' side by side
//   a . o . c c d d  but separate because they are named differently.
//
// A design fixes the layout, so `density`, `merge` and `cuts` no longer apply to
// that face, and `mirror` is ignored — draw it symmetric if you want symmetry.
// `cell` no longer sets the grid either: the text's own size does.
export const SCULPT_NOTATION = `.   flat
*   stud OUT
o   hole IN
a-z plate cut IN
A-Z plate raised OUT`;

const isStudOut = (c) => c === "*" || c === "O";
const isStudIn = (c) => c === "o";
// o/O are studs, so they are not available as plate names
const isPlate = (c) =>
  ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z")) && c !== "o" && c !== "O";

// text -> { gu, gv, ch(i,j) } with row 0 read as the TOP (v = 1). Reading past
// the drawing gives flat, so a ragged or undersized design just pads out.
export function parseDesign(text) {
  const rows = String(text).split("\n").map((l) => l.replace(/\s+/g, "")).filter((l) => l);
  if (!rows.length) return null;
  const gv = rows.length;
  const gu = Math.max(...rows.map((r) => r.length));
  if (!gu) return null;
  return { gu, gv, ch: (i, j) => (rows[gv - 1 - j] || "")[i] || "." };
}

// A BOX has to square its design up. Neighbouring faces share an edge, and they
// must cut it into the same number of cells or the two sides T-junction along
// the box's own seam: the z edge, for instance, is +X's u axis but +Y's v axis,
// which forces gu === gv. So every face is re-emitted at one n x n grid, padded
// with flat cells, anchored at the bottom-left of what was drawn.
function squareBoxDesign(design) {
  if (!design) return null;
  const per = {};
  let n = 0;
  for (const f of BOX_FACE_NAMES) {
    const text = typeof design === "string" ? design : design[f];
    per[f] = text ? parseDesign(text) : null;
    if (per[f]) n = Math.max(n, per[f].gu, per[f].gv);
  }
  if (!n) return null;
  const out = {};
  for (const f of BOX_FACE_NAMES) {
    const p = per[f], rows = [];
    for (let j = n - 1; j >= 0; j--) {              // text runs top row first
      let line = "";
      for (let i = 0; i < n; i++) line += p ? p.ch(i, j) : ".";
      rows.push(line);
    }
    out[f] = rows.join("\n");
  }
  return out;
}

// `design` is one string for every face, or a map keyed by face (pz/nz/px/nx/
// py/ny for a box, cyl, sph)
function designFor(sc, key) {
  const d = sc.design;
  if (!d) return null;
  const text = typeof d === "string" ? d : d[key];
  return text ? parseDesign(text) : null;
}

const GRID_MAX = 24;   // cells per axis — guards a tiny `cell` against blowup
const EPS = 1e-7;
const BOSS_SEG = 16;   // even, so a boss's rim closes under reflection

const cells = (world, cell) => Math.max(1, Math.min(GRID_MAX, Math.round(world / cell)));
const steps = (du, dv, s) => Math.max(1, Math.round(Math.abs(du) * s.nu + Math.abs(dv) * s.nv));
const wrap1 = (x) => ((x % 1) + 1) % 1;
const rndAt = (...parts) => mulberry32(hashStr(parts.join("|")));

// ---- SURFACES --------------------------------------------------------------

// Box faces. Each frame satisfies cross(dp/du, dp/dv) = +n, so a CCW winding in
// (u,v) is front-facing — the convention the whole engine draws by. `m` reports
// [su, sv, sn]: sn is the box's scale along the face normal, which turns a WORLD
// depth into the unit-cube offset that survives the instance scale.
const BOX_FACES = {
  pz: { n: [0, 0, 1],  p: (u, v, q) => [u - 0.5, v - 0.5, 0.5 + q],  m: (w, h, d) => [w, h, d] },
  nz: { n: [0, 0, -1], p: (u, v, q) => [0.5 - u, v - 0.5, -0.5 - q], m: (w, h, d) => [w, h, d] },
  px: { n: [1, 0, 0],  p: (u, v, q) => [0.5 + q, v - 0.5, 0.5 - u],  m: (w, h, d) => [d, h, w] },
  nx: { n: [-1, 0, 0], p: (u, v, q) => [-0.5 - q, v - 0.5, u - 0.5], m: (w, h, d) => [d, h, w] },
  py: { n: [0, 1, 0],  p: (u, v, q) => [u - 0.5, 0.5 + q, 0.5 - v],  m: (w, h, d) => [w, d, h] },
  ny: { n: [0, -1, 0], p: (u, v, q) => [u - 0.5, -0.5 - q, v - 0.5], m: (w, h, d) => [w, d, h] },
};

export const BOX_FACE_NAMES = Object.keys(BOX_FACES);

// x -> -x reflects ±Z / ±Y onto THEMSELVES (u -> 1-u), and swaps +X with -X, so
// that pair answers to one shared key and -X reads +X's u backwards.
const BOX_MIRROR = {
  pz: (u) => ["pz", Math.min(u, 1 - u)],
  nz: (u) => ["nz", Math.min(u, 1 - u)],
  py: (u) => ["py", Math.min(u, 1 - u)],
  ny: (u) => ["ny", Math.min(u, 1 - u)],
  px: (u) => ["x", u],
  nx: (u) => ["x", 1 - u],
};

export function boxFace(name, w, h, d) {
  const f = BOX_FACES[name];
  const [su, sv, sn] = f.m(w, h, d);
  return {
    p: (u, v, dep = 0) => f.p(u, v, dep / sn),
    n: () => f.n,
    su: () => su, suMax: su, sv,
    nu: 1, nv: 1,
    skip: () => false,
    key: name, mkey: BOX_MIRROR[name], evenU: false, wrapU: false,
  };
}

// Cylinder side, unrolled to a TAU*r by h rectangle. u runs BACKWARDS around
// the axis so the frame stays right-handed like every other surface; the seam
// closes on itself either way.
export function cylSide(r, h, seg) {
  const ang = (u) => -u * TAU;
  return {
    p: (u, v, dep = 0) => {
      const t = ang(u), q = 1 + dep / r;
      return [q * Math.cos(t), v, q * Math.sin(t)];
    },
    n: (u) => { const t = ang(u); return [Math.cos(t), 0, Math.sin(t)]; },
    su: () => TAU * r, suMax: TAU * r, sv: h,
    nu: seg, nv: 1,
    skip: () => false,
    key: "cyl",
    mkey: (u) => ["cyl", Math.min(u, wrap1(0.5 - u))],
    evenU: true, wrapU: true,
  };
}

// Sphere on its lat/long grid, exactly as specified: u = longitude, v =
// latitude, panel edges follow those guide lines. Meridians converge, so u's
// metric shrinks toward the poles — panels are skipped where a cell gets too
// pinched to read as one.
export function sphereLathe(r, seg, rings) {
  const sinLat = (v) => Math.sin(v * Math.PI);
  return {
    p: (u, v, dep = 0) => {
      const t = u * TAU, f = v * Math.PI, q = 1 + dep / r, sf = Math.sin(f);
      return [q * Math.cos(t) * sf, q * Math.cos(f), q * Math.sin(t) * sf];
    },
    n: (u, v) => {
      const t = u * TAU, f = v * Math.PI, sf = Math.sin(f);
      return [Math.cos(t) * sf, Math.cos(f), Math.sin(t) * sf];
    },
    su: (v) => TAU * r * sinLat(v), suMax: TAU * r, sv: Math.PI * r,
    nu: seg, nv: rings,
    skip: (v) => sinLat(v) < 0.32,
    key: "sph",
    mkey: (u) => ["sph", Math.min(u, wrap1(0.5 - u))],
    evenU: true, wrapU: true,
  };
}

// ---- GRID ------------------------------------------------------------------

const cellNU = (s, u0, u1) => Math.max(1, Math.round((u1 - u0) * s.nu));
const cellNV = (s, v0, v1) => Math.max(1, Math.round((v1 - v0) * s.nv));

// The face's cell grid. A design states its own size; otherwise the target cell
// size does, and mirroring pairs column i with a partner column — which only
// lands on a whole column when the wrapping surfaces have an even count.
// sculptSurface and rimU BOTH read this, so a cylinder's caps can never fan over
// a different grid than its body was built on.
function gridOf(s, sc) {
  const design = designFor(sc, s.key);
  if (design) return { design, gu: design.gu, gv: design.gv };
  const g = cells(s.suMax, sc.cell);
  return {
    design: null,
    gu: sc.mirror && s.evenU ? Math.max(2, g + (g % 2)) : g,
    gv: cells(s.sv, sc.cell),
  };
}

// a cell's folded identity — the seed for everything decided per cell
function cellId(s, sc, i, j, gu) {
  const u = (i + 0.5) / gu;
  const [k, cu] = sc.mirror ? s.mkey(u) : [s.key, u];
  return `${k}|${q4(cu)}|${j}`;
}

// ---- LOOPS -----------------------------------------------------------------

// a (u,v) rect of the base surface, subdivided for curvature — a flat cell.
// Sample counts come only from the rect's own extent, so two cells sharing a
// border always subdivide it identically.
function patch(g, s, u0, u1, v0, v1, dep = 0) {
  const nu = cellNU(s, u0, u1), nv = cellNV(s, v0, v1);
  for (let j = 0; j < nv; j++) {
    const b0 = v0 + ((v1 - v0) * j) / nv, b1 = v0 + ((v1 - v0) * (j + 1)) / nv;
    for (let i = 0; i < nu; i++) {
      const a0 = u0 + ((u1 - u0) * i) / nu, a1 = u0 + ((u1 - u0) * (i + 1)) / nu;
      quadUV(g, s, a0, a1, b0, b1, dep);
    }
  }
}

// one (u,v) quad riding the surface at depth, split CCW
function quadUV(g, s, a0, a1, b0, b1, dep) {
  const P = (u, v) => s.p(u, v, dep);
  triS(g, P(a0, b0), P(a1, b0), P(a1, b1), s.n(a0, b0), s.n(a1, b0), s.n(a1, b1));
  triS(g, P(a0, b0), P(a1, b1), P(a0, b1), s.n(a0, b0), s.n(a1, b1), s.n(a0, b1));
}

// subdivide a polyline's edges for curvature, dropping each edge's end (the next
// edge supplies it) so a closed loop comes back without duplicates
function densify(s, loop) {
  const out = [];
  for (let k = 0; k < loop.length; k++) {
    const a = loop[k], b = loop[(k + 1) % loop.length];
    const du = b[0] - a[0], dv = b[1] - a[1];
    if (Math.hypot(du, dv) < EPS) continue;
    const ns = steps(du, dv, s);
    for (let i = 0; i < ns; i++) out.push([a[0] + (du * i) / ns, a[1] + (dv * i) / ns]);
  }
  return out;
}

// a boss outline — an ellipse in (u,v) precisely so it comes out ROUND in world,
// on a face whose u and v stretch differently
function bossLoop(cu, cv, ru, rv) {
  const out = [];
  for (let i = 0; i < BOSS_SEG; i++) {
    const t = (i / BOSS_SEG) * TAU;
    out.push([cu + ru * Math.cos(t), cv + rv * Math.sin(t)]);
  }
  return out;
}

// ---- CLUSTER OUTLINE -------------------------------------------------------

const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

// Trace a cell group's boundary as a rectilinear loop of GRID CORNERS, wound CCW
// (material on the left). Returns null for anything not a single simple loop —
// a pinch (two cells meeting only at a corner) or a hole — which the caller
// resolves by not merging those cells. That keeps every later step, especially
// the inset, working on a polygon it can actually handle.
function traceCluster(list, has) {
  const edges = [];
  for (const [i, j] of list) {
    if (!has(i, j - 1)) edges.push([[i, j], [i + 1, j]]);
    if (!has(i + 1, j)) edges.push([[i + 1, j], [i + 1, j + 1]]);
    if (!has(i, j + 1)) edges.push([[i + 1, j + 1], [i, j + 1]]);
    if (!has(i - 1, j)) edges.push([[i, j + 1], [i, j]]);
  }
  if (!edges.length) return null;
  const kf = (p) => `${p[0]},${p[1]}`;
  const next = new Map();
  for (const e of edges) {
    if (next.has(kf(e[0]))) return null;          // two edges leave one corner: pinch
    next.set(kf(e[0]), e[1]);
  }
  const start = edges[0][0];
  const loop = [start];
  let cur = start;
  for (let n = 0; n <= edges.length; n++) {
    const nx = next.get(kf(cur));
    if (!nx) return null;
    cur = nx;
    if (kf(cur) === kf(start)) break;
    loop.push(cur);
  }
  return loop.length === edges.length ? loop : null;   // shorter: a second loop exists
}

// drop corners that only sit mid-edge — the inset needs true corners, with the
// edges strictly alternating horizontal / vertical
function corners(loop) {
  const out = [];
  for (let k = 0; k < loop.length; k++) {
    const a = loop[(k - 1 + loop.length) % loop.length], b = loop[k], c = loop[(k + 1) % loop.length];
    if (Math.abs(cross2(a, b, c)) > EPS) out.push(b);
  }
  return out;
}

// Inset a rectilinear CCW polygon by (mu, mv). Each edge slides along its own
// inward normal; because the edges alternate H/V, a corner is just the meeting
// of one offset u and one offset v — no general offsetting needed. Reflex
// corners fall out correctly, which is what gives an L its clean inner corner
// instead of a stair step.
function insetRect(poly, mu, mv) {
  const n = poly.length;
  const eu = [], ev = [];        // per-edge offset lines (NaN where not applicable)
  for (let k = 0; k < n; k++) {
    const a = poly[k], b = poly[(k + 1) % n];
    if (Math.abs(b[1] - a[1]) < EPS) {          // horizontal: material is left of +u
      ev.push(a[1] + mv * Math.sign(b[0] - a[0]));
      eu.push(NaN);
    } else {                                    // vertical: material is left of +v
      eu.push(a[0] - mu * Math.sign(b[1] - a[1]));
      ev.push(NaN);
    }
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    const prev = (k - 1 + n) % n;
    const u = Number.isNaN(eu[prev]) ? eu[k] : eu[prev];
    const v = Number.isNaN(ev[prev]) ? ev[k] : ev[prev];
    out.push([u, v]);
  }
  return out;
}

// Chamfer the CONVEX corners of a polygon with 45 degree cuts. Legs are equal
// WORLD lengths, so the cut reads as a true 45 wherever u and v stretch
// differently, and each is capped at half its shorter neighbouring edge so two
// chamfers on one edge can never cross. The leg comes from a hash of the
// corner's own folded position, so a corner and its reflection agree for free.
function chamfer(s, sc, poly, su, sv, legKey) {
  const n = poly.length;
  const out = [];
  const len = (a, b) => Math.hypot((b[0] - a[0]) * su, (b[1] - a[1]) * sv);
  for (let k = 0; k < n; k++) {
    const a = poly[(k - 1 + n) % n], b = poly[k], c = poly[(k + 1) % n];
    const convex = cross2(a, b, c) > EPS;
    const cap = 0.5 * Math.min(len(a, b), len(b, c));
    const t = rndAt(legKey(b))();
    const leg = convex ? sc.slant * cap * (Math.floor(t * 4) / 3) : 0;
    if (leg < EPS) { out.push(b); continue; }
    const put = (from) => {
      const du = from[0] - b[0], dv = from[1] - b[1];
      const l = Math.hypot(du * su, dv * sv) || 1;
      return [b[0] + (du * leg) / l, b[1] + (dv * leg) / l];
    };
    out.push(put(a), put(c));      // walk in, cut across, walk back out
  }
  return out;
}

// ---- TRIANGULATION ---------------------------------------------------------

// Ear clipping for a simple polygon (CCW). Only used for the concave floors an
// L or T plate produces; convex plates take the cheaper fan below.
function earClip(poly) {
  const n = poly.length;
  if (n < 3) return [];
  const idx = [...Array(n).keys()];
  const out = [];
  const inside = (p, a, b, c) => {
    const d1 = cross2(a, b, p), d2 = cross2(b, c, p), d3 = cross2(c, a, p);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  let guard = n * n + 8;
  while (idx.length > 3 && guard-- > 0) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k - 1 + idx.length) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
      const a = poly[i0], b = poly[i1], c = poly[i2];
      if (cross2(a, b, c) <= EPS) continue;              // reflex or straight: no ear
      let clear = true;
      for (const m of idx) {
        if (m === i0 || m === i1 || m === i2) continue;
        if (inside(poly[m], a, b, c)) { clear = false; break; }
      }
      if (!clear) continue;
      out.push([i0, i1, i2]);
      idx.splice(k, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}

const isConvex = (poly) => {
  for (let k = 0; k < poly.length; k++) {
    const a = poly[(k - 1 + poly.length) % poly.length], b = poly[k], c = poly[(k + 1) % poly.length];
    if (cross2(a, b, c) < -EPS) return false;
  }
  return true;
};

// ---- EMISSION --------------------------------------------------------------

// The flat land between a cell group's border and its plate outline. The loops
// carry different vertex counts on purpose — the border is pinned to the samples
// its neighbours share, the outline is pinned to its exact 45 degree corners —
// so they are stitched greedily: at each step take whichever triangle closes the
// SHORTER diagonal, having first aligned the two loops at their nearest pair.
// (Matching them by perimeter instead drifts wherever a chamfer shortens the
// outline, and stitches corners to far-away border points — the skinny slivers
// that used to show up right at a slant.)
function ringStrip(g, s, outer, inner, su, sv, dep = 0) {
  const N = outer.length, M = inner.length;
  if (!N || !M) return;
  const d2 = (a, b) => ((a[0] - b[0]) * su) ** 2 + ((a[1] - b[1]) * sv) ** 2;
  let j0 = 0;
  for (let j = 1; j < M; j++) if (d2(outer[0], inner[j]) < d2(outer[0], inner[j0])) j0 = j;
  const emit = (a, b, c) =>
    triS(g, s.p(a[0], a[1], dep), s.p(b[0], b[1], dep), s.p(c[0], c[1], dep),
      s.n(...a), s.n(...b), s.n(...c));
  let i = 0, j = 0;
  while (i < N || j < M) {
    const o = outer[i % N], oN = outer[(i + 1) % N];
    const q = inner[(j + j0) % M], qN = inner[(j + 1 + j0) % M];
    // advance whichever side keeps the next diagonal shorter; a side that has
    // run out simply stops competing
    const takeOuter = j >= M || (i < N && d2(oN, q) <= d2(qN, o));
    if (takeOuter) { emit(o, oN, q); i++; } else { emit(qN, q, o); j++; }
  }
}

// The raised or sunken body inside an outline: walls from the rim to the floor,
// then the floor itself. Outline-agnostic, which is the whole trick — hand it an
// octagon and it builds a panel, hand it a circle and the walls become a boss's
// barrel and the floor becomes its top cap.
//
// `dep` carries the sign — negative cuts in, positive grows out — and the
// winding needs no special case for it: the wall quad's own cross product flips
// with dep, so an extrude's walls face outward and a cut's walls face into the
// pit, both front-facing, automatically.
function plateBody(g, s, loop, dep, su, sv) {
  for (let k = 0; k < loop.length; k++) {
    const a = loop[k], b = loop[(k + 1) % loop.length];
    quadN(g, s.p(...a), s.p(...b), s.p(...b, dep), s.p(...a, dep));
  }
  fillFloor(g, s, loop, dep, su, sv);
}

const inPoly = (p, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};

// Does a segment come anywhere near an axis-aligned cell? Separating axes: the
// segment's own bounds in u and v, then its normal. Conservative — a near miss
// may report a hit, which only ever shrinks the grid and leaves more for the
// ring strip. Crucially it has NO ray direction, so it answers a cell and its
// reflection identically; `inPoly` alone cannot, because a +u ray calls a point
// on a left edge inside and its mirror on a right edge outside.
function segNearRect(a, b, u0, u1, v0, v1) {
  // the bounds tests are deliberately slack: a grid runs u0 + w*i/n, so its LAST
  // column lands an ulp short of the bbox it was cut from while its first is
  // exact. Rejecting on the nose therefore misses an outline edge lying on the
  // far column but catches it on the near one — and a mirrored pair disagrees.
  if (Math.max(a[0], b[0]) < u0 - EPS || Math.min(a[0], b[0]) > u1 + EPS) return false;
  if (Math.max(a[1], b[1]) < v0 - EPS || Math.min(a[1], b[1]) > v1 + EPS) return false;
  const nx = b[1] - a[1], ny = a[0] - b[0];
  const d = (u, v) => nx * (u - a[0]) + ny * (v - a[1]);
  const s = [d(u0, v0), d(u1, v0), d(u1, v1), d(u0, v1)];
  // an edge that only grazes the cell counts as touching it: a reflected pair
  // computes these through different float paths and can land on opposite sides
  // of an exact zero, which would include a cell on one side and not the other
  return !(s.every((x) => x > EPS) || s.every((x) => x < -EPS));
}

// A floor has to BEND with the face it sits on. Fanning it from one centre point
// spokes long triangles straight across the curvature and the floor goes slack —
// on a sphere that reads as a flat facet where the surface should bulge. So on a
// curved face, lay a GRID inside the outline: every grid cell that falls wholly
// inside is emitted at depth, riding the surface exactly, and the leftover band
// out to the outline is stitched by the same ring strip the land uses.
//
// A flat face needs none of that — there a fan IS exact, and cheapest.
function fillFloor(g, s, loop, dep, su, sv) {
  if (!(s.nu === 1 && s.nv === 1) && gridFloor(g, s, loop, dep, su, sv)) return;
  if (isConvex(loop)) {
    let cu = 0, cv = 0;
    for (const p of loop) { cu += p[0]; cv += p[1]; }
    cu /= loop.length; cv /= loop.length;
    const cp = s.p(cu, cv, dep), cn = s.n(cu, cv);
    for (let k = 0; k < loop.length; k++) {
      const a = loop[k], b = loop[(k + 1) % loop.length];
      triS(g, cp, s.p(...a, dep), s.p(...b, dep), cn, s.n(...a), s.n(...b));
    }
    return;
  }
  for (const [x, y, z] of earClip(loop)) {
    const a = loop[x], b = loop[y], c = loop[z];
    triS(g, s.p(...a, dep), s.p(...b, dep), s.p(...c, dep), s.n(...a), s.n(...b), s.n(...c));
  }
}

// Returns false when the outline is too small to fit a grid, or when the cells
// that land inside it do not form one simple region — the caller then fans or
// ear-clips instead, which is fine precisely because those are the small, barely
// curved cases.
function gridFloor(g, s, loop, dep, su, sv) {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of loop) {
    u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]);
    v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]);
  }
  const nu = steps(u1 - u0, 0, s), nv = steps(0, v1 - v0, s);
  if (nu < 2 || nv < 2) return false;
  const GU = (i) => u0 + ((u1 - u0) * i) / nu;
  const GV = (j) => v0 + ((v1 - v0) * j) / nv;
  // A cell counts only if NO outline edge touches it — then its centre alone
  // decides the whole cell, and that test is stable because the boundary is
  // nowhere near it. Cells the outline crosses are left to the ring strip.
  const list = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a0 = GU(i), a1 = GU(i + 1), b0 = GV(j), b1 = GV(j + 1);
      let clear = true;
      for (let k = 0; k < loop.length && clear; k++)
        if (segNearRect(loop[k], loop[(k + 1) % loop.length], a0, a1, b0, b1)) clear = false;
      if (clear && inPoly([(a0 + a1) / 2, (b0 + b1) / 2], loop)) list.push([i, j]);
    }
  if (!list.length) return false;
  const set = new Set(list.map(([i, j]) => `${i},${j}`));
  const raw = traceCluster(list, (i, j) => set.has(`${i},${j}`));
  if (!raw) return false;
  for (const [i, j] of list) quadUV(g, s, GU(i), GU(i + 1), GV(j), GV(j + 1), dep);
  ringStrip(g, s, loop, raw.map(([i, j]) => [GU(i), GV(j)]), su, sv, dep);
  return true;
}

// ---- LAYOUT ----------------------------------------------------------------

// Sculpt a whole surface: decide every cell, link neighbouring panel cells into
// plates, then emit plates, bosses and flat land.
export function sculptSurface(g, s, opts) {
  const sc = { ...SCULPT_DEFAULTS, ...opts };
  const { design, gu, gv } = gridOf(s, sc);
  const cellH = s.sv / gv;
  const mFrac = (1 - Math.max(0.05, Math.min(sc.size, 0.95))) / 2;
  // The border is measured against the LOCAL cell, not the widest one: a
  // sphere's u metric collapses toward the poles, so a margin sized at the
  // equator would exceed a polar cell's own half-width and turn its inset
  // inside out. mFrac < 0.5 then guarantees the inset can never cross itself.
  const marginAt = (vm) => mFrac * Math.min(s.su(vm) / gu, cellH);
  const U = (i) => i / gu, V = (j) => j / gv;
  const id = (i, j) => cellId(s, sc, i, j, gu);

  // --- per-cell kind: the design states it, or the dice decide
  const KIND = new Uint8Array(gu * gv);      // 0 flat, 1 plate, 2 stud out, 3 hole in
  const at = (i, j) => j * gu + i;
  for (let j = 0; j < gv; j++) {
    for (let i = 0; i < gu; i++) {
      if (design) {
        const c = design.ch(i, j);
        const stud = isStudOut(c) ? 2 : isStudIn(c) ? 3 : 0;
        KIND[at(i, j)] = stud ? (sc.bossH > 0 ? stud : 0) : isPlate(c) && sc.depth > 0 ? 1 : 0;
        continue;
      }
      const r = rndAt(id(i, j), sc.seed | 0);
      const fire = r();
      r();                                         // amt — drawn again at emit
      const dir = r(), kind = r();
      if (fire >= sc.density || s.skip((V(j) + V(j + 1)) / 2)) continue;
      const stud = kind < sc.boss && sc.bossH > 0;
      KIND[at(i, j)] = stud ? (dir < sc.bossCuts ? 3 : 2) : sc.depth > 0 ? 1 : 0;
    }
  }

  // --- link panel cells into plates (union-find over the two link directions)
  const par = new Int32Array(gu * gv);
  for (let k = 0; k < par.length; k++) par[k] = k;
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
  const linked = (key) => rndAt(key, sc.seed | 0, "L")() < sc.merge;
  const foldU = (u) => (sc.mirror ? s.mkey(u) : [s.key, u]);
  for (let j = 0; j < gv; j++) {
    for (let i = 0; i < gu; i++) {
      if (KIND[at(i, j)] !== 1) continue;
      // A plate never crosses the u=0 seam: the outline is traced and inset in
      // (u,v), which a wrap would tear in half. Mirroring folds that seam onto
      // u=0.5, so when it is on, that column is held back too — otherwise the
      // two halves would disagree about one column of links.
      const seam = s.wrapU && (i === gu - 1 || (sc.mirror && i === gu / 2 - 1));
      // a design merges cells that NAME the same plate; otherwise the dice do
      const same = (a, b) => design && design.ch(a[0], a[1]) === design.ch(b[0], b[1]);
      if (i + 1 < gu && !seam && KIND[at(i + 1, j)] === 1) {
        const [k, cu] = foldU(U(i + 1));
        const yes = design ? same([i, j], [i + 1, j]) : linked(`H|${k}|${q4(cu)}|${j}`);
        if (yes) join(at(i, j), at(i + 1, j));
      }
      if (j + 1 < gv && KIND[at(i, j + 1)] === 1) {
        const [k, cu] = foldU(U(i) + 0.5 / gu);
        const yes = design ? same([i, j], [i, j + 1]) : linked(`V|${k}|${q4(cu)}|${j}`);
        if (yes) join(at(i, j), at(i, j + 1));
      }
    }
  }

  // --- gather plates
  const plates = new Map();
  for (let j = 0; j < gv; j++)
    for (let i = 0; i < gu; i++) {
      if (KIND[at(i, j)] !== 1) continue;
      const r = find(at(i, j));
      if (!plates.has(r)) plates.set(r, []);
      plates.get(r).push([i, j]);
    }

  // --- flat land and bosses
  for (let j = 0; j < gv; j++) {
    for (let i = 0; i < gu; i++) {
      const k = KIND[at(i, j)];
      if (k === 1) continue;                                  // plates come later
      if (k === 0) { patch(g, s, U(i), U(i + 1), V(j), V(j + 1)); continue; }
      const out = k === 2 ? 1 : -1;                           // 2 stands out, 3 bores in
      const vm = (V(j) + V(j + 1)) / 2;
      const su = s.su(vm), sv = s.sv, margin = marginAt(vm);
      const mu = margin / su, mv = margin / sv;
      const r = rndAt(id(i, j), sc.seed | 0);
      r(); const amt = r();
      const half = Math.min(U(i + 1) - U(i) - 2 * mu, V(j + 1) - V(j) - 2 * mv) / 2;
      const R = Math.max(EPS, half) * Math.max(0.05, Math.min(sc.bossR, 1));
      const cu = (U(i) + U(i + 1)) / 2, cv = (V(j) + V(j + 1)) / 2;
      // a boss is round in WORLD, so its uv radii carry the metric ratio
      const loop = densify(s, bossLoop(cu, cv, R, (R * su) / sv));
      ringStrip(g, s, densify(s, cellRect(U(i), U(i + 1), V(j), V(j + 1))), loop, su, sv);
      // a drawn stud is exactly as deep as asked; a rolled one varies. `out`
      // carries the sign, and a hole needs nothing else: the walls flip with it.
      plateBody(g, s, loop, out * (design ? sc.bossH : sc.bossH * (0.5 + 0.5 * amt)), su, sv);
    }
  }

  // --- plates. A drawn plate goes the way its letter says: lower case cuts in,
  // upper case rises out, and exactly as deep as asked.
  for (const list of plates.values()) {
    let dep;
    if (design) {
      const [i, j] = list[0];
      dep = (design.ch(i, j) === design.ch(i, j).toLowerCase() ? -1 : 1) * sc.depth;
    }
    emitPlate(g, s, sc, list, marginAt, U, V, id, dep);
  }
}

const cellRect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

// one plate: trace its cells, inset, chamfer, then land + walls + floor. A group
// whose outline is not a single simple loop is split back into its own cells,
// which always trace cleanly.
function emitPlate(g, s, sc, list, marginAt, U, V, id, fixedDep) {
  const set = new Set(list.map(([i, j]) => `${i},${j}`));
  const has = (i, j) => set.has(`${i},${j}`);
  const raw = traceCluster(list, has);
  if (!raw) {
    for (const c of list) emitPlate(g, s, sc, [c], marginAt, U, V, id, fixedDep);
    return;
  }
  // world metric at the plate's mid latitude (a sphere's u shrinks with it).
  // A plate spanning latitudes takes ONE metric, so its border stays an even
  // width instead of tapering cell by cell.
  let vm = 0;
  for (const [, j] of list) vm += (V(j) + V(j + 1)) / 2;
  vm /= list.length;
  const su = s.su(vm), sv = s.sv, margin = marginAt(vm);

  const toUV = (p) => [U(p[0]), V(p[1])];
  const outer = densify(s, raw.map(toUV));
  const box = corners(raw.map(toUV));
  const inner = chamfer(s, sc, insetRect(box, margin / su, margin / sv), su, sv,
    (p) => `K|${keyU(s, sc, p[0])}|${q4(p[1])}|${sc.seed | 0}`);
  const loop = densify(s, inner);
  if (loop.length < 3) return;

  // one plate, one depth: taken from the group's lowest folded cell id, which
  // its reflection also computes, so mirrored plates rise and sink together
  let dep = fixedDep;
  if (dep === undefined) {
    let root = null;
    for (const [i, j] of list) { const f = id(i, j); if (root === null || f < root) root = f; }
    const r = rndAt(root, sc.seed | 0, "P");
    dep = (r() < sc.cuts ? -1 : 1) * sc.depth * (0.45 + 0.55 * r());
  }
  ringStrip(g, s, outer, loop, su, sv);
  plateBody(g, s, loop, dep, su, sv);
}

const keyU = (s, sc, u) => {
  const [k, cu] = sc.mirror ? s.mkey(u) : [s.key, u];
  return `${k}|${q4(cu)}`;
};

// the u samples along a surface's v-edges — a cap has to fan over exactly these
// or it tears away from the sculpted body at the seam
export function rimU(s, opts) {
  const sc = { ...SCULPT_DEFAULTS, ...opts };
  const { gu } = gridOf(s, sc);
  const out = [];
  for (let i = 0; i < gu; i++) {
    const u0 = i / gu, u1 = (i + 1) / gu, nu = cellNU(s, u0, u1);
    for (let k = 0; k < nu; k++) out.push(u0 + ((u1 - u0) * k) / nu);
  }
  return out;
}

// ---- SCULPTED PRIMITIVES ---------------------------------------------------
// Sculpt sizes are WORLD lengths, so unlike a plain primitive these meshes
// can't be size-agnostic: the dimensions join the key. Identical parts still
// share one mesh and one instanced draw; only differently-sized ones part ways.

export function sculptBox(w = 1, h = 1, d = 1, sc = {}) {
  return handle(`sBox:${q4(w)}:${q4(h)}:${q4(d)}:${sculptKey(sc)}`, () => {
    const g = geo();
    const sq = squareBoxDesign(sc.design);
    const use = sq ? { ...sc, design: sq } : sc;
    for (const f of BOX_FACE_NAMES) sculptSurface(g, boxFace(f, w, h, d), use);
    return g;
  }, w, h, d);
}

export function sculptCylinder(r = 0.5, h = 1, sc = {}, seg = 32) {
  return handle(`sCyl:${q4(r)}:${q4(h)}:${seg}:${sculptKey(sc)}`, () => {
    const g = geo();
    const s = cylSide(r, h, seg);
    sculptSurface(g, s, sc);
    // caps fan over the body's OWN rim samples, so the seam shares vertices
    const rim = rimU(s, sc);
    for (let i = 0; i < rim.length; i++) {
      const a = rim[i], b = rim[(i + 1) % rim.length];
      tri(g, [0, 0, 0], s.p(b, 0), s.p(a, 0), [0, -1, 0]);
      tri(g, [0, 1, 0], s.p(a, 1), s.p(b, 1), [0, 1, 0]);
    }
    return g;
  }, r, h, r);
}

export function sculptSphere(r = 0.5, sc = {}, seg = 36, rings = 24) {
  return handle(`sSph:${q4(r)}:${seg}:${rings}:${sculptKey(sc)}`, () => {
    const g = geo();
    sculptSurface(g, sphereLathe(r, seg, rings), sc);
    return g;
  }, r, r, r);
}
