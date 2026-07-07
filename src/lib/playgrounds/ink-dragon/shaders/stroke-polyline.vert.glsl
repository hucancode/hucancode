#version 300 es
// Vertex shader for the procedurally-built polyline ribbon mesh.
// position carries world coords (x ∈ [-aspect, +aspect], y ∈ [-1, +1]);
// aLineUV is the 0..1 (perp_t, arc_t) parameter distributed JS-side along
// every polyline segment. The orthographic camera is identity, so clip = world
// with x divided back by aspect.
in vec3 position;
in vec2 aLineUV;

uniform float uAspect;

out vec2 vUV01;

void main() {
    vUV01 = aLineUV;
    gl_Position = vec4(position.x / uAspect, position.y, 0.0, 1.0);
}
