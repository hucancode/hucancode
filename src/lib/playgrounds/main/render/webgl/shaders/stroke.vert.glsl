#version 300 es
// uFlipY = +1 WebGL, -1 WebGPU (offscreen render-to-texture V axis differs per API).
precision highp float;
in vec2 aPos;
in vec2 aLineUV;
uniform float uAspect;
uniform float uCamY;
uniform float uFlipY;
out vec2 vUV01;
out vec2 vWorld;
void main() {
  vUV01 = aLineUV;
  vWorld = aPos;
  gl_Position = vec4(aPos.x / uAspect, (aPos.y - uCamY) * uFlipY, 0.0, 1.0);
}