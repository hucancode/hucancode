#version 300 es
precision highp float;

uniform float uInkFlow;
uniform float uStrands;
uniform float uWaterFlow;
uniform float uWobble;
uniform float uOpacity;
uniform float uWidthEnd;       // tail width as fraction of head width
uniform float uWidthOffset;    // width step centre (0 = tip .. 1 = tail)
uniform float uWidthRange;     // width step transition softness
uniform float uWidthAnchor;    // 0=inside, 0.5=center, 1=outside
uniform float uPerpClearance;  // 0..<0.5: fraction of mesh perp_t reserved per side for ink bleed
uniform float uArcClearance;   // 0..<0.5: same, at tip and tail ends
uniform vec4  uBrushColor;

in vec2 vUV01;   // (perp_t, arc_t), both in 0..1; stroke band sits in the central
in vec2 vWorld;  // sub-rectangle [c, 1-c] × [c, 1-c] (per-axis clearances differ)

out vec4 fragColor;

// ---------- noise / util ----------
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

// uvLine.x in roughly [-0.5, 0.5] (perp shifted to centre), .y is relArc 0..1.
// strokeLen here is normalized to 1 since the mesh covers a unit square.
float brushStrokeAlpha(vec2 uvLine, vec2 paperUV,
                       float sdGeometry, float brushAlpha) {
    float posInLineY = uvLine.y;

    float inkFlow = max(uInkFlow, 0.05);
    float taperEq = mix(1.5, 14.0, smoothstep(0.2, 3.0, inkFlow));
    if (posInLineY > 0.0) posInLineY = pow(posInLineY, taperEq);

    float strandsLocal = max(uStrands, 0.05);
    float water = clamp(uWaterFlow, 0.0, 1.0);
    // Water drives bleed geometry: more water = slower SDF falloff = wider halo.
    float boundaryFalloff = mix(300.0, 8.0, water);
    float strokeBoundary = dtoa(sdGeometry, boundaryFalloff);

    float pxScale = 0.10 / max(fwidth(uvLine.x), 1e-6);
    float tFine   = noise01(uvLine * vec2(pxScale * strandsLocal, 1.0));
    float tMed    = noise01(uvLine * vec2(6.0  * strandsLocal, 1.0));
    float tCoarse = noise01(uvLine * vec2(1.0  * strandsLocal, 1.0));
    float bristleField = (tFine * 0.12 + tMed * 0.30 + tCoarse * 0.58) * strokeBoundary;
    bristleField = max(0.008, bristleField);

    float texClamped = clamp(bristleField, 0.0, 1.0);
    // Water also softens the bristle threshold: dry = narrow band (sharp edge),
    // wet = wide band (gradient bleed). Combined with the falloff above this
    // makes water a single, monotonic sideways-spread control.
    float lo = mix(0.55, 0.02, water);
    float hi = mix(0.70, 0.40, water);
    float strokeTexture = smoothstep(lo, hi, pow(texClamped, 0.52));

    float strokeAlpha = pow(strokeTexture, (max(0.0, posInLineY) + 0.09) / inkFlow);
    const float strokeAlphaBoost = 1.09;
    strokeAlpha = strokeAlphaBoost * max(0.0, strokeAlpha - pow(max(0.0, posInLineY), 0.5));
    strokeAlpha = smoothf(strokeAlpha);

    float paperBleedAmt = (60.0 + (rand(paperUV.yy) * 30.0) + (rand(paperUV.xx) * 30.0))
                          * mix(1.0, 0.18, water);
    float alpha = strokeAlpha * brushAlpha * dtoa(sdGeometry, paperBleedAmt);
    return clamp(alpha, 0.0, 1.0);
}

void main() {
    float perp_t = vUV01.x;
    float arc_t  = vUV01.y;

    float invArcSpan  = 1.0 / max(1.0 - 2.0 * uArcClearance,  1e-6);
    float invPerpSpan = 1.0 / max(1.0 - 2.0 * uPerpClearance, 1e-6);

    float arcInPoly  = (arc_t  - uArcClearance ) * invArcSpan;   // 0 tail .. 1 tip
    float perpInPoly = (perp_t - uPerpClearance) * invPerpSpan;  // 0..1 across stroke band

    float relArc  = 1.0 - arcInPoly;                  // 0 at tip, 1 at tail; outside [0,1] in clearance zones
    float relArcC = clamp(relArc, 0.0, 1.0);

    float halfRange = max(uWidthRange, 1e-3) * 0.5;
    float widthCurve = smoothstep(uWidthOffset - halfRange, uWidthOffset + halfRange, relArcC);
    float widthFrac = mix(1.0, clamp(uWidthEnd, 0.0, 1.0), widthCurve);
    float halfW = widthFrac * 0.5;

    float anchorS = clamp(uWidthAnchor, 0.0, 1.0) * 2.0 - 1.0;
    float center = 0.5 + anchorS * 0.5 * (1.0 - widthFrac);

    float w = max(uWobble, 0.0);
    float twist = relArcC * 0.06 * w;
    center += twist;
    center += (noise01(vec2(0.0, arcInPoly)) - 0.5) * 0.04 * w;
    center += sin(arcInPoly * 12.0) * 0.012 * w;
    center += (noise01(vec2(arcInPoly * 4.0, perpInPoly * 4.0)) - 0.5) * 0.01 * w;

    float perpOff      = perpInPoly - center;
    float overflowTip  = max(0.0, -relArc);
    float overflowTail = max(0.0, relArc - 1.0);
    float overflow     = overflowTip + overflowTail;

    // Round-cap SDF: distance to the fat line segment. Inside [tail..tip]
    // (overflow = 0) it collapses to abs(perpOff) - halfW.
    float d = sqrt(overflow * overflow + perpOff * perpOff) - halfW;

    // bristle tip jitter - carves bristle ends near relArc = 0
    float strandsHead = max(uStrands, 0.05) * 0.15;
    float baseFreq = 25.0 * strandsHead;
    float j1 = noise01(vec2(perpInPoly * baseFreq,       0.0));
    float j2 = noise01(vec2(perpInPoly * baseFreq * 2.3, 11.3));
    float j3 = noise01(vec2(perpInPoly * baseFreq * 4.7, 27.7));
    float jitter = j1 * 0.65 + j2 * 0.22 + j3 * 0.13;
    float tipPush = pow(jitter, 1.1) * 0.25;
    d = max(d, -(relArc - tipPush));

    vec2 uvLine = vec2(perpOff, relArcC);
    float inkA = brushStrokeAlpha(uvLine, vWorld, d, uBrushColor.a);
    inkA = clamp(inkA * uOpacity, 0.0, 1.0);

    fragColor = vec4(uBrushColor.rgb, inkA);
}
