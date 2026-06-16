#version 300 es
precision highp float;

// Glyph SDF reveal, INK ONLY. Renders into an offscreen target with a
// transparent background so the composite pass can fade it with one opacity.
// Same SDF / pressure / reveal math as the calligraphy playground
// (st/caligraphy-playground.frag.glsl), minus paper, grid, grain, vignette.

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uBaseRadius;
uniform float uTime;       // reveal playhead (s)
uniform int   uNSeg;
uniform sampler2D uSegTex; // RGBA32F, 4 texels per seg, height = NSEG

#define SAMPLES   10
#define MIN_PRESS 0.0

const vec3 INK_COLOR = vec3(0.067, 0.067, 0.067);

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

vec2 bez(vec2 p1, vec2 c, vec2 p2, float t) {
    float u = 1.0 - t;
    return u * u * u * p1 + (3.0 * u * u * t + 3.0 * u * t * t) * c + t * t * t * p2;
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

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 w = (2.0 * frag - uResolution) / uResolution.y; // x in [-aspect,aspect], y in [-1,1]
    float px = 2.0 / uResolution.y;
    float aa = 1.5 * px;

    float dmin = 1e9;
    for (int i = 0; i < uNSeg; i++) {
        Seg s = getSeg(i);
        vec2 p1 = s.p1, p2 = s.p2, c = s.ctrl;
        float pa = s.pr1, pb = s.pr2;

        float tp = clamp((uTime - s.t0) / s.dur, 0.0, 1.0);
        if (tp <= 0.0) continue;
        float r = revealArc(tp, s.v0, s.v1);

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
    fragColor = vec4(INK_COLOR, ink);
}
