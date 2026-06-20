#version 300 es
precision highp float;

uniform mat4 uViewProj;
uniform float uExt;
uniform float uZ;

out vec2 vXY;     // world x/y on the ground plane (grid coords)
out float vDepth; // clip-space depth proxy (reacts to pitch/yaw)

const vec2 C[4] = vec2[4](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0));

void main() {
  vec2 c = C[gl_VertexID];
  vec3 world = vec3(c.x * uExt, c.y * uExt, uZ);
  vXY = world.xy;
  vec4 clip = uViewProj * vec4(world, 1.0);
  vDepth = clip.w; // perspective: view-space distance from camera
  gl_Position = clip;
}
