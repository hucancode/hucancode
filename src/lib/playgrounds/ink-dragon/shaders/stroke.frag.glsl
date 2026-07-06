#version 300 es
precision highp float;

// Ink ribbon stroke (full textured path). The shared ink core
// (src/lib/brush/shaders/ink-core.frag.glsl) is spliced in at the marker below
// by composeShader().

in vec2 vUV01;   // (perp_t, arc_t), both in 0..1; stroke band sits in the central
in vec2 vWorld;  // sub-rectangle [c, 1-c] × [c, 1-c] (per-axis clearances differ)

out vec4 fragColor;

//#include ink-core.frag.glsl

void main() {
    fragColor = inkStrokeColor(strokeField(vUV01), vWorld);
}
