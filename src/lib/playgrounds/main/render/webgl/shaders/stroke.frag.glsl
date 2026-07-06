#version 300 es
precision highp float;

// Ink ribbon stroke. The shared ink core (src/lib/brush/shaders/ink-core.frag.glsl)
// is spliced in at the marker below by composeShader().
// uSimple = 1 takes a cheap flat-alpha path (used for the small whiskers).
uniform int uSimple;

in vec2 vUV01;   // (perp_t, arc_t)
in vec2 vWorld;
out vec4 fragColor;

//#include ink-core.frag.glsl

void main() {
    StrokeField f = strokeField(vUV01);

    if (uSimple == 1) {
        // cheap flat ink for whiskers: soft edge, slight tail taper, no bristles
        float aa = fwidth(f.perpOff) + 1e-4;
        float a = (1.0 - smoothstep(-aa, aa, f.d)) * uBrushColor.a * uOpacity;
        if (a <= 0.0) discard;
        fragColor = vec4(uBrushColor.rgb, a);
        return;
    }

    fragColor = inkStrokeColor(f, vWorld);
}
