// Matrices Float32Array(16), column-major (WebGL layout).

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  setScalar(s) {
    this.x = this.y = this.z = s;
    return this;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  clone() {
    return new Vec3(this.x, this.y, this.z);
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  multiply(v) {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    return this;
  }
  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  divide(v) {
    this.x /= v.x;
    this.y /= v.y;
    this.z /= v.z;
    return this;
  }
  divideScalar(s) {
    return this.multiplyScalar(1 / s);
  }
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    return this;
  }
  length() {
    return Math.hypot(this.x, this.y, this.z);
  }
  setLength(l) {
    return this.multiplyScalar(l / (this.length() || 1));
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  // column-major mat4 translation
  setFromMatrixPosition(m) {
    this.x = m[12];
    this.y = m[13];
    this.z = m[14];
    return this;
  }
  // full mat4 transform, perspective divide
  applyMatrix4(m) {
    const { x, y, z } = this;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    this.x = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    this.y = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    this.z = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return this;
  }
}

// Euler angles, XYZ order.
export class Euler {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(e) {
    this.x = e.x;
    this.y = e.y;
    this.z = e.z;
    return this;
  }
}

export class Color {
  constructor(r = 1, g = 1, b = 1) {
    if (g === undefined && b === undefined && typeof r === "number" && r > 1) {
      this.setHex(r);
    } else if (typeof r === "string") {
      this.setStyle(r);
    } else {
      this.r = r;
      this.g = g;
      this.b = b;
    }
  }
  setHex(hex) {
    hex = Math.floor(hex);
    this.r = ((hex >> 16) & 255) / 255;
    this.g = ((hex >> 8) & 255) / 255;
    this.b = (hex & 255) / 255;
    return this;
  }
  setStyle(s) {
    if (s[0] === "#") return this.setHex(parseInt(s.slice(1), 16));
    return this;
  }
  set(v) {
    if (typeof v === "number") return this.setHex(v);
    if (typeof v === "string") return this.setStyle(v);
    if (v && v.r !== undefined) {
      this.r = v.r;
      this.g = v.g;
      this.b = v.b;
    }
    return this;
  }
  copy(c) {
    this.r = c.r;
    this.g = c.g;
    this.b = c.b;
    return this;
  }
}


export * as mat4 from "../math/mat4.js";

export const DEG2RAD = Math.PI / 180;
