#version 300 es
precision highp float;

// POLAR maps the straight-line stroke around a ring; off = cartesian (debug).
const float PI2 = 6.28318531;
const bool  POLAR = true;

in vec2 vUV;
out vec4 fragColor;

uniform vec2  uResolution;
uniform float uClockwise;    // >0.5 sweeps clockwise

uniform float uRadius;
uniform float uAngleStart;
uniform float uLineWidth;
uniform float uWobble;
uniform float uStrands;
uniform float uWidthEnd;
uniform float uWidthOffset;
uniform float uWidthRange;
uniform float uWidthAnchor;
uniform vec4  uBrushColor;
uniform vec4  uBgColor;
uniform float uInkFlow;
uniform float uWaterFlow;
uniform float uSweepAmt;
uniform float uOpacityBleed;
uniform float uOpacityWet;
uniform float uOpacityDry;

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
float rand(vec2 co)   { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
float dtoa(float d, float amount) { return clamp(1.0 / (clamp(d, 1.0/amount, 1.0) * amount), 0.0, 1.0); }
float smoothf(float x) { return x*x*x*(x*(x*6.0 - 15.0) + 10.0); }


// Per-layer brush settings — base uniforms get scaled into 3 of these.
struct Brush {
    float inkFlow;
    float waterFlow;
    float strands;
    float lineWidth;
    float fadeEnds;   // >0.5 = fade to 0 opacity at head & tail (thin body in between)
    float bleed;      // >0.5 = soft paper-bleed edge; else hard edge
    float taper;      // scales head->tail ink fade (1 = full, lower = more uniform)
    float stepOffset; // added to uWidthOffset (per-layer width-step shift)
};

vec3 colorBrushStroke(vec2 uvLine, vec2 paperUV, vec2 lineSize,
                      float sdGeometry, vec3 inpColor, vec4 brushColor, Brush b) {
    float rawPos = uvLine.y / max(lineSize.y, 1e-6);
    float posInLineY = rawPos * b.taper;

    float inkFlow = max(b.inkFlow, 0.05);
    float taperEq = mix(1.5, 14.0, smoothstep(0.2, 3.0, inkFlow));
    if (posInLineY > 0.0) {
        posInLineY = pow(posInLineY, taperEq);
    }

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
    const float strokeAlphaBoost = 1.09;
    strokeAlpha = strokeAlphaBoost * max(0.0, strokeAlpha - pow(max(0.0, posInLineY), 0.5));
    strokeAlpha = smoothf(strokeAlpha);

    float paperBleedAmt = 60.0 + (rand(paperUV.yy) * 30.0) + (rand(paperUV.xx) * 30.0);
    float edge = (b.bleed > 0.5) ? dtoa(sdGeometry, paperBleedAmt) : dtoa(sdGeometry, 300.0);
    float alpha = strokeAlpha * brushColor.a * edge;
    if (b.fadeEnds > 0.5) {
        alpha = min(alpha, 0.45);
        alpha *= (1.0 - smoothstep(0.82, 1.0, rawPos));
        // head: jagged cut, edge position varies per perp column (1D noise)
        float jag = noise01(vec2(uvLine.x * 14.0, 0.0)) * 0.7
                  + noise01(vec2(uvLine.x * 34.0, 7.0)) * 0.3;
        float edgePos = jag * 0.22;
        alpha *= smoothstep(edgePos, edgePos + 0.015, rawPos);
    }
    alpha = clamp(alpha, 0.0, 1.0);
    return mix(inpColor, brushColor.rgb, alpha);
}


vec3 deformLine(vec2 uvLine, float lineLength) {
    vec2 h = uvLine;
    float w = max(uWobble, 0.0);
    float twistAmt = 0.24 * w;
    float linePosY = h.y / max(lineLength, 1e-6);
    h.x += linePosY * twistAmt;

    float centerOff = 0.0;
    centerOff += (noise01(vec2(0.0, uvLine.y) * 1.0) - 0.5) * 0.04 * w;
    centerOff += sin(uvLine.y * 3.0) * 0.019 * w;
    h.x += sin(uvLine.x * 30.0) * 0.02 * w;
    h.x += (noise01(uvLine * 5.0) - 0.5) * 0.005 * w;
    return vec3(h, centerOff);
}

vec3 drawStroke(vec2 uv, vec2 paperUV, vec3 inpColor, vec4 brushColor,
                float radius_, float sweepAmt, Brush b) {
    float lineWidth = b.lineWidth;
    float lineLength = radius_ * PI2;
    float along = uv.x;
    float perp  = uv.y;

    vec2 uvLine = vec2(perp, along);

    float sweep = clamp(sweepAmt, 0.0, 1.0);
    float strokeLen = lineLength * sweep;

    float tAlong = clamp(along / max(strokeLen, 1e-6), 0.0, 1.0);
    float halfRange = max(uWidthRange, 1e-3) * 0.5;
    float wOff = uWidthOffset + b.stepOffset;
    float widthCurve = smoothstep(wOff - halfRange, wOff + halfRange, tAlong);
    float lineWidth1 = lineWidth * mix(1.0, clamp(uWidthEnd, 0.0, 1.0), widthCurve);

    vec3 hu = deformLine(uvLine, lineLength);
    vec2 huUV = hu.xy;
    float centerOff = hu.z;

    float bodyHalfW = lineWidth1 * 0.5;
    float anchorS = clamp(uWidthAnchor, 0.0, 1.0) * 2.0 - 1.0;
    float bodyCenter = centerOff + anchorS * 0.5 * (lineWidth - lineWidth1);
    float d_body = abs(perp - bodyCenter) - bodyHalfW;

    float strandsHead = max(b.strands, 0.05) * 0.15;
    float baseFreq = 25.0 * strandsHead;
    float jPerp = huUV.x;
    float j1 = noise01(vec2(jPerp * baseFreq,       0.0));
    float j2 = noise01(vec2(jPerp * baseFreq * 2.3, 11.3));
    float j3 = noise01(vec2(jPerp * baseFreq * 4.7, 27.7));
    float jitter = j1 * 0.65 + j2 * 0.22 + j3 * 0.13;
    float tipPush = pow(jitter, 1.1) * lineWidth * 2.2;
    if (b.fadeEnds < 0.5) d_body = max(d_body, -(along - tipPush));

    return colorBrushStroke(huUV, paperUV, vec2(lineWidth1, max(strokeLen, 1e-6)),
                            d_body, inpColor, brushColor, b);
}

void main() {
    float aspect = uResolution.x / uResolution.y;
    vec2 uv = vec2((vUV.x * 2.0 - 1.0) * aspect, vUV.y * 2.0 - 1.0);

    vec2 suv;
    if (POLAR) {
        float r = length(uv);
        float a = atan(uv.x, uv.y) - uAngleStart;
        if (uClockwise > 0.5) a = -a;
        float phase = mod(a, PI2);
        suv = vec2(phase * r, r - uRadius);
    } else {
        suv = vec2(uv.x + aspect - uAngleStart * uRadius, uv.y - uRadius);
    }

    vec3 col = uBgColor.rgb;

    // 3 stacked passes, wide-light to narrow-dark.
    // bleed: high water, low ink, fine strands — soft paper-bleed wash, fades at ends
    Brush bleed = Brush(uInkFlow * 0.4,
                        clamp(uWaterFlow * 1.3 + 0.2, 0.0, 1.0),
                        uStrands * 1.6,
                        uLineWidth * 1.0,
                        1.0, 1.0, 1.0, 0.35);
    // wet: medium ink, big strands
    Brush wet = Brush(uInkFlow * 0.3,
                      clamp(uWaterFlow * 1.5 + 0.5, 0.0, 1.0),
                      uStrands * 0.7,
                      uLineWidth * 0.8,
                      0.0, 0.0, 1.0, 0.2);
    // dry: rich ink, low water, big strands (narrow dark core, on top)
    Brush dry = Brush(uInkFlow * 2.8,
                      uWaterFlow * 0.2,
                      uStrands * 0.5,
                      uLineWidth * 0.4,
                      0.0, 0.0, 1.0, 0.0);

    float bleedSweepGate = smoothstep(0.1, 0.5, uSweepAmt);
    vec4 inkBleed = vec4(uBrushColor.rgb, uBrushColor.a * clamp(uOpacityBleed, 0.0, 1.0) * bleedSweepGate);
    vec4 inkWet   = vec4(uBrushColor.rgb, uBrushColor.a * clamp(uOpacityWet, 0.0, 1.0));
    vec4 inkDry   = vec4(uBrushColor.rgb, uBrushColor.a * clamp(uOpacityDry, 0.0, 1.0));

    col = drawStroke(suv, uv, col, inkBleed, uRadius, uSweepAmt, bleed);
    col = drawStroke(suv, uv, col, inkWet,   uRadius, uSweepAmt, wet);
    col = drawStroke(suv, uv, col, inkDry,   uRadius, uSweepAmt, dry);

    col.rgb += (rand(uv) - 0.5) * 0.05;
    col.rgb = clamp(col.rgb, vec3(0.0), vec3(1.0));
    fragColor = vec4(col, 1.0);
}
