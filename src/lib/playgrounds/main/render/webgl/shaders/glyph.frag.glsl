#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform vec2  uResolution;
uniform float uBaseRadius;
uniform float uTime;       // reveal playhead (s)
uniform int   uNSeg;
uniform float uOpacity;
uniform float uAspect;
uniform float uExt;
uniform sampler2D uSegTex; // RGBA32F, 5 texels per seg, height = NSEG; texel 0 = header (cen.xy, hullR, t0)

#define SAMPLES   10
#define MIN_PRESS 0.0

uniform vec3 uInkColor;

float sdCone(vec2 p, vec2 a, vec2 b, float r1, float r2) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-12), 0.0, 1.0);
    return length(pa - ba * h) - mix(r1, r2, h);
}

float pressureAt(float A, float B, float k, float s, float bellyX) {
    float cx = clamp(bellyX, 0.0, 1.0);
    float a = 1.0 - 2.0 * cx, b = 2.0 * cx, c = -s;
    float t;
    if (abs(a) < 1e-6) {
        t = b > 1e-6 ? -c / b : s;
    } else {
        float disc = max(0.0, b * b - 4.0 * a * c);
        t = (-b + sqrt(disc)) / (2.0 * a);
    }
    t = clamp(t, 0.0, 1.0);
    float u = 1.0 - t;
    return u * u * A + 2.0 * u * t * k + t * t * B;
}

float revealArc(float tp, float v0, float v1) {
    float dv = v1 - v0;
    if (abs(dv) < 1e-5) return clamp(tp, 0.0, 1.0);
    float ratio = v1 / v0;
    return clamp(v0 * (pow(ratio, tp) - 1.0) / dv, 0.0, 1.0);
}

void main() {
    // quad-local UV -> glyph-space coords (x in [-aspect,aspect], y in [-1,1], both * ext)
    vec2 w = vec2((vUV.x * 2.0 - 1.0) * uAspect, vUV.y * 2.0 - 1.0) * uExt;
    float px = 2.0 / uResolution.y;
    float aa = 1.5 * px;

    float dmin = 1e9;
    for (int i = 0; i < uNSeg; i++) {
        if (dmin < -aa) break; // fragment already fully inside ink

        vec4 hdr = texelFetch(uSegTex, ivec2(0, i), 0); // cen.xy, hullR, t0
        if (uTime <= hdr.w) continue;
        if (length(w - hdr.xy) - hdr.z - uBaseRadius > aa) continue;

        vec4 a = texelFetch(uSegTex, ivec2(1, i), 0); // p1.xy, p2.xy
        vec4 b = texelFetch(uSegTex, ivec2(2, i), 0); // ctrl.xy, pr1, pr2
        vec4 c = texelFetch(uSegTex, ivec2(3, i), 0); // k, belly, hasBelly, dur
        vec4 d = texelFetch(uSegTex, ivec2(4, i), 0); // v0, v1
        vec2 p1 = a.xy, p2 = a.zw, ctrl = b.xy;
        float pa = b.z, pb = b.w;
        bool hasBelly = c.z > 0.5;

        float tp = clamp((uTime - hdr.w) / c.w, 0.0, 1.0);
        float r = revealArc(tp, d.x, d.y);

        // Horner coeffs of the cubic bezier (both inner controls at ctrl)
        vec2 b1 = 3.0 * (ctrl - p1);
        vec2 b2 = 3.0 * (p1 - ctrl);
        vec2 b3 = p2 - p1;

        vec2 prevPos = p1;
        float prevRad = uBaseRadius * max(MIN_PRESS, pa);
        for (int k = 1; k <= SAMPLES; k++) {
            float t = (float(k) / float(SAMPLES)) * r;
            float pr = hasBelly
                ? pressureAt(pa, pb, c.x, t, c.y)
                : mix(pa, pb, t);
            vec2 pos = ((b3 * t + b2) * t + b1) * t + p1;
            float rad = uBaseRadius * max(MIN_PRESS, pr);
            dmin = min(dmin, sdCone(w, prevPos, pos, prevRad, rad));
            prevPos = pos;
            prevRad = rad;
        }
    }

    float ink = smoothstep(aa, -aa, dmin);
    fragColor = vec4(uInkColor, ink * uOpacity);
}
