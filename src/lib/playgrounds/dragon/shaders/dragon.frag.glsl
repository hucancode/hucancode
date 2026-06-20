#version 300 es
precision highp float;
in vec3 vN;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbient;
uniform vec3 uBaseColor;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vN);
  float d = max(dot(N, normalize(uLightDir)), 0.0);
  vec3 c = uBaseColor * (uAmbient + d * uLightColor);
  fragColor = vec4(c, 1.0);
}