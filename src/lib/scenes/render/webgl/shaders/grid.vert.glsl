#version 300 es
precision highp float;

// Ground-plane grid quad. A single quad on y = uY spanning +-uExt in x/z,
// pushed through the orbit camera (uViewProj). The fragment shader draws the
// grid lines procedurally with glow + fog + camera-distance falloff.

uniform mat4 uViewProj;
uniform float uExt;
uniform float uY;

out vec2 vXZ;     // world x/z (grid coords)
out float vDepth; // clip-space depth proxy (reacts to pitch/yaw)

const vec2 C[4] = vec2[4](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0));

void main() {
  vec2 c = C[gl_VertexID];
  vec3 world = vec3(c.x * uExt, uY, c.y * uExt);
  vXZ = world.xz;
  vec4 clip = uViewProj * vec4(world, 1.0);
  vDepth = clip.w; // perspective: view-space distance from camera
  gl_Position = clip;
}
