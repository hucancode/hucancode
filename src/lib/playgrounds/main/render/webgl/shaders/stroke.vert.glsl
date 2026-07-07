#version 300 es
// Flat ink ribbon, drawn straight to screen in world space (no offscreen
// texture, so the body can never be cut at a texture border).
precision highp float;
in vec2 aPos;
in vec2 aLineUV;
uniform mat4 uViewProj;
out vec2 vUV01;
void main() {
  vUV01 = aLineUV;
  gl_Position = uViewProj * vec4(aPos, 0.0, 1.0);
}
