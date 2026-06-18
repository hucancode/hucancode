// Column-major 4x4 matrices, allocation-free: every op writes into a caller-owned
// `out` Float32Array(16) so hot per-frame code can reuse scratch buffers instead
// of allocating a matrix per call. `multiply` is safe when out aliases a or b.

export const create = () => new Float32Array(16);

export function identity(out) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

// out = a * b (column-major). Caches both a and b into locals first, so out may
// safely alias a, b, or both.
export function multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    out[c * 4 + 0] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    out[c * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    out[c * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    out[c * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
  }
  return out;
}

export function rotationX(out, a) {
  const c = Math.cos(a), s = Math.sin(a);
  out.fill(0);
  out[0] = 1; out[5] = c; out[6] = s; out[9] = -s; out[10] = c; out[15] = 1;
  return out;
}

export function rotationY(out, a) {
  const c = Math.cos(a), s = Math.sin(a);
  out.fill(0);
  out[0] = c; out[2] = -s; out[5] = 1; out[8] = s; out[10] = c; out[15] = 1;
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

export function copy(out, a) {
  out.set(a);
  return out;
}

// compose T * R(euler XYZ) * S from position / euler / scale objects ({x,y,z})
export function compose(out, pos, euler, scale) {
  const cx = Math.cos(euler.x), sx = Math.sin(euler.x);
  const cy = Math.cos(euler.y), sy = Math.sin(euler.y);
  const cz = Math.cos(euler.z), sz = Math.sin(euler.z);
  const r00 = cy * cz, r01 = -cy * sz, r02 = sy;
  const r10 = sx * sy * cz + cx * sz, r11 = -sx * sy * sz + cx * cz, r12 = -sx * cy;
  const r20 = -cx * sy * cz + sx * sz, r21 = cx * sy * sz + sx * cz, r22 = cx * cy;
  out[0] = r00 * scale.x; out[1] = r10 * scale.x; out[2] = r20 * scale.x; out[3] = 0;
  out[4] = r01 * scale.y; out[5] = r11 * scale.y; out[6] = r21 * scale.y; out[7] = 0;
  out[8] = r02 * scale.z; out[9] = r12 * scale.z; out[10] = r22 * scale.z; out[11] = 0;
  out[12] = pos.x; out[13] = pos.y; out[14] = pos.z; out[15] = 1;
  return out;
}

// decompose a TRS matrix into pos / euler(XYZ) / scale (inverse of compose)
export function decompose(m, pos, euler, scale) {
  let sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  const det =
    m[0] * (m[5] * m[10] - m[6] * m[9]) -
    m[4] * (m[1] * m[10] - m[2] * m[9]) +
    m[8] * (m[1] * m[6] - m[2] * m[5]);
  if (det < 0) sx = -sx;
  pos.x = m[12]; pos.y = m[13]; pos.z = m[14];
  scale.x = sx; scale.y = sy; scale.z = sz;
  const r00 = m[0] / sx, r01 = m[4] / sy, r02 = m[8] / sz;
  const r11 = m[5] / sy, r12 = m[9] / sz;
  const r21 = m[6] / sy, r22 = m[10] / sz;
  euler.y = Math.asin(Math.max(-1, Math.min(1, r02)));
  if (Math.abs(r02) < 0.9999999) {
    euler.x = Math.atan2(-r12, r22);
    euler.z = Math.atan2(-r01, r00);
  } else {
    euler.x = Math.atan2(r21, r11);
    euler.z = 0;
  }
  return m;
}

export function invert(out, a) {
  const m00 = a[0], m01 = a[1], m02 = a[2], m03 = a[3];
  const m10 = a[4], m11 = a[5], m12 = a[6], m13 = a[7];
  const m20 = a[8], m21 = a[9], m22 = a[10], m23 = a[11];
  const m30 = a[12], m31 = a[13], m32 = a[14], m33 = a[15];
  const b00 = m00 * m11 - m01 * m10, b01 = m00 * m12 - m02 * m10;
  const b02 = m00 * m13 - m03 * m10, b03 = m01 * m12 - m02 * m11;
  const b04 = m01 * m13 - m03 * m11, b05 = m02 * m13 - m03 * m12;
  const b06 = m20 * m31 - m21 * m30, b07 = m20 * m32 - m22 * m30;
  const b08 = m20 * m33 - m23 * m30, b09 = m21 * m32 - m22 * m31;
  const b10 = m21 * m33 - m23 * m31, b11 = m22 * m33 - m23 * m32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return identity(out);
  det = 1 / det;
  out[0] = (m11 * b11 - m12 * b10 + m13 * b09) * det;
  out[1] = (m02 * b10 - m01 * b11 - m03 * b09) * det;
  out[2] = (m31 * b05 - m32 * b04 + m33 * b03) * det;
  out[3] = (m22 * b04 - m21 * b05 - m23 * b03) * det;
  out[4] = (m12 * b08 - m10 * b11 - m13 * b07) * det;
  out[5] = (m00 * b11 - m02 * b08 + m03 * b07) * det;
  out[6] = (m32 * b02 - m30 * b05 - m33 * b01) * det;
  out[7] = (m20 * b05 - m22 * b02 + m23 * b01) * det;
  out[8] = (m10 * b10 - m11 * b08 + m13 * b06) * det;
  out[9] = (m01 * b08 - m00 * b10 - m03 * b06) * det;
  out[10] = (m30 * b04 - m31 * b02 + m33 * b00) * det;
  out[11] = (m21 * b02 - m20 * b04 - m23 * b00) * det;
  out[12] = (m11 * b07 - m10 * b09 - m12 * b06) * det;
  out[13] = (m00 * b09 - m01 * b07 + m02 * b06) * det;
  out[14] = (m31 * b01 - m30 * b03 - m32 * b00) * det;
  out[15] = (m20 * b03 - m21 * b01 + m22 * b00) * det;
  return out;
}

// normal matrix = transpose(inverse(a)), packed into a mat4 (upper-left 3x3 used)
export function normalFromMat4(out, a) {
  invert(out, a);
  const swap = (i, j) => { const t = out[i]; out[i] = out[j]; out[j] = t; };
  swap(1, 4); swap(2, 8); swap(6, 9);
  out[3] = out[7] = out[11] = out[12] = out[13] = out[14] = 0;
  out[15] = 1;
  return out;
}

// orientation matrix whose -Z faces from eye toward target (object "look at")
export function targetTo(out, eye, target, up) {
  let zx = eye.x - target.x, zy = eye.y - target.y, zz = eye.z - target.z;
  let zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl; zy /= zl; zz /= zl;
  let xx = up.y * zz - up.z * zy, xy = up.z * zx - up.x * zz, xz = up.x * zy - up.y * zx;
  let xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = xy; out[2] = xz; out[3] = 0;
  out[4] = yx; out[5] = yy; out[6] = yz; out[7] = 0;
  out[8] = zx; out[9] = zy; out[10] = zz; out[11] = 0;
  out[12] = eye.x; out[13] = eye.y; out[14] = eye.z; out[15] = 1;
  return out;
}

// view matrix = inverse of the targetTo orientation (transpose R, move eye)
export function lookAt(out, eye, target, up) {
  targetTo(out, eye, target, up);
  const xx = out[0], xy = out[1], xz = out[2];
  const yx = out[4], yy = out[5], yz = out[6];
  const zx = out[8], zy = out[9], zz = out[10];
  out[0] = xx; out[1] = yx; out[2] = zx;
  out[4] = xy; out[5] = yy; out[6] = zy;
  out[8] = xz; out[9] = yz; out[10] = zz;
  out[12] = -(xx * eye.x + xy * eye.y + xz * eye.z);
  out[13] = -(yx * eye.x + yy * eye.y + yz * eye.z);
  out[14] = -(zx * eye.x + zy * eye.y + zz * eye.z);
  return out;
}
