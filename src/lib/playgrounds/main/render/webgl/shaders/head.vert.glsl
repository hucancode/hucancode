#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aUV;
uniform float uAspect;
uniform float uCamY;
uniform float uFlipY;
out vec2 vUV;
void main() { vUV = aUV; gl_Position = vec4(aPos.x / uAspect, (aPos.y - uCamY) * uFlipY, 0.0, 1.0); }