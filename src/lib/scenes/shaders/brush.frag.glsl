precision highp float;

uniform vec2  iResolution;
uniform sampler2D curveTex;   // RGBA float: xy=point(world), z=arcLen(per-chain), w=unused
uniform int   curveLen;       // body sample count
uniform float curveTotalLen;  // body total arc length
uniform int   curveW1Start;   // index where whisker 1 samples begin in curveTex
uniform int   curveW1Len;
uniform float curveW1TotalLen;
uniform int   curveW2Start;
uniform int   curveW2Len;
uniform float curveW2TotalLen;
uniform float uWhiskerWidth;  // world units, half-width applied at base
uniform float uWidth;         // world units
uniform float uInkFlow;       // 0..1 wet/dry: high = flat ink + sharp tail taper; low = head-loaded + early fade
uniform float uOpacity;       // global multiplier on stroke alpha
uniform float uWobble;        // 0..1 scale on edge wobble amplitude
uniform float uWidthEnd;      // tail width as fraction of head width (1.0 = uniform, 0.0 = pinch to nothing)
uniform float uWidthOffset;   // width step centre along the stroke (0 = head/tip .. 1 = tail)
uniform float uWidthRange;    // width step transition width (small = hard step, large = gradual)
uniform vec4  uBrushColor;
uniform vec4  uBgColor;
uniform vec2  uHeadPos;       // world-space tip position
uniform vec2  uHeadDir;       // normalized chain direction at tip (nose points along this)
uniform float uHeadSize;      // world units per local-space unit
uniform float uShowHead;      // 0 = hidden, 1 = visible

varying vec2 vUV;

const float PI  = 3.14159265;
const float PI2 = 6.28318531;

// ---------- noise / hash ----------
vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)),
             dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
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
float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
float dtoa(float d, float amount) {
    return clamp(1.0 / (clamp(d, 1.0/amount, 1.0) * amount), 0.0, 1.0);
}
float smoothf(float x) { return x*x*x*(x*(x*6.0 - 15.0) + 10.0); }

// ---------- curve sampling ----------
uniform float curveTexWidth;  // float(curveLen) for normalized lookup
vec3 sampleCurve(int i) {
    float u = (float(i) + 0.5) / curveTexWidth;
    return texture2D(curveTex, vec2(u, 0.5)).xyz;
}

// project p onto segment ab. returns (signedDist, t in [0,1], segLen)
// sign convention: positive on right of direction a->b
vec3 segProject(vec2 p, vec2 a, vec2 b) {
    vec2 d = b - a;
    float L = max(length(d), 1e-6);
    vec2 n = d / L;
    vec2 ap = p - a;
    float t = clamp(dot(ap, n), 0.0, L);
    vec2 q = a + n * t;
    vec2 perp = p - q;
    float side = sign(perp.x * n.y - perp.y * n.x);
    if (side == 0.0) side = 1.0;
    return vec3(length(perp) * side, t / L, L);
}

// returns vec3(signedDist, arcLenAtClosest, _) over [startIdx, startIdx+len)
vec3 sdPolylineRange(vec2 p, int startIdx, int len) {
    if (len < 2) return vec3(1e9, 0.0, 0.0);
    const int STRIDE = 8;
    float coarseBest = 1e9;
    int coarseI = 0;
    for (int i = 0; i < 64; i++) {
        int idx = i * STRIDE;
        if (idx >= len) break;
        float d = length(p - sampleCurve(startIdx + idx).xy);
        if (d < coarseBest) { coarseBest = d; coarseI = idx; }
    }
    float bestAbs = 1e9;
    float bestSigned = 1e9;
    float bestArc = 0.0;
    int flo = max(0, coarseI - STRIDE);
    int fhi = min(len - 1, coarseI + STRIDE);
    for (int i = 0; i < 16; i++) {
        int idx = flo + i;
        if (idx >= fhi) break;
        vec3 a3 = sampleCurve(startIdx + idx);
        vec3 b3 = sampleCurve(startIdx + idx + 1);
        vec3 r  = segProject(p, a3.xy, b3.xy);
        float ad = abs(r.x);
        if (ad < bestAbs) {
            bestAbs = ad;
            bestSigned = r.x;
            bestArc = a3.z + r.y * r.z;
        }
    }
    return vec3(bestSigned, bestArc, 0.0);
}

vec3 sdPolyline(vec2 p) {
    return sdPolylineRange(p, 0, curveLen);
}

