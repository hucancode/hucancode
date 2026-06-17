// Column-major 4x4 matrices, allocation-free: every op writes into a caller-owned
// `out` Float32Array(16) so hot per-frame code can reuse scratch buffers instead
// of allocating a matrix per call. `multiply` is safe when out aliases a or b.

export const create = () => new Float32Array(16);

export function identity(out) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

// out = a * b (column-major). Reads a/b fully into locals first, so out may alias.
export function multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    out[c * 4 + 0] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

export function rotationX(out, a) {
  const c = Math.cos(a), s = Math.sin(a);
  out.fill(0);
  out[0] = 1; out[5] = c; out[6] = s; out[9] = -s; out[10] = c; out[15] = 1;
  return out;
}

export function rotationZ(out, a) {
  const c = Math.cos(a), s = Math.sin(a);
  out.fill(0);
  out[0] = c; out[1] = s; out[4] = -s; out[5] = c; out[10] = 1; out[15] = 1;
  return out;
}

export function translation(out, x, y, z) {
  identity(out);
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

export function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect; out[5] = f;
  out[10] = (far + near) * nf; out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}
