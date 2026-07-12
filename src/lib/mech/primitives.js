import { TAU } from "../math/scalar.js";
// PRIMITIVE ENGINE. A primitive call returns a HANDLE { key, m, t } — a reference to
// a shared UNIT MESH in the registry, plus an affine transform (3x3 row-major linear
// + translation). rotX/rotY/rotZ/translate COMPOSE INTO THE MATRIX; vertices are
// generated once per distinct key and the renderer draws ONE INSTANCED CALL per key.
//
// Shape params that survive into the KEY are RATIOS, so scaling width/height/depth
// is pure instance scale:
//   box             slope = FRACTION of height (0..1) + curve; key=(slope,curve)
//   coneCut         key = r1/r0 taper ratio
//   cutHemisphere   wall t and cut = FRACTIONS of r; key=(t,cut)
//   halfCylinderBox (arch box) box depth = FRACTION of r in the key; height
//                   is a free scale axis — same depth ratio => same mesh
//   cylinder/sphere/... key = segment counts only, size is all scale
//
// Origin conventions (per the catalog spec):
//   cylinder        origin = center of the BASE circle, body spans y 0..h
//   box             origin = center
//   sphere          origin = center
//   hemisphere      origin = center of the base circle, dome up (+Y)
//   halfCylinder    origin = center of the base half-circle; round side +Z,
//                   flat face on the XY plane, body spans y 0..h
//   halfCylinderBox halfCylinder + a box filling the flat (-Z) side; origin =
//                   center of the circle forming the cylinder

const q4 = (v) => +(+v).toFixed(4);

const REGISTRY = new Map();          // key -> { positions: F32, normals: F32 }

export function meshOf(key) {
  return REGISTRY.get(key);
}

// handle factory: register the unit mesh on first use, return an instance
// handle with a pure-scale starting matrix. `id` = shape identity INCLUDING
// size (key + creation scale; rotations don't change it) — consumers color
// by it so identical pieces match.
function H(key, gen, sx, sy, sz) {
  if (!REGISTRY.has(key)) {
    const g = gen();
    REGISTRY.set(key, {
      positions: new Float32Array(g.positions),
      normals: new Float32Array(g.normals),
    });
  }
  return {
    key,
    id: `${key}@${q4(sx)},${q4(sy)},${q4(sz)}`,
    m: [sx, 0, 0, 0, sy, 0, 0, 0, sz],
    t: [0, 0, 0],
  };
}

export function translate(g, x, y, z) {
  g.t[0] += x; g.t[1] += y; g.t[2] += z;
  return g;
}

function rotAxis(g, i, j, rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = g.m, t = g.t;
  for (let col = 0; col < 3; col++) {
    const a = m[i * 3 + col], b = m[j * 3 + col];
    m[i * 3 + col] = c * a - s * b;
    m[j * 3 + col] = s * a + c * b;
  }
  const a = t[i], b = t[j];
  t[i] = c * a - s * b;
  t[j] = s * a + c * b;
  return g;
}

// standard right-handed axis rotations, radians
export const rotX = (g, r) => rotAxis(g, 1, 2, r); // y,z
export const rotY = (g, r) => rotAxis(g, 2, 0, r); // z,x
export const rotZ = (g, r) => rotAxis(g, 0, 1, r); // x,y

// finalize a handle for the model item list
export function bake(g) {
  return { key: g.key, id: g.id, m: g.m.slice(), t: g.t.slice() };
}

function geo() {
  return { positions: [], normals: [] };
}

function tri(g, a, b, c, n) {
  g.positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  if (n) g.normals.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
}

// triangle with per-vertex (smooth) normals
function triS(g, a, b, c, na, nb, nc) {
  g.positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  g.normals.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
}

function quad(g, a, b, c, d, n) {
  tri(g, a, b, c, n);
  tri(g, a, c, d, n);
}

function merge(...gs) {
  const out = geo();
  for (const g of gs) {
    out.positions.push(...g.positions);
    out.normals.push(...g.normals);
  }
  return out;
}

