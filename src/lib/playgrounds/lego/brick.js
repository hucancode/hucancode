// Parametric LEGO part builder + notation.
//
// NOTATION (makePart): describe a part by ...
//   size:   [sx, sz]            bounding footprint in studs (X by Z)
//   h:      height in world units (plate 0.4, brick 1.2)
//   faces:  per face surface  "flat" | "male" | "female"
//             male   = studs protrude out of that face
//             female = clutch tubes / anti-stud recess
//           faces = { top, bottom, front(+Z), back(-Z), left(-X), right(+X) }
//   studMask: [x0,z0,x1,z1] inclusive stud-index box, limits top/bottom studs
//   bevel:  sculpt one bounding-box edge -> slope/curve
//             { edge:"front|back|left|right", side:"top|bottom",
//               kind:"flat|round", depth: studs, drop: 0..1 }
//   cuts:   ["front-left","front-right",...] + cutDepth   vertical corner chamfer
//   round:  true (+ radius) for cylindrical 1x1 parts
//
// Stud pitch = 1 world unit. Body centered at origin; top at +h/2.
// Legacy makeBrick(spec) maps the old `type` presets onto makePart.

import {
  Geometry, boxGeometry, cylinderGeometry, mergeGeometries,
} from "$lib/engine/index.js";

export const PLATE_H = 0.4;
export const BRICK_H = 1.2;

export const TYPE_HEIGHT = {
  brick: BRICK_H, plate: PLATE_H, tile: PLATE_H,
  slope: BRICK_H, curve: BRICK_H, wedge: PLATE_H,
  wing: PLATE_H, round: BRICK_H, sidestud: BRICK_H,
};

export const TYPES = Object.keys(TYPE_HEIGHT);

const STUD_R = 0.3, STUD_H = 0.2, TUBE_R = 0.3;

// ---- low-level geometry helpers -------------------------------------------

// Geometry (position/normal/uv) from a triangle list, flat normals.
// outward=true reorients each tri so its normal points away from the origin
// (valid for bodies that are star-convex about the centered origin) — removes
// all winding guesswork since lighting is one-sided.
function fromTris(tris, outward = true) {
  const pos = [], nor = [], uv = [];
  for (let [a, b, c] of tris) {
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    let vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (outward) {
      const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
      if (nx * cx + ny * cy + nz * cz < 0) { [b, c] = [c, b]; nx = -nx; ny = -ny; nz = -nz; }
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); nor.push(nx, ny, nz); uv.push(0, 0); }
  }
  return new Geometry()
    .setAttribute("position", new Float32Array(pos), 3)
    .setAttribute("normal", new Float32Array(nor), 3)
    .setAttribute("uv", new Float32Array(uv), 2);
}

function quad(a, b, c, d) { return [[a, b, c], [a, c, d]]; }

// rotate position+normal of a geometry in place (axis: "x"|"y"|"z")
function rotateGeo(g, axis, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (const key of ["position", "normal"]) {
    const a = g.attributes[key].array;
    for (let i = 0; i < a.length; i += 3) {
      const x = a[i], y = a[i + 1], z = a[i + 2];
      if (axis === "y") { a[i] = c * x + s * z; a[i + 2] = -s * x + c * z; }
      else if (axis === "z") { a[i] = c * x - s * y; a[i + 1] = s * x + c * y; }
      else { a[i + 1] = c * y - s * z; a[i + 2] = s * y + c * z; }
    }
  }
  return g;
}

const stud = (R = STUD_R, BH = STUD_H, radial = 20) => cylinderGeometry(R, R, BH, radial);

// ---- body from a 2D profile extruded along an axis -------------------------
// profile: list of [u,v] forming the cross-section; extruded by `len` along
// `axis`. (u,v) map: axis X -> (z,y); axis Z -> (x,y). Auto-outward normals.
function extrude(profile, axis, len) {
  const hl = len / 2;
  const at = (u, v, s) => axis === "x" ? [s, v, u] : [u, v, s];   // s = ±hl along axis
  const tris = [];
  // two end caps (triangle fan)
  for (let i = 1; i < profile.length - 1; i++) {
    const a = profile[0], b = profile[i], c = profile[i + 1];
    tris.push([at(a[0], a[1], hl), at(b[0], b[1], hl), at(c[0], c[1], hl)]);
    tris.push([at(a[0], a[1], -hl), at(b[0], b[1], -hl), at(c[0], c[1], -hl)]);
  }
  // walls
  for (let i = 0; i < profile.length; i++) {
    const p = profile[i], q = profile[(i + 1) % profile.length];
    tris.push(...quad(at(p[0], p[1], -hl), at(q[0], q[1], -hl), at(q[0], q[1], hl), at(p[0], p[1], hl)));
  }
  return fromTris(tris);
}