// Thin tapered whisker stroke. arc=0 at anchor (base), arc=totalLen at free end.
float whiskerAlpha(int startIdx, int len, float totalLen, vec2 p) {
    if (len < 2) return 0.0;
    vec3 pr = sdPolylineRange(p, startIdx, len);
    float t = clamp(pr.y / max(totalLen, 1e-6), 0.0, 1.0);
    // taper: full base width -> ~25% at tip
    float halfW = uWhiskerWidth * 0.5 * mix(1.0, 0.25, t);
    float d = abs(pr.x) - halfW;
    float aa = 2.5 / iResolution.y;
    float edge = 1.0 - smoothstep(0.0, aa, d);
    // slight noise dither along arc so it looks ink-like
    float n = noise01(vec2(pr.y * 80.0, pr.x * 200.0));
    edge *= mix(0.85, 1.0, n);
    return edge * uBrushColor.a;
}

// ---------- dragon head SDF ----------
float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    return sdSegment(p, a, b) - r;
}
float sdEllipse(vec2 p, vec2 r) {
    return (length(p / r) - 1.0) * min(r.x, r.y);
}
float smin2(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Top-down chinese dragon head silhouette.
// Local frame: nose tip near (0,0), dragon body extends in -x direction.
float sdDragonHead(vec2 p) {
    vec2 pm = vec2(p.x, abs(p.y)); // mirror about x axis

    // Snout: long narrow capsule tapering from nose back into head
    float snout = sdCapsule(p, vec2(0.05, 0.0), vec2(-0.55, 0.0), 0.08);
    // Head dome at back
    float dome = sdEllipse(p - vec2(-0.82, 0.0), vec2(0.34, 0.32));
    // Cheek bumps along sides of head
    float cheek = sdCapsule(pm, vec2(-0.55, 0.0), vec2(-0.78, 0.26), 0.07);
    float head = smin2(snout, dome, 0.12);
    head = smin2(head, cheek, 0.06);

    // Lower jaw chunk (slight protrusion below snout center)
    float jaw = sdEllipse(p - vec2(-0.30, 0.0), vec2(0.22, 0.13));
    head = smin2(head, jaw, 0.08);

    // Horns: from back of head, swept out and back
    float horn = sdCapsule(pm, vec2(-0.85, 0.18), vec2(-1.30, 0.46), 0.040);
    float hornTip = sdCapsule(pm, vec2(-1.30, 0.46), vec2(-1.48, 0.62), 0.022);
    float horns = min(horn, hornTip);

    // Mane spikes radiating from back of head
    float mane1 = sdCapsule(pm, vec2(-1.05, 0.10), vec2(-1.40, 0.18), 0.028);
    float mane2 = sdCapsule(p,  vec2(-1.10, 0.00), vec2(-1.50, 0.00), 0.030);
    float mane  = min(mane1, mane2);

    float d = head;
    d = min(d, horns);
    d = min(d, mane);
    return d;
}

float brushStrokeAlpha(vec2 uvLine, vec2 uvPaper, vec2 lineSize,
                       float sdGeometry, float brushAlpha) {
    float posInLineY = uvLine.y / max(lineSize.y, 1e-6);
    float rawPosInLineY = clamp(posInLineY, 0.0, 1.0);

    // wet (high inkFlow) → sharp taper kept near tail. dry (low) → early fade.
    float inkFlow = clamp(uInkFlow, 0.0, 1.0);
    float taperEq = mix(1.5, 14.0, inkFlow);
    if (posInLineY > 0.0) {
        posInLineY = pow(posInLineY, taperEq);
    }

    float strokeBoundary = dtoa(sdGeometry, 300.0);
    float strokeTexture = 0.0
        + noise01(uvLine * vec2(min(iResolution.y, iResolution.x) * 0.2, 1.0))
        + noise01(uvLine * vec2(79.0, 1.0))
        + noise01(uvLine * vec2(14.0, 1.0));
    strokeTexture *= 0.333 * strokeBoundary;
    strokeTexture = max(0.008, strokeTexture);

    float strokeAlpha = pow(strokeTexture, max(0.0, posInLineY) + 0.09);
    const float strokeAlphaBoost = 1.09;
    if (posInLineY > 0.0)
        strokeAlpha = strokeAlphaBoost * max(0.0, strokeAlpha - pow(posInLineY, 0.5));
    else
        strokeAlpha *= strokeAlphaBoost;

    strokeAlpha = smoothf(strokeAlpha);

    float paperBleedAmt = 60.0 + (rand(uvPaper.yy) * 30.0) + (rand(uvPaper.xx) * 30.0);
    paperBleedAmt *= 5.0;
    float alpha = strokeAlpha * brushAlpha * dtoa(sdGeometry, paperBleedAmt);
    float flowMul = mix(smoothstep(1.0, 0.0, rawPosInLineY), 1.0, inkFlow);
    alpha *= flowMul;
    return clamp(alpha, 0.0, 1.0);
}

void main() {
    // map screen UV [0,1] -> world [-aspect..aspect, -1..1]
    float aspect = iResolution.x / iResolution.y;
    vec2 p = vec2((vUV.x * 2.0 - 1.0) * aspect, vUV.y * 2.0 - 1.0);

    if (curveLen < 2) {
        gl_FragColor = uBgColor;
        return;
    }

    vec3 pr = sdPolyline(p);
    float sd = pr.x;
    float arc = pr.y;

    float visibleLen = max(curveTotalLen, 1e-6);

    // brush "head" is the tip (dragged end = high arc), so relArc runs 0 at the
    // head up to visibleLen at the tail. tAlong is the normalized along-stroke
    // distance from the head (0 = head/tip .. 1 = tail).
    float relArc = visibleLen - arc;

    // width distribution along the stroke (ported from the ink playground):
    // full width (1.0) at the head, uWidthEnd at the tail, blended by a smoothstep
    // "step" whose centre (uWidthOffset) and softness (uWidthRange) are controllable.
    //   uWidthOffset moves where the width drops (low = drops early, high = drops late),
    //   uWidthRange sets how soft the drop is (small = abrupt step, large = gradual).
    float tAlong = clamp(relArc / visibleLen, 0.0, 1.0);
    float halfRange = max(uWidthRange, 1e-3) * 0.5;
    float widthCurve = smoothstep(uWidthOffset - halfRange, uWidthOffset + halfRange, tAlong);
    float w = uWidth * mix(1.0, clamp(uWidthEnd, 0.0, 1.0), widthCurve);

    // humanize: modulate stroke half-width using a continuous function of arc.
    // applied identically in body and cap branches so the SDF stays continuous
    // across the body/cap boundary — shifting sd asymmetrically (signed perp
    // dist in body vs unsigned radial dist in caps) makes tip visibly detach.
    float wobble = (noise01(vec2(arc * 8.0, 0.0)) - 0.5) * uWidth * 0.25 * uWobble;
    float halfW = max(0.0, w * 0.5 + wobble);
    float d = abs(sd) - halfW;

    vec2 uvLine = vec2(sd, relArc);
    float strokeA = brushStrokeAlpha(uvLine, p, vec2(w, visibleLen), d, uBrushColor.a) * uOpacity;

    // Dragon head silhouette at chain tip
    float headA = 0.0;
    if (uShowHead > 0.5 && uHeadSize > 1e-4) {
        vec2 hd = uHeadDir;
        float hl = length(hd);
        if (hl > 1e-5) {
            hd /= hl;
            vec2 perp = vec2(-hd.y, hd.x);
            vec2 rel = p - uHeadPos;
            // local: x = along direction (positive = forward, into nose), y = perpendicular
            vec2 pLocal = vec2(dot(rel, hd), dot(rel, perp)) / uHeadSize;
            // pivot at eye: shift so eye lands at chain tip (snout protrudes forward)
            const float EYE_OFFSET = 0.55;
            float headSD = sdDragonHead(pLocal - vec2(EYE_OFFSET, 0.0)) * uHeadSize;
            float aa = 2.0 / iResolution.y;
            headA = (1.0 - smoothstep(-aa, aa, headSD)) * uBrushColor.a;
        }
    }

    float w1A = whiskerAlpha(curveW1Start, curveW1Len, curveW1TotalLen, p);
    float w2A = whiskerAlpha(curveW2Start, curveW2Len, curveW2TotalLen, p);

    float inkA = max(max(strokeA, headA), max(w1A, w2A));

    // 'over' composite: ink over background
    float outA = inkA + uBgColor.a * (1.0 - inkA);
    vec3 outRGB = (inkA * uBrushColor.rgb + uBgColor.rgb * uBgColor.a * (1.0 - inkA)) / max(outA, 1e-6);
    gl_FragColor = vec4(outRGB, outA);
}