// unit box (1x1x1, centered). slope = FRACTION of the height dropped at the
// top face's front (+Z) edge; curve bends the sloped top (-1 concave, 0
// straight, +1 convex) and only acts when slope > 0.
function genBox(slope, curve) {
  const g = geo();
  const x = 0.5, y = 0.5, z = 0.5, d = 1;
  const s = Math.max(0, Math.min(slope, 1 - 1e-4));
  const k = Math.max(-1, Math.min(1, curve));
  const N = s > 0 && k !== 0 ? 12 : 1;               // subdivide only when curved
  const yAt = (u) => y - s * (u - k * u * (1 - u));  // top profile, back -> front
  for (let i = 0; i < N; i++) {
    const u0 = i / N, u1 = (i + 1) / N;
    const z0 = -z + d * u0, z1 = -z + d * u1;
    const y0 = yAt(u0), y1 = yAt(u1);
    const l = Math.hypot(d / N, y1 - y0);
    const nt = [0, (z1 - z0) / l, -(y1 - y0) / l];   // strip normal, up + tilt
    quad(g, [-x, y1, z1], [x, y1, z1], [x, y0, z0], [-x, y0, z0], nt);           // top strip
    quad(g, [x, -y, z1], [x, -y, z0], [x, y0, z0], [x, y1, z1], [1, 0, 0]);      // +X wall strip
    quad(g, [-x, -y, z0], [-x, -y, z1], [-x, y1, z1], [-x, y0, z0], [-1, 0, 0]); // -X wall strip
  }
  quad(g, [-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]);
  quad(g, [-x, -y, z], [x, -y, z], [x, y - s, z], [-x, y - s, z], [0, 0, 1]);
  quad(g, [x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]);
  return g;
}

// arc sweep of a cylinder side + caps, shared by cylinder / halfCylinder.
//   a0..a1 = swept angle range. caps closes top/bottom with fans.
function cylBody(r, h, seg, a0, a1, caps = true) {
  const g = geo();
  for (let i = 0; i < seg; i++) {
    const t0 = a0 + ((a1 - a0) * i) / seg;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / seg;
    const c0 = Math.cos(t0), s0 = Math.sin(t0);
    const c1 = Math.cos(t1), s1 = Math.sin(t1);
    const p00 = [r * c0, 0, r * s0], p01 = [r * c1, 0, r * s1];
    const p10 = [r * c0, h, r * s0], p11 = [r * c1, h, r * s1];
    const n0 = [c0, 0, s0], n1 = [c1, 0, s1];
    triS(g, p00, p11, p01, n0, n1, n1);
    triS(g, p00, p10, p11, n0, n0, n1);
    if (caps) {
      tri(g, [0, h, 0], p11, p10, [0, 1, 0]);          // top fan
      tri(g, [0, 0, 0], p00, p01, [0, -1, 0]);         // bottom fan
    }
  }
  return g;
}

// unit truncated cone: base r=1 at y=0 to top r=q at y=1. q=0 -> true cone.
function genConeCut(q, seg) {
  const g = geo();
  const ny = 1 - q;                          // slope -> normal tilt (r0=1, h=1)
  const il = 1 / Math.hypot(1, ny);
  const nrm = (c, s) => [c * il, ny * il, s * il];
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * TAU, t1 = ((i + 1) / seg) * TAU;
    const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    const n0 = nrm(c0, s0), n1 = nrm(c1, s1);
    const p00 = [c0, 0, s0], p01 = [c1, 0, s1];
    if (q > 1e-6) {
      const p10 = [q * c0, 1, q * s0], p11 = [q * c1, 1, q * s1];
      triS(g, p00, p11, p01, n0, n1, n1);
      triS(g, p00, p10, p11, n0, n0, n1);
      tri(g, [0, 1, 0], p11, p10, [0, 1, 0]);            // top cap
    } else {
      triS(g, p00, [0, 1, 0], p01, n0, nrm((c0 + c1) / 2, (s0 + s1) / 2), n1);
    }
    tri(g, [0, 0, 0], p00, p01, [0, -1, 0]);             // base cap
  }
  return g;
}

