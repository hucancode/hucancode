// Tiny rigid-transform math shared by the mech rig + assembly FX:
// 3x3 row-major rotation matrices (flat arrays of 9) + vec3 arrays.

export const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export const vAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vScale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const vLen = (a) => Math.hypot(a[0], a[1], a[2]);
export const vNorm = (a) => vScale(a, 1 / (vLen(a) || 1));
export const vDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vCross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export function m3Mul(a, b) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}

export const m3MulV = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

export const m3T = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

// general 3x3 inverse (adjugate / determinant) — works on rotation*scale
// composites, not just pure rotations
export function m3Inv(m) {
  const a = m[4] * m[8] - m[5] * m[7];
  const b = m[5] * m[6] - m[3] * m[8];
  const c = m[3] * m[7] - m[4] * m[6];
  const det = m[0] * a + m[1] * b + m[2] * c;
  const k = 1 / (det || 1);
  return [
    a * k, (m[2] * m[7] - m[1] * m[8]) * k, (m[1] * m[5] - m[2] * m[4]) * k,
    b * k, (m[0] * m[8] - m[2] * m[6]) * k, (m[2] * m[3] - m[0] * m[5]) * k,
    c * k, (m[1] * m[6] - m[0] * m[7]) * k, (m[0] * m[4] - m[1] * m[3]) * k,
  ];
}

export function m3Rot(axis, t) {
  const c = Math.cos(t), s = Math.sin(t);
  if (axis === "x") return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === "y") return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

export function m3AxisAngle(ax, ay, az, t) {
  const c = Math.cos(t), s = Math.sin(t), k = 1 - c;
  return [
    ax * ax * k + c, ax * ay * k - az * s, ax * az * k + ay * s,
    ay * ax * k + az * s, ay * ay * k + c, ay * az * k - ax * s,
    az * ax * k - ay * s, az * ay * k + ax * s, az * az * k + c,
  ];
}

// inverse-transpose of a row-major 3x3 = cofactor matrix / det
export function m3InvT(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  return [
    A / det, B / det, C / det,
    (c * h - b * i) / det, (a * i - c * g) / det, (b * g - a * h) / det,
    (b * f - c * e) / det, (c * d - a * f) / det, (a * e - b * d) / det,
  ];
}
