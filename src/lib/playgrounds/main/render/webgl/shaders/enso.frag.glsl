#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform vec2  uResolution; // canvas pixels (bristle noise frequency only)
uniform float uRadius;     // ring radius (world units)
uniform float uSweep;      // 0..1 fraction of the stroke drawn (head leads this)
uniform float uAngleStart; // ring start angle (polar atan2(x,y) convention)
uniform float uLineWidth;
uniform float uOpacity;
uniform float uAspect;
uniform float uExt;        // world half-height the quad spans

const float PI2 = 6.28318531;
// CLOCKWISE flips `a` so phase grows with decreasing atan2(x,y), keeping the head at the stroke front.
const bool  CLOCKWISE = true;
uniform vec3 uInkColor;

const float uWobble      = 0.5;
const float uStrands     = 2.5;
const float uWidthEnd    = 0.15; // tapers to a thin tail at the sweep end
const float uWidthOffset = 0.55;
const float uWidthRange  = 1.5;
const float uWidthAnchor = 1.0;
const float uInkFlow     = 2.0;
const float uWaterFlow   = 0.5;

struct Brush {
    float inkFlow;
    float waterFlow;
    float strands;
    float lineWidth;
    float fadeEnds;   // >0.5 = smooth fade to 0 at head & tail (no frayed bristles)
    float bleed;      // >0.5 = soft paper-bleed edge; else hard edge
    float taper;      // scales head->tail ink fade (1 = full, lower = more uniform)
    float stepOffset; // added to uWidthOffset (per-layer width-step shift)
};

