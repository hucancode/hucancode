#version 300 es
precision highp float;

// Ink-splash wash. A procedural-noise quad: an ink blob centred at the origin
// that GROWS over time (uGrow) out to uSpread, with a sharp fbm-fingered edge so
// it splatters randomly around the circle. The coverage is POSTERISED to ~3 ink
// tones (sumi-e light/mid/dark), with magicBox speckles flung past the rim.
// Rendered into its own offscreen target (straight alpha), composited behind the
// glyph.

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uGrow;     // 0..1 spread progress (grows with scene time)
uniform float uSpread;   // max blob radius (world units)
uniform float uAmount;   // 0..1 amount of ink blobs (more patches as it rises)
uniform float uClock;    // absolute scene time -> slow noise drift

const vec3 INK_DARK = vec3(0.06, 0.06, 0.07);
const vec3 INK_LIGHT = vec3(0.32, 0.31, 0.30);

// ---- simplex noise + fbm (from the sumi-e reference shader) -----------------
vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;
    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;
    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
    vec3 n = h * h * h * h * vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
    return dot(n, vec3(70.0));
}
float noise01(vec2 p) { return clamp((noise(p) + 0.5) * 0.5, 0.0, 1.0); }
float fbm(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.13; a *= 0.5; }
    return s;
}

// ---- magicBox fractal for splatter speckles (from "Magic Fractal" by dgreensp)
float magicBox(vec3 p) {
    const float MAGIC = 0.55;
    p = 1.0 - abs(1.0 - mod(p, 2.0));
    float lastLength = length(p);
    float tot = 0.0;
    for (int i = 0; i < 13; i++) {
        p = abs(p) / (lastLength * lastLength) - MAGIC;
        float newLength = length(p);
        tot += abs(newLength - lastLength);
        lastLength = newLength;
    }
    return tot;
}
float magicBox(vec2 uv) {
    const mat3 M = mat3(0.28862355854826727, 0.6997227302779844, 0.6535170557707412,
                        0.06997493955670424, 0.6653237235314099, -0.7432683571499161,
                        -0.9548821651308448, 0.26025457467376617, 0.14306504491456504);
    vec3 p = 0.5 * M * vec3(uv, 0.0);
    return magicBox(p);
}

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 w = (2.0 * frag - uResolution) / uResolution.y; // x in [-aspect,aspect], y in [-1,1]
    float px = 2.0 / uResolution.y;

    float r = length(w);

    // Growth by THRESHOLD, not a circular cut: build a noise field that is high
    // near the origin and trails off with radius, then lower the cut level as
    // uGrow rises so the ink floods outward along the noise (organic, no clean
    // circle edge). uSpread only sets how far the radial falloff reaches.
    float fb = fbm(w * 3.0 + vec2(0.0, uClock * 0.04)); // ~ -0.6..0.9
    float field = fb + 0.6 - r / max(uSpread, 1e-3);
    float level = mix(0.95, -0.25, clamp(uGrow, 0.0, 1.0)); // descends as it grows
    float aa = 0.05;
    float shape = smoothstep(level + aa, level - aa, field); // 1 where field > level

    // sharp ink-density grain inside the blob
    float grain = noise01(w * 11.0) * 0.6 + noise01(w * 26.0) * 0.4;
    // sparse low-freq patches: ink lands in scattered blots, not a solid disc.
    // uAmount lowers the threshold -> more of the fbm field passes -> more blobs.
    float thr = mix(0.82, 0.12, clamp(uAmount, 0.0, 1.0));
    float patches = smoothstep(thr, thr + 0.36, fbm(w * 2.3 + vec2(11.0, 7.0)));
    float ink = shape * grain * patches * 1.7;

    // splatter speckles flung just past the current ink front
    float reach = uSpread * uGrow;
    float speck = pow(smoothstep(22.0, 40.0, magicBox((w + 9.0) * 3.0)), 2.0);
    speck *= smoothstep(reach * 1.7, reach * 0.85, r); // only near/just outside the front
    ink = max(ink, speck * 0.8);

    ink = clamp(ink, 0.0, 1.0);

    vec3 col = mix(INK_LIGHT, INK_DARK, ink);
    fragColor = vec4(col, ink);
}
