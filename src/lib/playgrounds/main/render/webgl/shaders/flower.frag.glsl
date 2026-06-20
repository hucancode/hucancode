#version 300 es
precision highp float;

// Bloom flower for /paint — a sumi-e ink flower seated at a path-circle centre.
// Same petal SDF + dry-brush ink machinery as the standalone /flower showcase, but
// instead of an opaque paper background it outputs PREMULTIPLIED ink coverage so it
// composites over the live scene. Every petal knob is driven by uBloom (0 = tight
// bud, 1 = full bloom): rings fade in one by one, petals lengthen + widen, the
// whole flower un-curls. uSeed gives each flower its own petal count / twist / size.

const float PI  = 3.14159265;
const float PI2 = 6.28318531;

in vec2 vLocal;            // quad-local, -1..1 (flower fills the unit disc)
out vec4 fragColor;

in float vBloom;           // 0..1 bud -> full bloom (per-instance)
in float vSeed;            // per-flower 0..1 (petal count / twist / size jitter)
in float vAlpha;           // per-flower layer opacity
uniform float uPetals;     // base petals per ring
uniform float uLayers;     // max concentric rings at full bloom
uniform vec3  uInkColor;

// --- ink noise (Dave Hoskins hash + simplex), shared with the standalone -----
vec2 hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return -1.0 + 2.0 * fract((p3.xx + p3.yz) * p3.zy);
}
float noise(in vec2 p) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;
    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;
    vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
    vec3 n = h*h*h*h * vec3(dot(a, hash(i+0.0)),
                            dot(b, hash(i+o)),
                            dot(c, hash(i+1.0)));
    return dot(n, vec3(70.0));
}
float noise01(vec2 p) { return clamp((noise(p) + 0.5) * 0.5, 0.0, 1.0); }

// petal knobs, resolved from bloom — recomputed once per fragment (cheap)
struct Knobs {
    float petals, layers, len, wid, tipSharp, tipNotch, baseBias, layerScale,
          layerTwist, swirl, wobble, inkFlow, waterFlow;
};
Knobs bloomKnobs() {
    float b = clamp(vBloom, 0.0, 1.0);
    float open = smoothstep(0.0, 1.0, b);
    Knobs k;
    k.petals     = floor(uPetals + (vSeed > 0.66 ? 1.0 : (vSeed < 0.33 ? -1.0 : 0.0)) + 0.5);
    // layers per flower: 50% 1, 30% 2, 20% 3 — decorrelated hash so it's
    // independent of petal count / twist (which also read vSeed)
    float lr     = fract(vSeed * 91.7 + 0.137);
    k.layers     = lr < 0.5 ? 1.0 : (lr < 0.8 ? 2.0 : 3.0);
    k.len        = mix(0.16, 0.95, open);
    k.wid        = mix(0.05, 0.42, open);
    k.tipSharp   = mix(2.4, 0.6, open);   // bud has a sharp closed tip; opens to a plump lotus petal
    k.baseBias   = mix(1.5, 0.95, open);  // belly slides from near-tip (closed) to mid-upper
    k.tipNotch   = mix(0.0, 0.12, open);  // apex cleft opens up with the bloom
    k.layerScale = 0.66;
    k.layerTwist = 0.3 + 0.45 * vSeed;
    k.swirl      = mix(1.5, 0.0, open) * (0.6 + 0.8 * vSeed); // un-curl as it opens
    k.wobble     = 0.35;
    k.inkFlow    = 1.0;
    k.waterFlow  = 0.6;
    return k;
}