// unit sphere / hemisphere lathe: phi sweeps 0 (pole) .. phiMax; base=true
// closes the last ring with a downward disc (hemisphere: phiMax = PI/2)
function genLathe(seg, rings, phiMax, base) {
  const g = geo();
  const pt = (u, v) => {
    const th = u * TAU, ph = v * phiMax;
    const sp = Math.sin(ph);
    return [Math.cos(th) * sp, Math.cos(ph), Math.sin(th) * sp];
  };
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const n00 = pt(i / seg, j / rings), n01 = pt((i + 1) / seg, j / rings);
      const n10 = pt(i / seg, (j + 1) / rings), n11 = pt((i + 1) / seg, (j + 1) / rings);
      triS(g, n00, n11, n10, n00, n11, n10);
      triS(g, n00, n01, n11, n00, n01, n11);
    }
  }
  if (base)
    for (let i = 0; i < seg; i++) {         // base disc, facing down
      const t0 = (i / seg) * TAU, t1 = ((i + 1) / seg) * TAU;
      tri(g, [0, 0, 0], [Math.cos(t0), 0, Math.sin(t0)], [Math.cos(t1), 0, Math.sin(t1)], [0, -1, 0]);
    }
  return g;
}

// unit cut hemisphere: shell r=1, wall t + cut plane = FRACTIONS of r
function genCutHemisphere(t, cut, seg, rings) {
  const g = geo();
  const ri = Math.max(0.05, 1 - t);
  const yc = Math.min(cut, ri - 1e-3);       // cut plane height (same for both surfaces)
  const band = (rad, out) => {
    const ph0 = Math.acos(Math.min(1, yc / rad));
    for (let j = 0; j < rings; j++) {
      const a = ph0 + ((Math.PI / 2 - ph0) * j) / rings;
      const b = ph0 + ((Math.PI / 2 - ph0) * (j + 1)) / rings;
      for (let i = 0; i < seg; i++) {
        const u0 = (i / seg) * TAU, u1 = ((i + 1) / seg) * TAU;
        const pt = (th, ph) => [Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph)];
        const n00 = pt(u0, a), n01 = pt(u1, a), n10 = pt(u0, b), n11 = pt(u1, b);
        const s = (n) => [n[0] * rad, n[1] * rad, n[2] * rad];
        const f = (n) => (out ? n : [-n[0], -n[1], -n[2]]);
        if (out) { // outer shell: front faces point outward
          triS(g, s(n00), s(n11), s(n10), f(n00), f(n11), f(n10));
          triS(g, s(n00), s(n01), s(n11), f(n00), f(n01), f(n11));
        } else {   // cavity: front faces point into the bowl
          triS(g, s(n00), s(n10), s(n11), f(n00), f(n10), f(n11));
          triS(g, s(n00), s(n11), s(n01), f(n00), f(n11), f(n01));
        }
      }
    }
  };
  band(1, true);                             // outer surface
  band(ri, false);                           // cavity surface, normals inward
  const ro = Math.sqrt(Math.max(0, 1 - yc * yc));
  const rr = Math.sqrt(Math.max(0, ri * ri - yc * yc));
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * TAU, t1 = ((i + 1) / seg) * TAU;
    const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    // lip ring at the opening (up) + base ring at y=0 (down)
    quad(g, [rr * c0, yc, rr * s0], [rr * c1, yc, rr * s1], [ro * c1, yc, ro * s1], [ro * c0, yc, ro * s0], [0, 1, 0]);
    quad(g, [ri * c1, 0, ri * s1], [ri * c0, 0, ri * s0], [c0, 0, s0], [c1, 0, s1], [0, -1, 0]);
  }
  return g;
}

// unit half cylinder: round side +Z, flat face on the XY plane, y 0..1.
// cylBody's cap fans already close the half-disc top/bottom for an arc sweep.
//   flat=false omits the closing rectangle (for the arch-box variant).
function genHalfCylinder(seg, flat) {
  const g = cylBody(1, 1, seg, 0, Math.PI);
  if (flat) quad(g, [-1, 0, 0], [-1, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, -1]);
  return g;
}

