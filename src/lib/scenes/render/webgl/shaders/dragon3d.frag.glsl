#version 300 es
precision highp float;

// 3D dragon shading: dim Phong (two-sided diffuse + spec). Orthographic-ish view
// direction (+z). uOpacity fades in. No emissive / rim glow.

in vec3 vNormal;
uniform float uOpacity;
uniform float uLightBoost;
out vec4 fragColor;

const vec3 uAlbedo = vec3(0.06, 0.07, 0.10);
const vec3 LIGHT_DIR = vec3(0.40, 0.70, 0.58);
const vec3 LIGHT_COL = vec3(1.0, 0.97, 0.90);
const float AMBIENT  = 0.14;
const float SPEC_POW = 24.0;
const float SPEC_INT = 0.4;

void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(LIGHT_DIR);
  vec3 V = vec3(0.0, 0.0, 1.0);

  float diff = abs(dot(N, L));
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), SPEC_POW) * SPEC_INT;
  vec3 color = (uAlbedo * (AMBIENT + diff) * LIGHT_COL + spec * LIGHT_COL) * uLightBoost;

  fragColor = vec4(color, uOpacity);
}
