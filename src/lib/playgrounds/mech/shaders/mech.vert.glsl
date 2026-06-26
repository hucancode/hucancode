#version 300 es
out vec2 vUv;
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  vec2 p = P[gl_VertexID];
  vUv = p;
  gl_Position = vec4(p, 0.0, 1.0);
}