// box footprint profile (rectangle in (u,v)) with one corner sculpted per bevel
function bevelProfile(uHalf, h, bevel) {
  const hu = uHalf, hh = h / 2;
  // base rectangle corners: (-hu,-hh)(hu,-hh)(hu,hh)(-hu,hh)
  if (!bevel) return [[-hu, -hh], [hu, -hh], [hu, hh], [-hu, hh]];
  const dep = Math.max(0, Math.min(bevel.depthU, 2 * hu));        // consumed along u (world)
  const drop = Math.max(0, Math.min(bevel.drop ?? 1, 1)) * h;     // descent along v
  const far = bevel.far;                                          // sculpt at +u (true) or -u
  const top = bevel.side !== "bottom";                            // sculpt top (v+) or bottom (v-)
  const uEdge = far ? hu : -hu;                                   // the vertical wall being cut
  const uIn = far ? hu - dep : -hu + dep;                         // where the cut meets the flat
  const vFlat = top ? hh : -hh;                                   // the flat face level kept
  const vCut = top ? hh - drop : -hh + drop;                      // wall level the bevel reaches
  // walk rectangle CCW, replacing the sculpted corner with bevel point(s)
  const N = bevel.kind === "round" ? 8 : 1;
  const arc = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    if (bevel.kind === "round") {
      // quarter circle from (uIn,vFlat) to (uEdge,vCut), convex outward
      const a = (t * Math.PI) / 2;
      const u = uIn + (uEdge - uIn) * Math.sin(a);
      const v = vFlat + (vCut - vFlat) * (1 - Math.cos(a));
      arc.push([u, v]);
    } else {
      arc.push([uIn + (uEdge - uIn) * t, vFlat + (vCut - vFlat) * t]);
    }
  }
  // assemble polygon (order matters only for fan; auto-outward fixes normals)
  // corners not sculpted:
  const c_mm = [-hu, -hh], c_pm = [hu, -hh], c_pp = [hu, hh], c_mp = [-hu, hh];
  if (top && far)   return [c_mm, c_pm, ...arc.slice().reverse(), c_mp];           // sculpt (+u,+v)
  if (top && !far)  return [c_mm, c_pm, c_pp, ...arc];                              // sculpt (-u,+v)
  if (!top && far)  return [c_mm, ...arc, c_pp, c_mp];                              // sculpt (+u,-v)
  return [...arc.slice().reverse(), c_pm, c_pp, c_mp];                              // sculpt (-u,-v)
}

// vertical prism from a footprint polygon (XZ, world coords)
function prismBody(poly, h) {
  const hh = h / 2, tris = [];
  for (let i = 1; i < poly.length - 1; i++) {
    const a = poly[0], b = poly[i], c = poly[i + 1];
    tris.push([[a[0], hh, a[1]], [b[0], hh, b[1]], [c[0], hh, c[1]]]);
    tris.push([[a[0], -hh, a[1]], [b[0], -hh, b[1]], [c[0], -hh, c[1]]]);
  }
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    tris.push(...quad([p[0], -hh, p[1]], [q[0], -hh, q[1]], [q[0], hh, q[1]], [p[0], hh, p[1]]));
  }
  return fromTris(tris);
}

