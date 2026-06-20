#version 300 es
precision highp float;
const vec2 POS[6] = vec2[6](
  vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(1.0,1.0),
  vec2(-1.0,-1.0), vec2(1.0,1.0), vec2(-1.0,1.0));
uniform vec2 uScale;     // clip-space half-size
uniform float uRot;      // rotate the sampled pattern (disc spin)
out vec2 vUV;
void main() {
  vec2 position = POS[gl_VertexID];
  float c = cos(uRot), s = sin(uRot);
  vec2 r = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
  vUV = r * 0.5 + 0.5;
  gl_Position = vec4(position * uScale, 0.0, 1.0);
}