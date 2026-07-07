#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aUV;
uniform mat4 uViewProj;
out vec2 vUV;
void main() { vUV = aUV; gl_Position = uViewProj * vec4(aPos, 0.0, 1.0); }
