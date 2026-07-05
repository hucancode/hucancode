#version 300 es
precision mediump float;
in vec3 vN;
in vec3 vW;
uniform vec3 uColor;
uniform vec3 uLightPos;
uniform vec3 uViewPos;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vN);
  vec3 L = normalize(uLightPos - vW);
  vec3 V = normalize(uViewPos - vW);
  vec3 H = normalize(L + V);
  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.25;
  vec3 col = uColor * (0.32 + 0.68 * diff) + vec3(spec);
  fragColor = vec4(col, 1.0);
}