// unit arch box: half cylinder r=1 joined with a box on the -Z side reaching
// depth dp (= depth/r ratio). One solid D-block; internal wall omitted.
function genHalfCylinderBox(dp, seg) {
  const hc = genHalfCylinder(seg, false);
  const b = geo();
  const x = 1, z0 = -dp, z1 = 0, h = 1;
  quad(b, [x, 0, z1], [x, 0, z0], [x, h, z0], [x, h, z1], [1, 0, 0]);
  quad(b, [-x, 0, z0], [-x, 0, z1], [-x, h, z1], [-x, h, z0], [-1, 0, 0]);
  quad(b, [-x, h, z1], [x, h, z1], [x, h, z0], [-x, h, z0], [0, 1, 0]);
  quad(b, [-x, 0, z0], [x, 0, z0], [x, 0, z1], [-x, 0, z1], [0, -1, 0]);
  quad(b, [x, 0, z0], [-x, 0, z0], [-x, h, z0], [x, h, z0], [0, 0, -1]);
  return merge(hc, b);
}

// unit quarter cylinder: 1/4 disc plate, arc sweeps +X..+Z, corner origin.
// cylBody's cap fans close the quarter-disc top/bottom; only the two straight
// edge walls remain to emit here.
function genQuarterCylinder(seg) {
  const g = cylBody(1, 1, seg, 0, Math.PI / 2);
  quad(g, [0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, -1]);  // edge along +X
  quad(g, [0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0], [-1, 0, 0]);  // edge along +Z
  return g;
}

// unit gear RING: annulus (outer r=1, hole r=GEAR_HOLE) with trapezoidal
// teeth on the outer rim (To), the inner rim (Ti), or both; a count < 3 means
// that side is FLAT (circular). Body spans y 0..1 (origin = base center, like
// cylinder). Tooth depth is a FIXED fraction of r: outer teeth rise from root
// 1-d to tip 1, inner teeth hang from root GEAR_HOLE inward to its tip.
// Per tooth the pitch splits root gap / rising flank / tip flat / falling
// flank; both rims are sampled at the UNION of their profile breakpoints so
// the caps pair 1:1 across the ring.
const GEAR_DEPTH = 0.22;   // tooth depth, fraction of r
const GEAR_HOLE = 0.55;    // hole radius, fraction of r

function genGear(To, Ti) {
  const g = geo();
  const dp = GEAR_DEPTH, ri = GEAR_HOLE;
  // trapezoid rim radius at angle a: root over the gap, linear flanks, flat tip
  const trap = (a, T, root, tip) => {
    const u = ((a * T) / TAU) % 1;
    if (u < 0.25 || u >= 0.75) return root;
    if (u < 0.375) return root + ((u - 0.25) / 0.125) * (tip - root);
    if (u < 0.625) return tip;
    return tip + ((u - 0.625) / 0.125) * (root - tip);
  };
  const rOut = (a) => (To >= 3 ? trap(a, To, 1 - dp, 1) : 1);
  const rIn = (a) => (Ti >= 3 ? trap(a, Ti, ri, ri - dp) : ri);
  // angle stations: union of both rims' breakpoints (plain circle if both flat)
  const set = new Set();
  for (const T of [To, Ti])
    if (T >= 3)
      for (let i = 0; i < T; i++)
        for (const u of [0, 0.25, 0.375, 0.625, 0.75]) set.add((i + u) / T);
  if (!set.size) for (let i = 0; i < 24; i++) set.add(i / 24);
  const ang = [...set].sort((a, b) => a - b).map((f) => f * TAU);
  // wall strip along one rim segment; out=false flips the normal for the hole
  const wall = (p0, p1, out) => {
    const ex = p1[0] - p0[0], ez = p1[1] - p0[1], l = Math.hypot(ex, ez);
    if (l < 1e-9) return;
    const f = out ? 1 : -1;
    const n = [(f * ez) / l, 0, (-f * ex) / l];
    const b0 = [p0[0], 0, p0[1]], b1 = [p1[0], 0, p1[1]];
    const t0 = [p0[0], 1, p0[1]], t1 = [p1[0], 1, p1[1]];
    if (out) quad(g, b0, t0, t1, b1, n);
    else quad(g, b0, b1, t1, t0, n);
  };
  const P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  for (let j = 0; j < ang.length; j++) {
    const a0 = ang[j], a1 = ang[(j + 1) % ang.length];
    const o0 = P(rOut(a0), a0), o1 = P(rOut(a1), a1);
    const i0 = P(rIn(a0), a0), i1 = P(rIn(a1), a1);
    wall(o0, o1, true);
    wall(i0, i1, false);
    quad(g, [i0[0], 1, i0[1]], [i1[0], 1, i1[1]], [o1[0], 1, o1[1]], [o0[0], 1, o0[1]], [0, 1, 0]);   // top ring
    quad(g, [o0[0], 0, o0[1]], [o1[0], 0, o1[1]], [i1[0], 0, i1[1]], [i0[0], 0, i0[1]], [0, -1, 0]);  // bottom ring
  }
  return g;
}

