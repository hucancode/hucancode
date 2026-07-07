#version 300 es
precision highp float;

// Flat ink fill. The mesh shapes the tapered body (widthAt in the ribbon
// builder); here only opacity fades along the arc so the tail dissolves.
uniform vec4 uBrushColor;

in vec2 vUV01; // x: 0..1 across width, y: 0 tail .. 1 head along arc

out vec4 fragColor;

const float TAIL_FADE = 0.35; // arc span over which the tail fades in

void main() {
    float alpha = uBrushColor.a * smoothstep(0.0, TAIL_FADE, vUV01.y);
    if (alpha <= 0.0) discard;
    fragColor = vec4(uBrushColor.rgb, alpha);
}
