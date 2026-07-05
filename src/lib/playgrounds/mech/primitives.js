// PRIMITIVE ENGINE — procedurally generated vertices (triangle soup), no SDF.
// Every builder returns { positions, normals } as plain JS arrays (xyz triplets,
// non-indexed), Y up. Curved sides get smooth normals, flat faces get face
// normals, so a low segment count still reads as machined metal.
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
//   boxCylinder     box with a cylinder standing on its top face; origin =
//                   center of the cylinder's base circle (= box top center).
//                   fit "in"  -> cylinder inscribed in the box footprint
//                   fit "out" -> cylinder circumscribes the box footprint

const TAU = Math.PI * 2;

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

// ---- in-place transforms (chainable) --------------------------------------

export function translate(g, x, y, z) {
  const p = g.positions;
  for (let i = 0; i < p.length; i += 3) { p[i] += x; p[i + 1] += y; p[i + 2] += z; }
  return g;
}

function rotAxis(g, i, j, rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  const p = g.positions, n = g.normals;
  for (const arr of [p, n]) {
    for (let k = 0; k < arr.length; k += 3) {
      const a = arr[k + i], b = arr[k + j];
      arr[k + i] = c * a - s * b;
      arr[k + j] = s * a + c * b;
    }
  }
  return g;
}

// standard right-handed axis rotations, radians
export const rotX = (g, r) => rotAxis(g, 1, 2, r); // y,z
export const rotY = (g, r) => rotAxis(g, 2, 0, r); // z,x
export const rotZ = (g, r) => rotAxis(g, 0, 1, r); // x,y

// ---- primitives ------------------------------------------------------------

// slope = absolute drop of the top face's front (+Z) edge, 0 = flat top.
// curve bends the sloped top: -1 = concave (scooped), 0 = straight,
// +1 = convex (bulged out, like a lego curved slope). only acts on the slope,
// so a flat-top box ignores it. clamped so the front wall never inverts.
export function box(w = 1, h = 1, d = 1, slope = 0, curve = 0) {
  const g = geo();
  const x = w / 2, y = h / 2, z = d / 2;
  const s = Math.max(0, Math.min(slope, h - 1e-4));
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
//   a0..a1 = swept angle range. addFlat closes a partial sweep with flat faces.
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
    triS(g, p00, p01, p11, n0, n1, n1);
    triS(g, p00, p11, p10, n0, n1, n0);
    if (caps) {
      tri(g, [0, h, 0], p10, p11, [0, 1, 0]);          // top fan
      tri(g, [0, 0, 0], p01, p00, [0, -1, 0]);         // bottom fan
    }
  }
  return g;
}

export function cylinder(r = 0.5, h = 1, seg = 24) {
  return cylBody(r, h, seg, 0, TAU);
}

// truncated cone (frustum): base radius r0 at y=0, top radius r1 at y=h,
// origin = base circle center. side normals tilt with the slope.
// r1 = 0 degenerates into a true cone (apex fan instead of a top cap).
export function coneCut(r0 = 0.5, r1 = 0.25, h = 1, seg = 24) {
  const g = geo();
  const ny = (r0 - r1) / h;                 // slope -> normal tilt
  const il = 1 / Math.hypot(1, ny);
  const nrm = (c, s) => [c * il, ny * il, s * il];
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * TAU, t1 = ((i + 1) / seg) * TAU;
    const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    const n0 = nrm(c0, s0), n1 = nrm(c1, s1);
    const p00 = [r0 * c0, 0, r0 * s0], p01 = [r0 * c1, 0, r0 * s1];
    if (r1 > 1e-6) {
      const p10 = [r1 * c0, h, r1 * s0], p11 = [r1 * c1, h, r1 * s1];
      triS(g, p00, p01, p11, n0, n1, n1);
      triS(g, p00, p11, p10, n0, n1, n0);
      tri(g, [0, h, 0], p10, p11, [0, 1, 0]);            // top cap
    } else {
      triS(g, p00, p01, [0, h, 0], n0, n1, nrm((c0 + c1) / 2, (s0 + s1) / 2));
    }
    tri(g, [0, 0, 0], p01, p00, [0, -1, 0]);             // base cap
  }
  return g;
}

