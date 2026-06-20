// Non-indexed geometry builders (box / cylinder / plane) + translate + merge.
// Non-indexed so merge() is plain concatenation.

export class Geometry {
  constructor() {
    this.attributes = {};
    this.index = null;
    this.drawRange = null;
    this.dynamic = false; // hint: per-frame attribute/index re-uploads expected
  }
  setAttribute(name, array, itemSize) {
    this.attributes[name] = { array, itemSize, count: array.length / itemSize, needsUpdate: false };
    return this;
  }
  getAttribute(name) {
    return this.attributes[name];
  }
  setIndex(array) {
    this.index = { array, needsUpdate: false };
    return this;
  }
  // restrict draw to [start, start+count). indexed -> index-buffer
  // offsets/counts; else vertex offsets/counts.
  setDrawRange(start, count) {
    this.drawRange = { start, count };
    return this;
  }
  get vertexCount() {
    return this.attributes.position.count;
  }
  translate(x, y, z) {
    const p = this.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      p[i] += x;
      p[i + 1] += y;
      p[i + 2] += z;
    }
    return this;
  }
  dispose() {}
}

// box, non-indexed, faces order: +X, -X, +Y, -Y, +Z, -Z (6 verts each)
export function boxGeometry(w = 1, h = 1, d = 1) {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  // per face: normal + 4 corners wound CCW
  const faces = [
    { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
    { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
  ];
  const pos = [], nor = [], uv = [];
  const tri = [0, 1, 2, 0, 2, 3];
  const uvc = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const f of faces) {
    for (const k of tri) {
      pos.push(f.v[k][0], f.v[k][1], f.v[k][2]);
      nor.push(f.n[0], f.n[1], f.n[2]);
      uv.push(uvc[k][0], uvc[k][1]);
    }
  }
  return new Geometry()
    .setAttribute("position", new Float32Array(pos), 3)
    .setAttribute("normal", new Float32Array(nor), 3)
    .setAttribute("uv", new Float32Array(uv), 2);
}

// cylinder along Y, non-indexed (side + both caps), flat-ish normals
export function cylinderGeometry(rTop = 1, rBottom = 1, height = 1, radial = 16) {
  const hh = height / 2;
  const pos = [], nor = [], uv = [];
  const push = (x, y, z, nx, ny, nz, u, v) => {
    pos.push(x, y, z); nor.push(nx, ny, nz); uv.push(u, v);
  };
  for (let i = 0; i < radial; i++) {
    const a0 = (i / radial) * Math.PI * 2;
    const a1 = ((i + 1) / radial) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const tx0 = c0 * rTop, tz0 = s0 * rTop, bx0 = c0 * rBottom, bz0 = s0 * rBottom;
    const tx1 = c1 * rTop, tz1 = s1 * rTop, bx1 = c1 * rBottom, bz1 = s1 * rBottom;
    // side normal uses mid angle, ignores slope
    const nA = [c0, 0, s0], nB = [c1, 0, s1];
    push(bx0, -hh, bz0, nA[0], nA[1], nA[2], i / radial, 0);
    push(bx1, -hh, bz1, nB[0], nB[1], nB[2], (i + 1) / radial, 0);
    push(tx1, hh, tz1, nB[0], nB[1], nB[2], (i + 1) / radial, 1);
    push(bx0, -hh, bz0, nA[0], nA[1], nA[2], i / radial, 0);
    push(tx1, hh, tz1, nB[0], nB[1], nB[2], (i + 1) / radial, 1);
    push(tx0, hh, tz0, nA[0], nA[1], nA[2], i / radial, 1);
    push(0, hh, 0, 0, 1, 0, 0.5, 0.5);
    push(tx0, hh, tz0, 0, 1, 0, 0.5, 0.5);
    push(tx1, hh, tz1, 0, 1, 0, 0.5, 0.5);
    push(0, -hh, 0, 0, -1, 0, 0.5, 0.5);
    push(bx1, -hh, bz1, 0, -1, 0, 0.5, 0.5);
    push(bx0, -hh, bz0, 0, -1, 0, 0.5, 0.5);
  }
  return new Geometry()
    .setAttribute("position", new Float32Array(pos), 3)
    .setAttribute("normal", new Float32Array(nor), 3)
    .setAttribute("uv", new Float32Array(uv), 2);
}

// plane on XY plane (z=0), normal +Z, uv 0..1
export function planeGeometry(w = 1, h = 1) {
  const hx = w / 2, hy = h / 2;
  const pos = [-hx, -hy, 0, hx, -hy, 0, hx, hy, 0, -hx, -hy, 0, hx, hy, 0, -hx, hy, 0];
  const nor = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  const uv = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
  return new Geometry()
    .setAttribute("position", new Float32Array(pos), 3)
    .setAttribute("normal", new Float32Array(nor), 3)
    .setAttribute("uv", new Float32Array(uv), 2);
}

// concatenate non-indexed geometries sharing same attribute set
export function mergeGeometries(geos) {
  const names = Object.keys(geos[0].attributes);
  const out = new Geometry();
  for (const name of names) {
    const itemSize = geos[0].attributes[name].itemSize;
    let total = 0;
    for (const g of geos) total += g.attributes[name].array.length;
    const arr = new Float32Array(total);
    let off = 0;
    for (const g of geos) {
      arr.set(g.attributes[name].array, off);
      off += g.attributes[name].array.length;
    }
    out.setAttribute(name, arr, itemSize);
  }
  return out;
}
