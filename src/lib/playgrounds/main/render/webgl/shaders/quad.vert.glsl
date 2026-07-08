#version 300 es
precision highp float;
uniform float uAspect;
uniform float uZ;
uniform float uStationY;
uniform float uExt;
uniform mat4 uViewProj;
out vec2 vUV;
const vec2 C[4] = vec2[4](vec2(0.0,0.0), vec2(1.0,0.0), vec2(0.0,1.0), vec2(1.0,1.0));
void main() {
  vec2 c = C[gl_VertexID];
  vUV = c;
  vec3 world = vec3((c.x * 2.0 - 1.0) * uAspect * uExt, (c.y * 2.0 - 1.0) * uExt + uStationY, uZ);
  gl_Position = uViewProj * vec4(world, 1.0);
}