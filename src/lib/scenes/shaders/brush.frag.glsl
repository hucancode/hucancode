precision highp float;

uniform vec2  iResolution;
uniform sampler2D curveTex;   // RGBA float: xy=point(world), z=arcLen, w=unused
uniform int   curveLen;       // number of points
uniform float curveTotalLen;
uniform float uWidth;         // world units
uniform float uTaper;         // 1..16, higher = less taper / sharper end
uniform float uInkFlow;       // 0..1, 1=consistent, 0=blacker at tip, fades to tail
uniform float uOpacity;       // global multiplier on stroke alpha
uniform float uWobble;        // 0..1 scale on edge wobble amplitude
uniform float uWidthEnd;      // tail width as fraction of head width (1.0 = uniform, 0.0 = pinch to nothing)
uniform float uWidthOffset;   // width step centre along the stroke (0 = head/tip .. 1 = tail)
uniform float uWidthRange;    // width step transition width (small = hard step, large = gradual)
uniform vec4  uBrushColor;
uniform vec4  uBgColor;

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

// returns vec3(signedDist, arcLenAtClosest, _)
vec3 sdPolyline(vec2 p) {
    // Coarse: sample every STRIDE-th point to find nearest region
    const int STRIDE = 8;
    float coarseBest = 1e9;
    int coarseI = 0;
    for (int i = 0; i < 32; i++) {
        int idx = i * STRIDE;
        if (idx >= curveLen) break;
        float d = length(p - sampleCurve(idx).xy);
        if (d < coarseBest) { coarseBest = d; coarseI = idx; }
    }
    // Fine: full segment check within ±STRIDE of closest point
    float bestAbs = 1e9;
    float bestSigned = 1e9;
    float bestArc = 0.0;
    int flo = max(0, coarseI - STRIDE);
    int fhi = min(curveLen - 1, coarseI + STRIDE);
    for (int i = 0; i < 16; i++) {
        int idx = flo + i;
        if (idx >= fhi) break;
        vec3 a3 = sampleCurve(idx);
        vec3 b3 = sampleCurve(idx + 1);
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

float brushStrokeAlpha(vec2 uvLine, vec2 uvPaper, vec2 lineSize,
                       float sdGeometry, float brushAlpha) {
    float posInLineY = uvLine.y / max(lineSize.y, 1e-6);
    float rawPosInLineY = clamp(posInLineY, 0.0, 1.0);

    if (posInLineY > 0.0) {
        posInLineY = pow(posInLineY, uTaper);
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
    float flowMul = mix(smoothstep(1.0, 0.0, rawPosInLineY), 1.0, uInkFlow);
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

    // 'over' composite: stroke over background
    float outA = strokeA + uBgColor.a * (1.0 - strokeA);
    vec3 outRGB = (strokeA * uBrushColor.rgb + uBgColor.rgb * uBgColor.a * (1.0 - strokeA)) / max(outA, 1e-6);
    gl_FragColor = vec4(outRGB, outA);
}
