#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aLineUV;
uniform mat4 uViewProj;
out vec2 vUV01;
void main() {
  vUV01 = aLineUV;
  gl_Position = uViewProj * vec4(aPos, 0.0, 1.0);
}
