#version 300 es
// pure passthrough: positions are pre-baked to clip space JS-side
in vec3 position;

void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
