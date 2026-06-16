#version 300 es
precision highp float;

// Procedural black grid with fog, on the x/y ground plane. Premultiplied alpha
// (blendFunc ONE,1-SRC). Line shape is measured in SCREEN-SPACE pixels (distance
// to nearest line via fwidth), so:
//   - core: a crisp black line, constant width at any distance. No glow.
//   - fade: cells that go sub-pixel-dense with distance thin out + dim.
//   - fog: planar distance from scene centre.
//   - camFade: view-space depth -> reacts to the perspective orbit camera.
//   - reveal: a radial wipe-in from the origin, so the grid grows out as a disc
//     rather than fading the whole quad uniformly.
//
// TWO grids overlaid: MAJOR (spacing uStep, thicker, full strength) and MINOR
// (spacing uStep/uMinorDiv, thinner, dimmer). Each has its own radial reveal
// (uReveal for major, uRevealMinor for minor) so the minor grid wipes in LAGGING
// behind the major one.

in vec2 vXY;
in float vDepth;

uniform float uStep;        // major line spacing
uniform float uMinorDiv;    // minor cells per major cell (minor step = uStep/uMinorDiv)
uniform float uExt;
uniform float uOpacity;
uniform float uReveal;      // major wipe: 0 = hidden, 1 = fully in
uniform float uRevealMinor; // minor wipe (lags behind uReveal)

out vec4 fragColor;

const float MINOR_DIM = 0.45; // minor lines dimmer than major

// Crisp screen-space line coverage for a grid of the given spacing.
// halfCap bounds the line half-width (px) -> bigger = thicker line.
float lineCoverage(float step, float halfCap) {
  vec2 uv = vXY / step;
  vec2 deriv = fwidth(uv) + 1e-5;
  vec2 g = 0.5 - abs(fract(uv) - 0.5); // 0 at a line, 0.5 at cell centre
  vec2 pix = g / deriv;
  float lp = min(pix.x, pix.y);        // nearest line, in pixels
  float density = max(deriv.x, deriv.y);
  float halfPx = clamp(halfCap / density, 0.0, halfCap * 0.2);
  float core = 1.0 - smoothstep(halfPx, halfPx + 1.0, lp);
  float fade = 1.0 - smoothstep(0.1, 1.2, density); // dim when sub-pixel dense
  return core * fade;
}

// Radial disc mask of radius reveal*uExt growing from the origin.
float revealMask(float reveal, float dist) {
  float r = reveal * uExt;
  return 1.0 - smoothstep(r - 1.5, r, dist);
}

void main() {
  float dist = length(vXY);

  float major = lineCoverage(uStep, 0.05) * revealMask(uReveal, dist);
  float minorStep = uStep / max(uMinorDiv, 1.0);
  float minor = lineCoverage(minorStep, 0.03) * MINOR_DIM * revealMask(uRevealMinor, dist);

  float lines = max(major, minor); // major wins where they coincide (thicker)

  float fog = 1.0 - smoothstep(uExt * 0.3, uExt, dist);
  float camFade = 1.0 - smoothstep(0.0, 8.0, vDepth);

  float a = lines * fog * camFade * uOpacity;

  vec3 col = vec3(0.0); // plain black lines, no glow
  fragColor = vec4(col * a, a); // premultiplied
}