export function cone(r = 0.5, h = 1, seg = 24) {
  return coneCut(r, 0, h, seg);
}

export function sphere(r = 0.5, seg = 24, rings = 16) {
  const g = geo();
  const pt = (u, v) => {
    const th = u * TAU, ph = v * Math.PI;
    const sp = Math.sin(ph);
    return [Math.cos(th) * sp, Math.cos(ph), Math.sin(th) * sp]; // unit
  };
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const n00 = pt(i / seg, j / rings), n01 = pt((i + 1) / seg, j / rings);
      const n10 = pt(i / seg, (j + 1) / rings), n11 = pt((i + 1) / seg, (j + 1) / rings);
      const s = (n) => [n[0] * r, n[1] * r, n[2] * r];
      triS(g, s(n00), s(n10), s(n11), n00, n10, n11);
      triS(g, s(n00), s(n11), s(n01), n00, n11, n01);
    }
  }
  return g;
}

// dome up, origin at base circle center, closed with a base disc
export function hemisphere(r = 0.5, seg = 24, rings = 8) {
  const g = geo();
  const pt = (u, v) => {
    const th = u * TAU, ph = (v * Math.PI) / 2; // 0 = pole, PI/2 = equator
    const sp = Math.sin(ph);
    return [Math.cos(th) * sp, Math.cos(ph), Math.sin(th) * sp];
  };
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const n00 = pt(i / seg, j / rings), n01 = pt((i + 1) / seg, j / rings);
      const n10 = pt(i / seg, (j + 1) / rings), n11 = pt((i + 1) / seg, (j + 1) / rings);
      const s = (n) => [n[0] * r, n[1] * r, n[2] * r];
      triS(g, s(n00), s(n10), s(n11), n00, n10, n11);
      triS(g, s(n00), s(n11), s(n01), n00, n11, n01);
    }
  }
  for (let i = 0; i < seg; i++) {           // base disc, facing down
    const t0 = (i / seg) * TAU, t1 = ((i + 1) / seg) * TAU;
    tri(g, [0, 0, 0], [r * Math.cos(t1), 0, r * Math.sin(t1)], [r * Math.cos(t0), 0, r * Math.sin(t0)], [0, -1, 0]);
  }
  return g;
}

// CUT HEMISPHERE — a hemisphere SHELL (wall thickness t) with the top sliced
// off at height cut*r, leaving a round opening: a socket that a ball can sit
// in. origin = base circle center, dome up. Outer + inner (cavity) spherical
// bands, a flat lip ring at the opening and a flat base ring at y=0.
export function cutHemisphere(r = 0.5, t = 0.12, cut = 0.7, seg = 24, rings = 6) {
  const g = geo();
  const ri = Math.max(0.05, r - t);
  const yc = Math.min(cut * r, ri - 1e-3);   // cut plane height (same for both surfaces)
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
        triS(g, s(n00), s(n10), s(n11), f(n00), f(n10), f(n11));
        triS(g, s(n00), s(n11), s(n01), f(n00), f(n11), f(n01));
      }
    }
  };
  band(r, true);                             // outer surface
  band(ri, false);                           // cavity surface, normals inward
  const ro = Math.sqrt(Math.max(0, r * r - yc * yc));
  const rr = Math.sqrt(Math.max(0, ri * ri - yc * yc));
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * TAU, t1 = ((i + 1) / seg) * TAU;
    const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    // lip ring at the opening (up) + base ring at y=0 (down)
    quad(g, [rr * c0, yc, rr * s0], [rr * c1, yc, rr * s1], [ro * c1, yc, ro * s1], [ro * c0, yc, ro * s0], [0, 1, 0]);
    quad(g, [ri * c1, 0, ri * s1], [ri * c0, 0, ri * s0], [r * c0, 0, r * s0], [r * c1, 0, r * s1], [0, -1, 0]);
  }
  return g;
}

