#version 300 es
precision highp float;

// Live calligraphy ink renderer (optimized for low-end GPUs).
//
// The baked Seg[] table arrives as a float texture (bake.js -> render.js) so an
// edited glyph re-renders live. Same pressure / reveal / SDF math as the
// shadertoy st/caligraphy.glsl, with three changes that matter on mobile:
//
//   1. Per-seg HEADER texel (center, hullRadius, t0) is fetched FIRST, so the
//      cheap spatial + not-yet-revealed reject costs ONE texture fetch. The
//      other 4 texels load only for segments that actually touch this pixel
//      (was 4 dependent fetches/seg for EVERY pixel, even blank paper).
//   2. Variable-radius CAPSULE sdf (one sqrt) replaces the exact round-cone
//      (several sqrt + sign branches). Visually identical at SAMPLES sub-steps.
//   3. Constant loop bound so the GLSL compiler can bound the per-pixel loop.
//
// The seg center + hull radius are precomputed CPU-side at bake time (were
// recomputed per pixel per seg before).

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uBaseRadius;   // brush half-width (world units) at pressure 1
uniform float uZoom;         // view zoom
uniform vec2  uPan;          // view pan (world)
uniform float uGridSize;     // 米 grid side (world units)
uniform int   uShowGrid;
uniform int   uMode;         // 0 = full (edit), 1 = animated reveal up to uTime
uniform float uTime;         // playhead (s) when uMode == 1
uniform int   uNSeg;
uniform sampler2D uSegTex;   // RGBA32F, 5 texels per seg, height = NSEG

#define SAMPLES   10
#define MAX_SEG   256        // hard loop cap (compiler-friendly bound)
#define MIN_PRESS 0.0
#define GRAIN     0.05
#define VIGNETTE  0.5

const vec3 PAPER_COLOR = vec3(1.000, 0.988, 0.878);
const vec3 INK_COLOR   = vec3(0.067, 0.067, 0.067);
const vec4 GRID_COLOR  = vec4(0.784, 0.235, 0.235, 0.25);

// Degenerate-cubic bezier (both handles = c) == quadratic through p1,c,p2.
vec2 bez(vec2 p1, vec2 c, vec2 p2, float t) {
    float u = 1.0 - t;
    return u * u * u * p1 + (3.0 * u * u * t + 3.0 * u * t * t) * c + t * t * t * p2;
}

// Pressure along a segment at arc progress s (mirrors engine.js pressureAt).
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

// Revealed arc fraction at time-fraction tp (exact inverse of engine auto-timing).
float revealArc(float tp, float v0, float v1) {
    float dv = v1 - v0;
    if (abs(dv) < 1e-5) return clamp(tp, 0.0, 1.0);
    float ratio = v1 / v0;
    return clamp(v0 * (pow(ratio, tp) - 1.0) / dv, 0.0, 1.0);
}

// Variable-radius capsule (round caps + linear taper) — one sqrt. Consecutive
// sub-segment radii are nearly equal, so this matches the exact round cone.
float sdCapsule(vec2 p, vec2 a, vec2 b, float ra, float rb) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-12), 0.0, 1.0);
    return length(pa - ba * h) - mix(ra, rb, h);
}

float lineCover(vec2 p, vec2 a, vec2 b, float halfW, float aa) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    float d = length(pa - ba * h);
    return 1.0 - smoothstep(halfW - aa, halfW + aa, d);
}

float komeGrid(vec2 w, float aa, float side) {
    float hw = side * 0.5;
    vec2 bl = vec2(-hw, -hw), br = vec2(hw, -hw);
    vec2 tr = vec2(hw, hw),   tl = vec2(-hw, hw);
    float lw = aa * 0.9;
    float g = 0.0;
    g = max(g, lineCover(w, bl, br, lw, aa));
    g = max(g, lineCover(w, br, tr, lw, aa));
    g = max(g, lineCover(w, tr, tl, lw, aa));
    g = max(g, lineCover(w, tl, bl, lw, aa));
    g = max(g, lineCover(w, vec2(-hw, 0.0), vec2(hw, 0.0), lw, aa));
    g = max(g, lineCover(w, vec2(0.0, -hw), vec2(0.0, hw), lw, aa));
    g = max(g, lineCover(w, bl, tr, lw, aa));
    g = max(g, lineCover(w, br, tl, lw, aa));
    return g;
}

float grainNoise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) * 2.0 - 1.0;
}

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 wv = (2.0 * frag - uResolution) / uResolution.y;
    vec2 w  = wv / uZoom + uPan;

    float px = (2.0 / uResolution.y) / uZoom;
    float aa = 1.5 * px;

    vec3 col = PAPER_COLOR;
    if (uShowGrid == 1) {
        float g = komeGrid(w, aa, uGridSize);
        col = mix(col, GRID_COLOR.rgb, g * GRID_COLOR.a);
    }

    float dmin = 1e9;
    for (int i = 0; i < MAX_SEG; i++) {
        if (i >= uNSeg) break;

        // HEADER (texel 0): center.xy, hullRadius, t0 — one fetch gates the seg.
        vec4 H = texelFetch(uSegTex, ivec2(0, i), 0);
        if (uMode == 1 && uTime <= H.w) continue;            // not started yet
        if (length(w - H.xy) - H.z - uBaseRadius > aa) continue; // outside reach

        // survived: load the geometry texels.
        vec4 A = texelFetch(uSegTex, ivec2(1, i), 0);        // p1.xy, p2.xy
        vec4 B = texelFetch(uSegTex, ivec2(2, i), 0);        // ctrl.xy, pr1, pr2
        vec4 C = texelFetch(uSegTex, ivec2(3, i), 0);        // k, belly, hasBelly, dur
        vec2 p1 = A.xy, p2 = A.zw, c = B.xy;
        float pa = B.z, pb = B.w;

        float r = 1.0;
        if (uMode == 1) {
            vec4 D = texelFetch(uSegTex, ivec2(4, i), 0);    // v0, v1
            float tp = clamp((uTime - H.w) / max(C.w, 1e-6), 0.0, 1.0);
            r = revealArc(tp, D.x, D.y);
        }
        int hasBelly = int(C.z + 0.5);

        vec2 prevPos = p1;                                   // bez(p1,c,p2,0) == p1
        float prevRad = uBaseRadius * max(MIN_PRESS, pa);
        for (int k = 1; k <= SAMPLES; k++) {
            float t = (float(k) / float(SAMPLES)) * r;
            float pr = (hasBelly == 1) ? pressureAt(pa, pb, C.x, t, C.y) : mix(pa, pb, t);
            vec2 pos = bez(p1, c, p2, t);
            float rad = uBaseRadius * max(MIN_PRESS, pr);
            dmin = min(dmin, sdCapsule(w, prevPos, pos, prevRad, rad));
            prevPos = pos;
            prevRad = rad;
        }
    }

    float ink = smoothstep(aa, -aa, dmin);
    col = mix(col, INK_COLOR, ink);

    float n = grainNoise(frag) * GRAIN;
    col *= 1.0 + n * (1.0 - 0.5 * ink);
    vec2 uv = frag / uResolution;
    float vig = 1.0 - VIGNETTE * dot(uv - 0.5, uv - 0.5) * 2.0;
    col *= vig;

    fragColor = vec4(col, 1.0);
}