// straight-alpha ink wash for one petal ring; returns vec4(rgb, coverage). Same
// posterized dry-brush "flying white" as the standalone, alpha = coverage*tone.
vec4 inkStroke(vec2 uvLine, float tAlong, float sd, vec3 brushRGB, Knobs k) {
    float water = clamp(k.waterFlow, 0.0, 1.0);

    // JAGGED bleeding contour (滲み) — anisotropic noise tears the boundary into a
    // coherent sawtooth along the rim; AA band stays crisp, decoupled from amp.
    float bloomN = noise01(uvLine * 3.0);
    float jag    = noise(vec2(uvLine.y * 6.0,  uvLine.x * 2.5)) * 0.6
                 + noise(vec2(uvLine.y * 15.0, uvLine.x * 2.5)) * 0.4;
    float amp    = mix(0.012, 0.05, water) * mix(0.6, 1.8, bloomN);
    float sdb    = sd + jag * amp;
    float edgeAA = mix(0.004, 0.012, water);
    float fill = 1.0 - smoothstep(-edgeAA, edgeAA, sdb);
    if (fill <= 0.0) return vec4(0.0);

    // pale translucent body, ink gathers dark toward the tip and pools at the rim
    float depth    = clamp(-sd / 0.12, 0.0, 1.0);
    float edgePool = pow(1.0 - depth, 1.4);
    float tipDark  = smoothstep(0.2, 1.0, clamp(tAlong, 0.0, 1.0));
    float dens     = 0.24 + 0.42 * tipDark;
    dens = max(dens, edgePool * 0.8);
    dens = pow(clamp(dens, 0.0, 1.0), 1.0 / max(k.inkFlow, 0.1));

    // low-freq granulation blotches across the wash (no fine grain)
    float gran = noise01(uvLine * 2.0) * 0.65 + noise01(uvLine * 4.5) * 0.35;
    dens *= mix(1.0 - 0.3 * water, 1.0 + 0.22 * water, gran);

    // smooth continuous wash, soft tonal quantize only
    float val = clamp(dens, 0.0, 1.0);
    float val5 = val * 5.0;
    float tone = (floor(val5) + smoothstep(0.25, 0.75, fract(val5))) / 5.0;
    tone = mix(val, tone, 0.35);

    float a = clamp(fill * tone, 0.0, 1.0);
    return vec4(brushRGB, a);
}

// SDF to a ring of leaf-stroke petals (identical geometry to the standalone)
float petalRing(vec2 uv, float petals, float len, float wid, float twist,
                Knobs k, out vec2 uvLine, out float tAlong) {
    float r = length(uv);
    float a = atan(uv.x, uv.y) + twist;
    a += k.swirl * r;

    float cell = PI2 / max(petals, 1.0);
    float fa = a / cell + 0.5;
    float idx = floor(fa);
    float local = (fract(fa) - 0.5) * cell;

    float y = r;
    float x = local * r;
    float t = clamp(y / max(len, 1e-4), 0.0, 1.0);

    float w = max(k.wobble, 0.0);
    x += (noise01(vec2(y * 5.0, idx * 11.0)) - 0.5) * 0.05 * w;
    x += sin(y * 16.0 + idx) * 0.01 * w;

    float aexp = max(k.baseBias, 0.1);
    float bexp = max(k.tipSharp, 0.1);
    float tp = aexp / (aexp + bexp);
    float peak = pow(tp, aexp) * pow(1.0 - tp, bexp);
    float prof = pow(t, aexp) * pow(1.0 - t, bexp) / max(peak, 1e-4);
    // round the attachment so the base is a soft cup, not a needle
    prof = max(prof, smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.7, 1.0, t)) * 0.35);
    float halfW = max(wid * prof, 1e-4);

    // notched tip: gaussian dip in x shortens the centerline -> soft apex cleft
    float notchW = wid * 0.45 + 1e-4;
    float dip    = max(k.tipNotch, 0.0) * len * exp(-(x * x) / (notchW * notchW));
    float tipLen = len - dip;

    float sd = abs(x) - halfW;
    sd = max(sd, y - tipLen);
    sd = max(sd, -y);

    uvLine = vec2(x, y);
    tAlong = t;
    return sd;
}

void main() {
    Knobs k = bloomKnobs();
    float b = clamp(vBloom, 0.0, 1.0);

    vec3  outRGB = vec3(0.0);
    float outA   = 0.0;

    int layers = int(clamp(k.layers, 1.0, 5.0) + 0.5);
    // outermost ring first, innermost last (drawn on top). Rings fade in one by one
    // as the bloom advances: ring i reveals over [i/N .. i/N + 0.4] of the bloom.
    for (int i = 4; i >= 0; i--) {
        if (i >= layers) continue;
        float fi = float(i);
        float ringIn = smoothstep(fi / float(layers), fi / float(layers) + 0.4, b);
        if (ringIn <= 0.0) continue;

        float scale = pow(k.layerScale, fi);
        float len = k.len * scale;
        float wid = k.wid * scale;
        float twist = k.layerTwist * fi;
        twist += (PI2 / max(k.petals, 1.0)) * 0.5 * mod(fi, 2.0);

        vec2 uvLine; float tAlong;
        float sd = petalRing(vLocal, k.petals, len, wid, twist, k, uvLine, tAlong);

        vec3 ringRGB = uInkColor * mix(1.0, 0.82, fi / float(max(layers - 1, 1)));
        vec4 s = inkStroke(uvLine, tAlong, sd, ringRGB, k);
        s.a *= ringIn;
        // straight-alpha "over": composite this ring onto the running result
        outRGB = mix(outRGB, s.rgb, s.a);
        outA   = s.a + outA * (1.0 - s.a);
    }

    float a = outA * vAlpha;
    if (a <= 0.0) discard;
    fragColor = vec4(outRGB * a, a); // premultiplied
}
