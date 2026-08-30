// TRIANGLE SOUP BUILDERS — the lowest layer every mech mesh generator writes
// through. A `geo` is just parallel position/normal arrays; nothing here knows
// about primitives, keys or the registry.

export function geo() {
  return { positions: [], normals: [] };
}

// triangle with one flat (per-face) normal
export function tri(g, a, b, c, n) {
  g.positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  if (n) g.normals.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
}

// triangle with per-vertex (smooth) normals
export function triS(g, a, b, c, na, nb, nc) {
  g.positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  g.normals.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
}

export function quad(g, a, b, c, d, n) {
  tri(g, a, b, c, n);
  tri(g, a, c, d, n);
}

export function merge(...gs) {
  const out = geo();
  for (const g of gs) {
    out.positions.push(...g.positions);
    out.normals.push(...g.normals);
  }
  return out;
}

// flat normal of a CCW triangle; [0,0,0] when degenerate
export function faceNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
  const l = Math.hypot(x, y, z);
  return l < 1e-12 ? [0, 0, 0] : [x / l, y / l, z / l];
}

// quad with per-triangle flat normals — for walls that may not be exactly
// planar (a panel wall standing on a curved surface)
export function quadN(g, a, b, c, d) {
  tri(g, a, b, c, faceNormal(a, b, c));
  tri(g, a, c, d, faceNormal(a, c, d));
}
