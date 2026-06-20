#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uOpacity;
in vec2 vUV;
out vec4 fragColor;
void main() { fragColor = texture(uTex, vUV) * uOpacity; }