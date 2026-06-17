// Vertex shader for the procedurally-built polyline ribbon mesh.
// position carries world coords (x ∈ [-aspect, +aspect], y ∈ [-1, +1]);
// aLineUV is the 0..1 (perp_t, arc_t) parameter distributed JS-side along
// every polyline segment.
attribute vec2 aLineUV;

uniform float uAspect;

varying vec2 vUV01;
varying vec2 vWorld;

void main() {
    vUV01  = aLineUV;
    vWorld = position.xy;
    vec2 clip = vec2(position.x / uAspect, position.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(clip, 0.0, 1.0);
}