// half cylinder: round side +Z (sweep 0..PI through +Z), flat face on the XZ...
// -> flat face is the XY plane at z=0, half-disc caps top/bottom.
//   flat=false omits the closing rectangle (for the box-joined variant).
export function halfCylinder(r = 0.5, h = 1, seg = 12, flat = true) {
  const g = cylBody(r, h, seg, 0, Math.PI, false);
  for (let i = 0; i < seg; i++) {           // half-disc caps
    const t0 = (i / seg) * Math.PI, t1 = ((i + 1) / seg) * Math.PI;
    const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    tri(g, [0, h, 0], [r * c0, h, r * s0], [r * c1, h, r * s1], [0, 1, 0]);
    tri(g, [0, 0, 0], [r * c1, 0, r * s1], [r * c0, 0, r * s0], [0, -1, 0]);
  }
  if (flat) quad(g, [r, 0, 0], [r, h, 0], [-r, h, 0], [-r, 0, 0], [0, 0, -1]);
  return g;
}

// half cylinder joined with a box on the missing (-Z) half. one solid D-block;
// the shared internal wall is omitted. origin = center of the base circle.
export function halfCylinderBox(r = 0.5, h = 1, depth = 0.5, seg = 12) {
  const hc = halfCylinder(r, h, seg, false);
  const b = geo();
  const x = r, z0 = -depth, z1 = 0;
  quad(b, [x, 0, z1], [x, 0, z0], [x, h, z0], [x, h, z1], [1, 0, 0]);
  quad(b, [-x, 0, z0], [-x, 0, z1], [-x, h, z1], [-x, h, z0], [-1, 0, 0]);
  quad(b, [-x, h, z1], [x, h, z1], [x, h, z0], [-x, h, z0], [0, 1, 0]);
  quad(b, [-x, 0, z0], [x, 0, z0], [x, 0, z1], [-x, 0, z1], [0, -1, 0]);
  quad(b, [x, 0, z0], [-x, 0, z0], [-x, h, z0], [x, h, z0], [0, 0, -1]);
  return merge(hc, b);
}

// quarter cylinder (1/4 disc plate): arc sweeps the +X..+Z quadrant, the two
// straight edges (along +X and +Z) are closed with flat faces. origin = the
// corner of the quarter at the base, thickness along +Y (y 0..h).
export function quarterCylinder(r = 0.5, h = 0.3, seg = 8) {
  const QP = Math.PI / 2;
  const g = cylBody(r, h, seg, 0, QP, false);
  for (let i = 0; i < seg; i++) {           // quarter-disc caps
    const t0 = (i / seg) * QP, t1 = ((i + 1) / seg) * QP;
    const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
    tri(g, [0, h, 0], [r * c0, h, r * s0], [r * c1, h, r * s1], [0, 1, 0]);
    tri(g, [0, 0, 0], [r * c1, 0, r * s1], [r * c0, 0, r * s0], [0, -1, 0]);
  }
  quad(g, [0, 0, 0], [0, h, 0], [r, h, 0], [r, 0, 0], [0, 0, -1]);  // edge along +X
  quad(g, [0, 0, 0], [0, 0, r], [0, h, r], [0, h, 0], [-1, 0, 0]);  // edge along +Z
  return g;
}

// box with a cylinder standing on its top face. origin = cylinder base center.
// box spans y -boxH..0; cylinder y 0..cylH. fit: "in" inscribed, "out"
// circumscribed (radius covers the corners). rOverride forces a radius.
export function boxCylinder(w = 1, boxH = 0.5, d = 1, cylH = 0.4, fit = "in", seg = 24, rOverride = 0) {
  const r = rOverride > 0 ? rOverride : fit === "out" ? Math.hypot(w, d) / 2 : Math.min(w, d) / 2;
  const b = translate(box(w, boxH, d), 0, -boxH / 2, 0);
  const c = cylinder(r, cylH, seg);
  return merge(b, c);
}

// ---- output ----------------------------------------------------------------

// finalize a geometry (or a merged list) into typed arrays for the GPU
export function bake(g) {
  return {
    positions: new Float32Array(g.positions),
    normals: new Float32Array(g.normals),
  };
}

export const PRIMS = { cylinder, cone, coneCut, box, sphere, hemisphere, cutHemisphere, halfCylinder, halfCylinderBox, boxCylinder, quarterCylinder };