// slope = FRACTION of height dropped at the top's front edge (0..1); curve
// -1 concave .. +1 convex, only acts on the slope.
export function box(w = 1, h = 1, d = 1, slope = 0, curve = 0) {
  const sp = q4(Math.max(0, Math.min(slope, 0.9999)));
  const k = q4(Math.max(-1, Math.min(1, curve)));
  return H(`box:${sp}:${k}`, () => genBox(sp, k), w, h, d);
}

export function cylinder(r = 0.5, h = 1, seg = 24) {
  return H(`cyl:${seg}`, () => cylBody(1, 1, seg, 0, TAU), r, h, r);
}

// truncated cone: only the taper RATIO r1/r0 shapes the mesh
export function coneCut(r0 = 0.5, r1 = 0.25, h = 1, seg = 24) {
  const q = q4(Math.max(0, r1 / r0));
  return H(`coneCut:${q}:${seg}`, () => genConeCut(q, seg), r0, h, r0);
}

// a cone IS coneCut(r, 0, ...)
export function cone(r = 0.5, h = 1, seg = 24) {
  return coneCut(r, 0, h, seg);
}

export function sphere(r = 0.5, seg = 24, rings = 16) {
  return H(`sph:${seg}:${rings}`, () => genLathe(seg, rings, Math.PI, false), r, r, r);
}

export function hemisphere(r = 0.5, seg = 24, rings = 8) {
  return H(`hemi:${seg}:${rings}`, () => genLathe(seg, rings, Math.PI / 2, true), r, r, r);
}

// socket shell — wall t and cut height are FRACTIONS of r
export function cutHemisphere(r = 0.5, t = 0.25, cut = 0.7, seg = 24, rings = 6) {
  const tp = q4(Math.max(0.02, Math.min(t, 0.95)));
  const cp = q4(Math.max(0, Math.min(cut, 0.98)));
  return H(`cutHemi:${tp}:${cp}:${seg}:${rings}`, () => genCutHemisphere(tp, cp, seg, rings), r, r, r);
}

export function halfCylinder(r = 0.5, h = 1, seg = 12) {
  return H(`halfCyl:${seg}`, () => genHalfCylinder(seg, true), r, h, r);
}

// arch box — the box depth enters the KEY as a FRACTION of r; height is a
// free scale axis, so all arch boxes with one depth ratio share a mesh
export function halfCylinderBox(r = 0.5, h = 1, depth = 0.5, seg = 12) {
  const dp = q4(depth / r);
  return H(`archBox:${dp}:${seg}`, () => genHalfCylinderBox(dp, seg), r, h, r);
}

export function quarterCylinder(r = 0.5, h = 0.3, seg = 8) {
  return H(`qCyl:${seg}`, () => genQuarterCylinder(seg), r, h, r);
}

// gear ring — teethOut / teethIn put teeth on the outer / inner rim; a count
// under 3 leaves that side flat (0,0 = plain ring). Tooth depth and hole
// radius are FIXED fractions of r (standardized teeth, lego-style), so the
// key is JUST the two counts: gears with identical teeth counts and sides
// share one mesh and draw as one instanced call. r/h are free scale axes.
export function gear(r = 0.5, h = 0.2, teethOut = 12, teethIn = 0) {
  const q = (t) => { const n = Math.round(t); return n >= 3 ? n : 0; };
  const To = q(teethOut), Ti = q(teethIn);
  return H(`gear:${To}:${Ti}`, () => genGear(To, Ti), r, h, r);
}
