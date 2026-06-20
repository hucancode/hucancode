#version 300 es
// instanced. per-instance iData0 = (cx, cy, scale, z), iData1 = (bloom, seed, alpha, _)
precision highp float;
layout(location = 1) in vec4 iData0;
layout(location = 2) in vec4 iData1;
uniform mat4 uViewProj;
out vec2 vLocal;
out float vBloom;
out float vSeed;
out float vAlpha;
const vec2 C[4] = vec2[4](vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(-1.0,1.0), vec2(1.0,1.0));
void main() {
  vec2 c = C[gl_VertexID];
  vLocal = c;
  vBloom = iData1.x; vSeed = iData1.y; vAlpha = iData1.z;
  vec3 world = vec3(iData0.xy + c * iData0.z, iData0.w);
  gl_Position = uViewProj * vec4(world, 1.0);
}