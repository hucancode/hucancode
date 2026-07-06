// "#rrggbb" string or 0xrrggbb number -> [r, g, b] floats in [0,1]
export function hexToRGB(hex) {
  if (typeof hex === "string") hex = parseInt(hex.replace("#", ""), 16);
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}
