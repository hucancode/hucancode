#version 300 es
precision highp float;

// Procedural black grid with fog. Premultiplied alpha (blendFunc ONE,1-SRC).
// Line shape is measured in SCREEN-SPACE pixels (distance to nearest line via
// fwidth), so:
//   - core: a ~1px crisp black line, constant width at any distance. No glow.
//   - fade: cells that go sub-pixel-dense with distance thin out + dim.
//   - fog: planar distance from scene centre.
//   - camFade: view-space depth -> reacts to the perspective orbit camera.

in vec2 vXZ;
in float vDepth;

uniform float uStep;
uniform float uExt;
uniform float uOpacity;

out vec4 fragColor;

void main() {
  vec2 uv = vXZ / uStep;
  vec2 deriv = fwidth(uv) + 1e-5;

  // distance (in pixels) to the nearest grid line on each axis
  vec2 g = 0.5 - abs(fract(uv) - 0.5); // cells: 0 at a line, 0.5 at cell centre
  vec2 pix = g / deriv;
  float lp = min(pix.x, pix.y);        // nearest line, in pixels

  // line half-width in pixels: tightly capped so near lines stay thin (no solid
  // fat bands), and shrink toward a sub-pixel floor far away -> thinner at distance.
  float density = max(deriv.x, deriv.y);  // cells per pixel
  float halfPx = clamp(0.05 / density, 0.0, 0.01);

  float core = 1.0 - smoothstep(halfPx, halfPx + 1.0, lp); // crisp line, thins far

  // dim lines that become sub-pixel dense far away
  float fade = 1.0 - smoothstep(0.1, 1.2, density);

  // fog toward the far edge + camera-distance falloff
  float fog = 1.0 - smoothstep(uExt * 0.3, uExt, length(vXZ));
  float camFade = 1.0 - smoothstep(0.0, 8.0, vDepth);

  float a = core * fade * fog * camFade * uOpacity;

  vec3 col = vec3(0.0); // plain black lines, no glow
  fragColor = vec4(col * a, a); // premultiplied
}
