#version 300 es
in vec3 position;
in vec3 normal;
uniform mat4 uViewProj;
out vec3 vN;
out vec3 vW;
void main() {
  vN = normal;
  vW = position;
  gl_Position = uViewProj * vec4(position, 1.0);
}
