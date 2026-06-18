#version 300 es
// Quad/plane vertex shader. The scene supplies a model matrix (identity for the
// full-screen paper + whisker billboards, a TRS for the head plane).
in vec3 position;
in vec2 uv;

uniform mat4 uModel;

out vec2 vUV;

void main() {
    vUV = uv;
    gl_Position = uModel * vec4(position, 1.0);
}