// sinless hash (Hoskins hash22)
vec2 hash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return -1.0 + 2.0 * fract((q.xx + q.yz) * q.zy);
}
float noise(in vec2 p) {
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
float rand(vec2 co)   { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
float dtoa(float d, float amount) { return clamp(1.0 / (clamp(d, 1.0 / amount, 1.0) * amount), 0.0, 1.0); }
float smoothf(float x) { return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }

// Coverage (alpha) of the brush stroke at a point in line-space.
float strokeAlpha(vec2 uvLine, float strokeLen, float sdGeometry, float edgeAmt, Brush b) {
    float posInLineY = (uvLine.y / max(strokeLen, 1e-6)) * b.taper;
    float inkFlow = max(b.inkFlow, 0.05);
    float taperEq = mix(1.5, 14.0, smoothstep(0.2, 3.0, inkFlow));
    if (posInLineY > 0.0) posInLineY = pow(posInLineY, taperEq);

    float strandsLocal = max(b.strands, 0.05);
    float strokeBoundary = dtoa(sdGeometry, 300.0);
    float tFine   = noise01(uvLine * vec2(min(uResolution.y, uResolution.x) * 0.10 * strandsLocal, 1.0));
    float tMed    = noise01(uvLine * vec2(34.0 * strandsLocal, 1.0));
    float tCoarse = noise01(uvLine * vec2(8.0  * strandsLocal, 1.0));
    float bristleField = (tFine * 0.12 + tMed * 0.30 + tCoarse * 0.58) * strokeBoundary;
    bristleField = max(0.008, bristleField);

    float water = clamp(b.waterFlow, 0.0, 1.0);
    float texClamped = clamp(bristleField, 0.0, 1.0);
    float lo = mix(0.28, 0.02, water);
    float hi = mix(0.78, 0.38, water);
    float strokeTexture = smoothstep(lo, hi, pow(texClamped, 0.52));

    float strokeAlpha = pow(strokeTexture, (max(0.0, posInLineY) + 0.09) / inkFlow);
    strokeAlpha = 1.09 * max(0.0, strokeAlpha - pow(max(0.0, posInLineY), 0.5));
    strokeAlpha = smoothf(strokeAlpha);

    return clamp(strokeAlpha * dtoa(sdGeometry, edgeAmt), 0.0, 1.0);
}

vec3 deformLine(vec2 uvLine, float lineLength) {
    vec2 h = uvLine;
    float w = max(uWobble, 0.0);
    float linePosY = h.y / max(lineLength, 1e-6);
    h.x += linePosY * 0.24 * w;
    float centerOff = 0.0;
    centerOff += (noise01(vec2(0.0, uvLine.y)) - 0.5) * 0.04 * w;
    centerOff += sin(uvLine.y * 3.0) * 0.019 * w;
    h.x += sin(uvLine.x * 30.0) * 0.02 * w;
    h.x += (noise01(uvLine * 5.0) - 0.5) * 0.005 * w;
    return vec3(h, centerOff);
}

// hu, tailVar/headVar, paperBleedAmt are layer-independent — computed once in main()
float drawStroke(float along, float perp, vec3 hu, float tailVar, float headVar,
                 float paperBleedAmt, float lineLength, float strokeLen, Brush b) {
    float lineWidth = b.lineWidth;

    float tAlong = clamp(along / max(strokeLen, 1e-6), 0.0, 1.0);
    float halfRange = max(uWidthRange, 1e-3) * 0.5;
    // Upper edge pinned to 1.0 so taper always completes at the stroke end.
    float wOff = uWidthOffset + b.stepOffset;
    float widthCurve = smoothstep(wOff - halfRange, wOff + halfRange, tAlong);
    float lineWidth1 = lineWidth * mix(1.0, clamp(uWidthEnd, 0.0, 1.0), widthCurve);

    vec2 huUV = hu.xy;
    float centerOff = hu.z;

    float bodyHalfW = lineWidth1 * 0.5;
    float anchorS = clamp(uWidthAnchor, 0.0, 1.0) * 2.0 - 1.0;
    float bodyCenter = centerOff + anchorS * 0.5 * (lineWidth - lineWidth1);
    float d_body = abs(perp - bodyCenter) - bodyHalfW;

    float edgeAmt = (b.bleed > 0.5) ? paperBleedAmt : 300.0;
    float base = strokeAlpha(huUV, max(strokeLen, 1e-6), d_body, edgeAmt, b);
    float alongClamped = clamp(along, 0.0, lineLength);

    if (b.fadeEnds > 0.5) {
        // cap solid core so the bleed reads as a light wash — halo below the cap
        // is untouched, only the would-be-black core greys down.
        base = min(base, 0.45);
        float t = clamp(alongClamped / max(strokeLen, 1e-6), 0.0, 1.0);
        // tail: smooth opacity fade
        base *= (1.0 - smoothstep(0.82, 1.0, t));
        // head: jagged cut — edge position varies per perp column (1D noise),
        // torn/ragged boundary instead of a soft fade.
        float jag = noise01(vec2(huUV.x * 14.0, 0.0)) * 0.7
                  + noise01(vec2(huUV.x * 34.0, 7.0)) * 0.3;
        float edgePos = jag * 0.22;
        base *= smoothstep(edgePos, edgePos + 0.015, t);
        return base;
    }

    // Cap fadeLen so start/end fade zones never overlap (prevents crushing at small sweep).
    float fadeLen = min(lineWidth * 5.0, strokeLen * 0.45);
    float tailLen = max(fadeLen * mix(0.40, 1.0, tailVar), 1e-5);
    float startFade = smoothstep(0.0, tailLen, alongClamped);
    float headLen = fadeLen * mix(0.15, 1.0, headVar);
    float endFade  = smoothstep(strokeLen, max(strokeLen - headLen, 0.0), alongClamped);
    return base * startFade * endFade;
}

void main() {
    // quad-local UV -> world offset from ring centre (x scaled by aspect, both by ext)
    vec2 uv = vec2((vUV.x * 2.0 - 1.0) * uAspect, vUV.y * 2.0 - 1.0) * uExt;

    float r = length(uv);
    float perp = r - uRadius;
    // radial cull: bleed halo is <~4% alpha past washOut; fade so the cut is seamless
    float washIn  = uLineWidth + 0.2;
    float washOut = uLineWidth + 0.45;
    float aperp = abs(perp);
    if (aperp >= washOut) { fragColor = vec4(uInkColor, 0.0); return; }
    float washWin = 1.0 - smoothstep(washIn, washOut, aperp);

    float a = atan(uv.x, uv.y) - uAngleStart;
    if (CLOCKWISE) a = -a;
    float phase = mod(a, PI2);

    float lineLength = uRadius * PI2;
    float strokeLen = lineLength * clamp(uSweep, 0.0, 1.0);
    float along = phase * uRadius;
    // past the leading edge every layer is exactly 0 — cull the unswept arc
    if (along >= strokeLen) { fragColor = vec4(uInkColor, 0.0); return; }

    vec2 uvLine = vec2(perp, along);
    vec3 hu = deformLine(uvLine, lineLength);
    float paperBleedAmt = 60.0 + (rand(uv.yy) * 30.0) + (rand(uv.xx) * 30.0);

    // 3 stacked passes, wide-light to narrow-dark.
    Brush bleed = Brush(uInkFlow * 0.4,
                        clamp(uWaterFlow * 1.3 + 0.2, 0.0, 1.0),
                        uStrands * 1.6,
                        uLineWidth * 1.0,
                        1.0, 1.0, 1.0, 0.35);
    // bleed fades in across the early sweep; tail/head vars unused on the fadeEnds path
    float aBleed = drawStroke(along, perp, hu, 0.0, 0.0, paperBleedAmt, lineLength, strokeLen, bleed)
                 * smoothstep(0.1, 0.5, uSweep);
    float alpha = aBleed;
    float coreDist = abs(perp - hu.z);
    float coreOut = uLineWidth * 0.8 + 0.15;
    if (coreDist < coreOut) {
        float coreWin = 1.0 - smoothstep(coreOut - 0.08, coreOut, coreDist);
        float bristleT = perp / max(uLineWidth, 1e-4);
        float tailVar = noise01(vec2(bristleT * 5.5, 1.71)) * 0.65
                      + noise01(vec2(bristleT * 13.0, 5.19)) * 0.35;
        float headVar = noise01(vec2(bristleT * 11.0, 8.33)) * 0.65
                      + noise01(vec2(bristleT * 27.3, 13.7)) * 0.35;

        Brush wet = Brush(uInkFlow * 0.7,
                          uWaterFlow * 0.7,
                          uStrands * 0.7,
                          uLineWidth * 0.8,
                          0.0, 0.0, 1.0, 0.2);
        Brush dry = Brush(uInkFlow * 2.8,
                          uWaterFlow * 0.2,
                          uStrands * 0.5,
                          uLineWidth * 0.4,
                          0.0, 0.0, 1.0, 0.0);

        float aWet = drawStroke(along, perp, hu, tailVar, headVar, paperBleedAmt, lineLength, strokeLen, wet) * coreWin;
        float aDry = drawStroke(along, perp, hu, tailVar, headVar, paperBleedAmt, lineLength, strokeLen, dry) * coreWin;
        // over-composite (same ink colour): bleed under, wet, dry on top
        alpha = alpha + aWet * (1.0 - alpha);
        alpha = alpha + aDry * (1.0 - alpha);
    }
    fragColor = vec4(uInkColor, alpha * uOpacity * washWin);
}