function inPoly(px, pz, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// a stud sits on a cell only if the WHOLE 1x1 cell is on the footprint — its 4
// corners (nudged just inside) must all be inside the polygon. Stops studs from
// overhanging a diagonal chamfer (wedge/wing).
function cellOnPoly(x, z, poly) {
  const e = 0.49;
  for (const [dx, dz] of [[-e, -e], [e, -e], [e, e], [-e, e]])
    if (!inPoly(x + dx, z + dz, poly)) return false;
  return true;
}

// wedge: square footprint with one front corner cut to the opposite back corner
function wedgePoly(sx, sz, hand) {
  const hw = sx / 2, hd = sz / 2;
  return hand === "left"
    ? [[-hw, -hd], [hw, -hd], [-hw, hd]]   // keep front-left
    : [[-hw, -hd], [hw, -hd], [hw, hd]];   // keep front-right
}

// corner-cut footprint: rectangle with named corners chamfered by `c` studs
function cutPoly(sx, sz, cuts, c) {
  const hw = sx / 2, hd = sz / 2;          // +Z front, +X right
  c = Math.min(c, sx, sz);
  const has = (n) => cuts.includes(n);
  const pts = [];
  // back-left
  has("back-left") ? pts.push([-hw + c, -hd], [-hw, -hd + c]) : pts.push([-hw, -hd]);
  // back-right
  has("back-right") ? pts.push([hw - c, -hd], [hw, -hd + c]) : pts.push([hw, -hd]);
  // front-right
  has("front-right") ? pts.push([hw, hd - c], [hw - c, hd]) : pts.push([hw, hd]);
  // front-left
  has("front-left") ? pts.push([-hw + c, hd], [-hw, hd - c]) : pts.push([-hw, hd]);
  return pts;
}

// ---- studs / tubes ---------------------------------------------------------

// male studs on top (dir +1) or bottom (dir -1) of an sx*sz grid, culled to a
// stud-index mask and/or footprint polygon and/or a per-cell keep() test.
function faceStuds(sx, sz, h, dir, { mask, poly, keep, R = STUD_R, BH = STUD_H } = {}) {
  const out = [], y = dir * (h / 2 + BH / 2);
  for (let i = 0; i < sx; i++) {
    for (let j = 0; j < sz; j++) {
      if (mask && (i < mask[0] || j < mask[1] || i > mask[2] || j > mask[3])) continue;
      const x = i - (sx - 1) / 2, z = j - (sz - 1) / 2;
      if (poly && !cellOnPoly(x, z, poly)) continue;
      if (keep && !keep(x, z, i, j)) continue;
      const s = stud(R, BH);
      if (dir < 0) rotateGeo(s, "x", Math.PI);
      out.push(s.translate(x, y, z));
    }
  }
  return out;
}

function tubeGrid(sx, sz, h, R = TUBE_R) {
  const out = [], tubeH = h * 0.7, y = -h / 2 + tubeH / 2;
  for (let i = 0; i < sx - 1; i++)
    for (let j = 0; j < sz - 1; j++)
      out.push(cylinderGeometry(R, R, tubeH, 14).translate(i - (sx - 2) / 2, y, j - (sz - 2) / 2));
  return out;
}

// side male studs along a face: face in {front,back,left,right}
function sideStuds(face, sx, sz, h, R = STUD_R, BH = STUD_H) {
  const out = [], hw = sx / 2, hd = sz / 2;
  const mk = (x, z, axis, ang) => {
    const s = rotateGeo(stud(R, BH), axis, ang);
    return s.translate(x, 0, z);
  };
  if (face === "front")  for (let i = 0; i < sx; i++) out.push(mk(i - (sx - 1) / 2, hd + BH / 2, "x", -Math.PI / 2));
  if (face === "back")   for (let i = 0; i < sx; i++) out.push(mk(i - (sx - 1) / 2, -hd - BH / 2, "x", Math.PI / 2));
  if (face === "right")  for (let j = 0; j < sz; j++) out.push(mk(hw + BH / 2, j - (sz - 1) / 2, "z", -Math.PI / 2));
  if (face === "left")   for (let j = 0; j < sz; j++) out.push(mk(-hw - BH / 2, j - (sz - 1) / 2, "z", Math.PI / 2));
  return out;
}

// ---- main entry: notation --------------------------------------------------

export function makePart(spec) {
  const [sx, sz] = spec.size ?? [2, 2];
  const h = Math.max(0.1, spec.h ?? BRICK_H);
  const f = {
    top: "flat", bottom: "flat", front: "flat", back: "flat", left: "flat", right: "flat",
    ...(spec.faces ?? {}),
  };
  const hw = sx / 2, hd = sz / 2;
  let body, poly = null;

  if (spec.round) {
    const r = spec.radius ?? Math.max(sx, sz) / 2;
    body = [cylinderGeometry(r, r, h, 24)];
  } else if (spec.footprint) {                       // explicit footprint polygon
    poly = spec.footprint;
    body = [prismBody(poly, h)];
  } else if (spec.cuts && spec.cuts.length) {
    poly = cutPoly(sx, sz, spec.cuts, spec.cutDepth ?? 1);
    body = [prismBody(poly, h)];
  } else if (spec.bevel) {
    const b = spec.bevel;
    const alongX = b.edge === "front" || b.edge === "back";   // edge runs along X -> extrude X
    const far = b.edge === "front" || b.edge === "right";     // +u side
    const uHalf = alongX ? hd : hw;                           // profile u-half (z or x)
    const prof = bevelProfile(uHalf, h, { ...b, depthU: b.depth, far });
    body = [extrude(prof, alongX ? "x" : "z", alongX ? sx : sz)];
  } else {
    body = [boxGeometry(sx, h, sz)];
  }

  const parts = [...body];

  // top-edge bevel removes the studs over the sculpted rows (only top bevels)
  let topKeep = null;
  if (spec.bevel && (spec.bevel.side ?? "top") !== "bottom") {
    const b = spec.bevel, dep = b.depth;
    if (b.edge === "front") topKeep = (x, z) => z <= hd - dep - 1e-6;
    else if (b.edge === "back") topKeep = (x, z) => z >= -hd + dep + 1e-6;
    else if (b.edge === "right") topKeep = (x, z) => x <= hw - dep - 1e-6;
    else if (b.edge === "left") topKeep = (x, z) => x >= -hw + dep + 1e-6;
  }

  // surfaces
  if (f.top === "male")
    parts.push(...faceStuds(sx, sz, h, +1, { mask: spec.studMaskTop ?? spec.studMask, poly, keep: topKeep }));
  if (f.bottom === "male")
    parts.push(...faceStuds(sx, sz, h, -1, { mask: spec.studMaskBottom ?? spec.studMask, poly }));
  if (f.bottom === "female" && sx > 1 && sz > 1 && !spec.round && !spec.cuts && !spec.bevel)
    parts.push(...tubeGrid(sx, sz, h));
  for (const face of ["front", "back", "left", "right"])
    if (f[face] === "male") parts.push(...sideStuds(face, sx, sz, h));

  return mergeGeometries(parts);
}

// ---- legacy preset adapter -------------------------------------------------
// maps the old `type` specs (sx/sz/height/...) onto makePart notation.

export function makeBrick(spec) {
  const type = spec.type ?? "brick";
  const sx = Math.max(1, Math.round(spec.studsX ?? spec.sx ?? 2));
  const sz = Math.max(1, Math.round(spec.studsZ ?? spec.sz ?? 2));
  const h = Math.max(0.1, spec.height ?? spec.h ?? TYPE_HEIGHT[type] ?? BRICK_H);
  const studs = spec.studs ?? type !== "tile";
  const lipDrop = (hh) => (hh - Math.min(PLATE_H, hh * 0.4)) / hh;   // slope back-lip ratio

  switch (type) {
    case "round":
      return makePart({ size: [sx, sz], h, round: true, radius: spec.radius,
        faces: { top: studs ? "male" : "flat" } });

    case "slope": {
      // normal: slanted top, studs on the high back row.
      // inverted: flat top (full studs up) + slanted underside + down-stud foot.
      if (spec.inverted) {
        return makePart({
          size: [sx, sz], h,
          faces: { top: studs ? "male" : "flat", bottom: studs ? "male" : "flat" },
          bevel: { edge: "back", side: "bottom", kind: "flat", depth: sz - 1, drop: lipDrop(h) },
          // down-studs only on the 1xSX flat foot at +Z (last z-row)
          studMaskBottom: [0, sz - 1, sx - 1, sz - 1],
        });
      }
      return makePart({
        size: [sx, sz], h,
        faces: { top: studs ? "male" : "flat" },
        bevel: { edge: "front", side: "top", kind: "flat", depth: sz - 1, drop: lipDrop(h) },
      });
    }

    case "curve":
      return makePart({
        size: [sx, sz], h,
        faces: { top: studs ? "male" : "flat" },
        bevel: { edge: "front", side: "top", kind: "round", depth: spec.curveDepth ?? 1, drop: 1 },
      });

    case "wedge":
      return makePart({
        size: [sx, sz], h,
        faces: { top: studs ? "male" : "flat" },
        footprint: wedgePoly(sx, sz, spec.hand ?? "right"),
      });

    case "wing":
      return makePart({
        size: [sx, sz], h, cutDepth: spec.cut ?? 1,
        faces: { top: studs ? "male" : "flat" },
        cuts: ["front-left", "front-right"],
      });

    case "sidestud":
      return makePart({
        size: [1, 1], h,
        faces: { top: studs ? "male" : "flat", front: "male" },
      });

    case "tile":
      return makePart({ size: [sx, sz], h, faces: { top: "flat", bottom: "flat" } });

    default: // brick / plate
      return makePart({
        size: [sx, sz], h,
        faces: { top: studs ? "male" : "flat", bottom: "female" },
      });
  }
}
