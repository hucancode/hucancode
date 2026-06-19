#version 300 es
precision highp float;

// Sumi-e ink flower — petals are brush strokes radiating from a core, folded
// around the center in polar space and stacked in concentric layers for a full
// bloom. Same ink machinery as ensō: simplex bristle noise, dry-tip ink taper
// and paper bleed give each petal a wet-brush edge. No mesh, just an SDF field.

const float PI  = 3.14159265;
const float PI2 = 6.28318531;

in vec2 vUV;
out vec4 fragColor;

uniform vec2  uResolution;

uniform float uPetals;        // petals per layer
uniform float uLayers;        // concentric petal rings
uniform float uLength;        // petal length (radius reach)
uniform float uWidth;         // petal fatness
uniform float uTipSharp;      // tip taper exponent
uniform float uTipNotch;      // central cleft depth at the apex
uniform float uBaseBias;      // where the petal belly sits (base..tip)
uniform float uLayerScale;    // how much each inner ring shrinks
uniform float uLayerTwist;    // angular offset between rings
uniform float uSwirl;         // global rotation / petal curl
uniform float uInkFlow;
uniform float uWaterFlow;
uniform vec4  uInkColor;
uniform vec4  uBgColor;

// cheap sin-free hash (Dave Hoskins) — far faster than sin() on most GPUs
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
float rand(vec2 co)   { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
float h11(float n)    { return fract(sin(n * 127.1) * 43758.5453); }
float dtoa(float d, float amount) { return clamp(1.0 / (clamp(d, 1.0/amount, 1.0) * amount), 0.0, 1.0); }
float smoothf(float x) { return x*x*x*(x*(x*6.0 - 15.0) + 10.0); }

// Lay ink over `inpColor` along a stroke. uvLine = (perp, along), tAlong in
// 0..1 from base to tip; sd is the signed distance to the petal geometry. The
// petal is a flat ink wash POSTERIZED into 3 sumi-e tones, then carved by
// "flying white" (飛白) — smooth dry-brush streaks running ALONG the stroke that
// let the paper show through near the dry tip and the stroke edges.
vec3 inkStroke(vec2 uvLine, vec2 paperUV, float tAlong, float sd, vec3 inpColor, vec4 brushColor) {
    float water = clamp(uWaterFlow, 0.0, 1.0);

    // BLEEDING EDGE (滲み) — a JAGGED CONTOUR, not a fuzzy texture. The noise is
    // anisotropic: it varies fast ALONG the rim (uvLine.y, the petal length) but
    // slowly ACROSS it, so the boundary tears into a coherent sawtooth instead of
    // speckle. Displacement amplitude and edge crispness are decoupled — the AA
    // band stays tight so the displaced contour reads as a sharp torn edge.
    float bloom = noise01(uvLine * 3.0);                   // where ink floods out (low freq)
    float jag   = noise(vec2(uvLine.y * 6.0,  uvLine.x * 2.5)) * 0.6
                + noise(vec2(uvLine.y * 15.0, uvLine.x * 2.5)) * 0.4;
    float amp   = mix(0.012, 0.05, water) * mix(0.6, 1.8, bloom);
    float sdb   = sd + jag * amp;                          // jagged contour displacement
    float edgeAA = mix(0.004, 0.012, water);               // crisp edge, independent of amp
    float fill = 1.0 - smoothstep(-edgeAA, edgeAA, sdb);
    if (fill <= 0.0) return inpColor;

    // WETNESS MAP — lotus watercolor: a PALE translucent wash fills the petal
    // body, ink gathers DARK toward the soft tip and POOLS along the rim
    // (wet-edge), exactly as a loaded brush dries pulling pigment to the margins.
    float depth    = clamp(-sd / 0.12, 0.0, 1.0);          // 1 deep inside, 0 at rim
    float edgePool = pow(1.0 - depth, 1.4);                // ink banks up at the edge
    float tipDark  = smoothstep(0.2, 1.0, clamp(tAlong, 0.0, 1.0));
    float dens     = 0.24 + 0.42 * tipDark;                // pale body, darker tip
    dens = max(dens, edgePool * 0.8);                      // dark rim rings the petal
    dens = pow(clamp(dens, 0.0, 1.0), 1.0 / max(uInkFlow, 0.1));

    // GRANULATION — the FILL is low frequency: large soft pigment blotches drift
    // across the wash (the watercolour "blooms"), no fine grain in the body.
    float gran = noise01(uvLine * 2.0) * 0.65 + noise01(uvLine * 4.5) * 0.35;
    dens *= mix(1.0 - 0.3 * water, 1.0 + 0.22 * water, gran);

    // smooth continuous wash (no dry-brush, no hard sumi posterization) — soft
    // tonal quantize only to suggest layered brush passes
    float val = clamp(dens, 0.0, 1.0);
    float val5 = val * 5.0;
    float tone = (floor(val5) + smoothstep(0.25, 0.75, fract(val5))) / 5.0;
    tone = mix(val, tone, 0.35);

    float alpha = clamp(fill * tone * brushColor.a, 0.0, 1.0);
    return mix(inpColor, brushColor.rgb, alpha);
}

// Signed distance to a ring of petals. Each petal is a dry-brush LEAF STROKE:
// narrow at the base, swelling, then drawn to a sharp tip. Petals are uniform
// and evenly spaced — the dry-brush fiber texture supplies the variation.
float petalRing(vec2 uv, float petals, float len, float wid, float twist,
                out vec2 uvLine, out float tAlong) {
    float r = length(uv);
    float a = atan(uv.x, uv.y) + twist;
    a += uSwirl * r;                              // curl outward

    float cell = PI2 / max(petals, 1.0);
    float fa = a / cell + 0.5;
    float idx = floor(fa);                        // which petal
    float local = (fract(fa) - 0.5) * cell;       // angle from this petal's axis

    // uniform petals — evenly spaced, straight, identical size
    float len2 = len;
    float wid2 = wid;

    float y = r;
    float x = local * r;

    float t = clamp(y / max(len2, 1e-4), 0.0, 1.0);

    // lotus petal profile: plump rounded body swelling past the middle, drawn to
    // a SOFT point. pow(t,base)*pow(1-t,tip) with both exponents < 1 bulges the
    // base and tip rounded; peak sits where base/(base+tip) lands.
    float aexp = max(uBaseBias, 0.1);
    float bexp = max(uTipSharp, 0.1);
    float tp = aexp / (aexp + bexp);
    float peak = pow(tp, aexp) * pow(1.0 - tp, bexp);
    float prof = pow(t, aexp) * pow(1.0 - t, bexp) / max(peak, 1e-4);
    // round the attachment so the petal base is a soft cup, not a needle
    prof = max(prof, smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.7, 1.0, t)) * 0.35);
    float halfW = max(wid2 * prof, 1e-4);

    // NOTCHED TIP — carve a central cleft at the apex: shorten the petal length
    // near the centerline (gaussian dip in x) so the tip folds into a soft V,
    // like a real lotus petal edge. uTipNotch controls cleft depth.
    float notchW = wid2 * 0.45 + 1e-4;
    float dip    = max(uTipNotch, 0.0) * len2 * exp(-(x * x) / (notchW * notchW));
    float tipLen = len2 - dip;

    float sd = abs(x) - halfW;       // lateral body
    sd = max(sd, y - tipLen);        // clip at notched tip
    sd = max(sd, -y);                // clip at base

    uvLine = vec2(x, y);
    tAlong = t;
    return sd;
}

