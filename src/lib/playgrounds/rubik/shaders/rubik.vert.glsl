#version 300 es
in vec3 position;
in vec3 color;
uniform mat4 uViewProj;
uniform mat4 uModel;
out vec3 vColor;
void main() {
  vColor = color;
  gl_Position = uViewProj * uModel * vec4(position, 1.0);
}