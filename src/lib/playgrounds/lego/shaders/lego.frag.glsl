#version 300 es
precision mediump float;
in vec3 vN;
in vec3 vW;
uniform vec3 uColor;
uniform vec3 uLightPos;
uniform float uSteps;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vN);
  vec3 L = normalize(uLightPos - vW);
  float d = max(dot(N, L), 0.0);
  d = floor(d * uSteps) / uSteps;           // toon banding
  vec3 col = uColor * (0.3 + 0.7 * d);
  fragColor = vec4(col, 1.0);
}