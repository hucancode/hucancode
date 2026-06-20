#version 300 es
precision highp float;
in vec3 aPos;
uniform mat4 uVP;
uniform float uAspect;
uniform int u3D;
void main() {
  gl_PointSize = 10.0;
  if (u3D == 1) gl_Position = uVP * vec4(aPos, 1.0);
  else gl_Position = vec4(aPos.x / uAspect, aPos.y, 0.0, 1.0);
}