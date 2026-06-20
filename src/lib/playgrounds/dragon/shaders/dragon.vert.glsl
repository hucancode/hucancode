#version 300 es
in vec3 position;
in vec3 normal;
uniform sampler2D uFrames;
uniform float uN;
uniform float uPathLen;
uniform float uBodyLen;
uniform float uHeadOffset;
uniform float uGirth;
uniform mat4 uViewProj;
out vec3 vN;
mat4 fetchFrame(int i) {
  return mat4(
    texelFetch(uFrames, ivec2(0, i), 0),
    texelFetch(uFrames, ivec2(1, i), 0),
    texelFetch(uFrames, ivec2(2, i), 0),
    texelFetch(uFrames, ivec2(3, i), 0));
}
void main() {
  float N = uN;
  float u = (position.x * uBodyLen + uHeadOffset) / uPathLen * N + N;
  int lo = int(mod(floor(u), N));
  int hi = int(mod(ceil(u), N));
  float k = fract(u);
  mat4 Mlo = fetchFrame(lo);
  mat4 Mhi = fetchFrame(hi);
  vec4 p = vec4(0.0, position.yz * uGirth, 1.0);
  vec4 world = mix(Mlo * p, Mhi * p, k);
  gl_Position = uViewProj * world;
  vec4 nr = vec4(normal, 0.0);
  vN = normalize(mix((Mlo * nr).xyz, (Mhi * nr).xyz, k));
}