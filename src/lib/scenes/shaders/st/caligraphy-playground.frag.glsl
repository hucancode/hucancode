#version 300 es
precision highp float;

// Live calligraphy ink renderer. Same SDF / pressure / reveal math as the
// shadertoy st/caligraphy.glsl, but the baked Seg[] table arrives as a float
// texture (bake.js -> render-gl.js) instead of a compile-time const array, so
// the playground can re-render an edited glyph every frame.

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
uniform sampler2D uSegTex;   // RGBA32F, 4 texels per seg, height = NSEG

#define SAMPLES   10
#define MIN_PRESS 0.0
#define GRAIN     0.05
#define VIGNETTE  0.5

const vec3 PAPER_COLOR = vec3(1.000, 0.988, 0.878);
const vec3 INK_COLOR   = vec3(0.067, 0.067, 0.067);
const vec4 GRID_COLOR  = vec4(0.784, 0.235, 0.235, 0.25);

struct Seg {
    vec2 p1; vec2 p2; vec2 ctrl;
    float pr1; float pr2; float k; float belly; int hasBelly;
    float t0; float dur; float v0; float v1;
};

Seg getSeg(int i) {
    vec4 a = texelFetch(uSegTex, ivec2(0, i), 0);
    vec4 b = texelFetch(uSegTex, ivec2(1, i), 0);
    vec4 c = texelFetch(uSegTex, ivec2(2, i), 0);
    vec4 d = texelFetch(uSegTex, ivec2(3, i), 0);
    Seg s;
    s.p1 = a.xy; s.p2 = a.zw;
    s.ctrl = b.xy; s.pr1 = b.z; s.pr2 = b.w;
    s.k = c.x; s.belly = c.y; s.hasBelly = int(c.z + 0.5); s.t0 = c.w;
    s.dur = d.x; s.v0 = d.y; s.v1 = d.z;
    return s;
}

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

// Exact 2D signed distance to a round cone (capsule, radius r1->r2). (Inigo Quilez)
float sdRoundedCone(vec2 p, vec2 a, vec2 b, float r1, float r2) {
    vec2 ba = b - a;
    float l2 = dot(ba, ba);
    if (l2 < 1e-12) return length(p - a) - r1;
    float rr = r1 - r2;
    float a2 = l2 - rr * rr;
    float il2 = 1.0 / l2;
    vec2 pa = p - a;
    float y = dot(pa, ba);
    float z = y - l2;
    vec2 xv = pa * l2 - ba * y;
    float x2 = dot(xv, xv);
    float y2 = y * y * l2;
    float z2 = z * z * l2;
    float k = sign(rr) * rr * rr * x2;
    if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
    if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
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
    // view-space coord, then undo zoom/pan to get the world coord this pixel maps to
    vec2 wv = (2.0 * frag - uResolution) / uResolution.y;
    vec2 w  = wv / uZoom + uPan;

    float px = (2.0 / uResolution.y) / uZoom;   // world units per pixel
    float aa = 1.5 * px;

    vec3 col = PAPER_COLOR;

    if (uShowGrid == 1) {
        float g = komeGrid(w, aa, uGridSize);
        col = mix(col, GRID_COLOR.rgb, g * GRID_COLOR.a);
    }

    float dmin = 1e9;
    for (int i = 0; i < uNSeg; i++) {
        Seg s = getSeg(i);
        vec2 p1 = s.p1, p2 = s.p2, c = s.ctrl;
        float pa = s.pr1, pb = s.pr2;

        float r;
        if (uMode == 1) {
            float tp = clamp((uTime - s.t0) / s.dur, 0.0, 1.0);
            if (tp <= 0.0) continue;
            r = revealArc(tp, s.v0, s.v1);
        } else {
            r = 1.0;
        }

        // cheap reject: skip if pixel is outside the curve hull + brush + aa
        vec2 cen = (p1 + p2) * 0.5;
        float hullR = max(length(p1 - cen), length(c - cen));
        if (length(w - cen) - hullR - uBaseRadius > aa) continue;

        vec2 prevPos = bez(p1, c, p2, 0.0);
        float prevRad = uBaseRadius * max(MIN_PRESS, pa);
        for (int k = 1; k <= SAMPLES; k++) {
            float t = (float(k) / float(SAMPLES)) * r;
            float pr = (s.hasBelly == 1)
                ? pressureAt(pa, pb, s.k, t, s.belly)
                : mix(pa, pb, t);
            vec2 pos = bez(p1, c, p2, t);
            float rad = uBaseRadius * max(MIN_PRESS, pr);
            dmin = min(dmin, sdRoundedCone(w, prevPos, pos, prevRad, rad));
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
