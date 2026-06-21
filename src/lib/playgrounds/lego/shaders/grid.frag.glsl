#version 300 es
precision highp float;

// Ground grid on XZ. Screen-space line coverage (distance to nearest line via
// fwidth); major + dimmer minor overlaid, faded by distance fog + camera depth.

in vec2 vXZ;
in float vDepth;

uniform float uStep;       // major line spacing
uniform float uMinorDiv;   // minor cells per major cell
uniform float uExt;
uniform float uOpacity;
uniform vec3 uColor;

out vec4 fragColor;

const float MINOR_DIM = 0.4;

float lineCoverage(float step, float halfCap) {
  vec2 uv = vXZ / step;
  vec2 deriv = fwidth(uv) + 1e-5;
  vec2 g = 0.5 - abs(fract(uv) - 0.5);
  vec2 pix = g / deriv;
  float lp = min(pix.x, pix.y);
  float density = max(deriv.x, deriv.y);
  float halfPx = clamp(halfCap / density, 0.0, halfCap * 0.2);
  float core = 1.0 - smoothstep(halfPx, halfPx + 1.0, lp);
  float fade = 1.0 - smoothstep(0.1, 1.2, density);
  return core * fade;
}

void main() {
  float dist = length(vXZ);
  float major = lineCoverage(uStep, 0.05);
  float minor = lineCoverage(uStep / max(uMinorDiv, 1.0), 0.03) * MINOR_DIM;
  float lines = max(major, minor);

  float fog = 1.0 - smoothstep(uExt * 0.35, uExt, dist);

  float a = lines * fog * uOpacity;
  fragColor = vec4(uColor * a, a); // premultiplied
}