void main() {
    float aspect = uResolution.x / uResolution.y;
    vec2 uv = vec2((vUV.x * 2.0 - 1.0) * aspect, vUV.y * 2.0 - 1.0);
    vec2 paperUV = uv;

    vec3 col = uBgColor.rgb;

    int layers = int(clamp(uLayers, 1.0, 5.0) + 0.5);
    // draw outermost ring first, innermost last (on top)
    for (int i = 4; i >= 0; i--) {
        if (i >= layers) continue;
        float fi = float(i);
        float scale = pow(clamp(uLayerScale, 0.4, 1.0), fi);
        float len = uLength * scale;
        float wid = uWidth * scale;
        float twist = uLayerTwist * fi;
        // alternate petal phase so inner rings sit between outer petals
        twist += (PI2 / max(uPetals, 1.0)) * 0.5 * mod(fi, 2.0);

        vec2 uvLine; float tAlong;
        float sd = petalRing(uv, uPetals, len, wid, twist, uvLine, tAlong);
        // inner rings a touch darker for depth
        vec4 ink = uInkColor;
        ink.rgb *= mix(1.0, 0.82, fi / float(max(layers - 1, 1)));
        col = inkStroke(uvLine, paperUV, tAlong, sd, col, ink);
    }

    // faint paper grain — smooth, low amplitude
    col.rgb += (noise01(uv * 180.0) - 0.5) * 0.02;
    col.rgb = clamp(col.rgb, vec3(0.0), vec3(1.0));
    fragColor = vec4(col, 1.0);
}
