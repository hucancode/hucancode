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
}
