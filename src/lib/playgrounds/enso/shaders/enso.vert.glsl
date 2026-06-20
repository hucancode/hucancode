#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
out vec2 vUV;
void main() { vec2 p = POS[gl_VertexID]; vUV = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }