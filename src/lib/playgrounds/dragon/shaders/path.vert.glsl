#version 300 es
in vec3 position;
uniform mat4 uViewProj;
void main() { gl_Position = uViewProj * vec4(position, 1.0); }