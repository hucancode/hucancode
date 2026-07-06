// Quaternion math for rigid rotations: [x, y, z, w] flat arrays, matching
// the row-major mat3 convention in mat3.js. Used wherever rotations must
// interpolate without the shear a component-wise matrix lerp introduces.

export const qNormalize = (q) => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};

// rotation matrix (row-major, PURE rotation) -> unit quaternion, Shepperd's
// branch on the largest diagonal term for numeric stability
export function qFromM3(m) {
  const tr = m[0] + m[4] + m[8];
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s, s / 4];
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2;
    q = [s / 4, (m[1] + m[3]) / s, (m[2] + m[6]) / s, (m[7] - m[5]) / s];
  } else if (m[4] > m[8]) {
    const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2;
    q = [(m[1] + m[3]) / s, s / 4, (m[5] + m[7]) / s, (m[2] - m[6]) / s];
  } else {
    const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2;
    q = [(m[2] + m[6]) / s, (m[5] + m[7]) / s, s / 4, (m[3] - m[1]) / s];
  }
  return qNormalize(q);
}

export function qToM3(q) {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, yy = y * y2, zz = z * z2;
  const xy = x * y2, xz = x * z2, yz = y * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    1 - yy - zz, xy - wz, xz + wy,
    xy + wz, 1 - xx - zz, yz - wx,
    xz - wy, yz + wx, 1 - xx - yy,
  ];
}

// shortest-arc spherical interpolation; falls back to a normalized lerp
// when the arc is tiny
export function qSlerp(a, b, t) {
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  let d = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let ka, kb;
  if (d > 0.9995) {
    ka = 1 - t; kb = t;
  } else {
    const th = Math.acos(Math.min(1, d)), s = Math.sin(th);
    ka = Math.sin((1 - t) * th) / s;
    kb = Math.sin(t * th) / s;
  }
  return qNormalize([
    a[0] * ka + bx * kb,
    a[1] * ka + by * kb,
    a[2] * ka + bz * kb,
    a[3] * ka + bw * kb,
  ]);
}
