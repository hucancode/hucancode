#version 300 es
in vec3 position;
in vec3 normal;
uniform mat4 uViewProj;
uniform mat4 uModel;
out vec3 vN;
out vec3 vW;
void main() {
  vN = mat3(uModel) * normal;
  vW = (uModel * vec4(position, 1.0)).xyz;
  gl_Position = uViewProj * uModel * vec4(position, 1.0);
}