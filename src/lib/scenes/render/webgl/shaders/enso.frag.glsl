#version 300 es
precision highp float;

// Enso circle brush stroke (polar). Ported from shaders/st/enso.glsl: the stroke
// is laid out in polar coords (a ring of radius uRadius about the origin) and
// SWEPT by uSweep (0..1), which the scene drives from the 2D dragon head's
// fraction around the circle -> the head LEADS the growing brush stroke. Renders
// into its own offscreen target with STRAIGHT alpha (ink colour + coverage), so
// it composites behind the glyph like the splash wash.

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uRadius;     // ring radius (world units; world quad spans y[-1,1])
uniform float uSweep;      // 0..1 fraction of the ring drawn (head leads this)
uniform float uAngleStart; // ring start angle (polar atan2(x,y) convention)
uniform float uLineWidth;  // brush thickness (polar line width)
uniform float uClock;      // scene time -> slow bristle drift

const float PI2 = 6.28318531;
// The scene sweeps the head over decreasing angle (ensoPos: ensoA0 - frac*TAU),
// which is INCREASING atan2(x,y); false makes the stroke grow that same way so
// the head stays exactly at the stroke front (it LEADS the brush).
const bool  CLOCKWISE = false;
const vec3  INK = vec3(0.05, 0.05, 0.07);

// brush look (was mouse-driven in the reference; fixed here for a bold enso)
const float uWobble      = 0.5;
const float uStrands     = 1.6;
const float uWidthEnd    = 0.12; // tapers to a thin tail at the sweep end
const float uWidthOffset = 0.92;
const float uWidthRange  = 1.4;
const float uWidthAnchor = 1.0;
const float uInkFlow     = 1.1;
const float uWaterFlow   = 0.7;

vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
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
    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
    vec3 n = h * h * h * h * vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
    return dot(n, vec3(70.0));
}
float noise01(vec2 p) { return clamp((noise(p) + 0.5) * 0.5, 0.0, 1.0); }
float rand(vec2 co)   { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
float dtoa(float d, float amount) { return clamp(1.0 / (clamp(d, 1.0 / amount, 1.0) * amount), 0.0, 1.0); }
float smoothf(float x) { return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }

// Coverage (alpha) of the brush stroke at a point in line-space; mirrors the
// reference colorBrushStroke but returns alpha instead of compositing onto a bg.
float strokeAlpha(vec2 uvLine, vec2 paperUV, vec2 lineSize, float sdGeometry) {
    float posInLineY = uvLine.y / max(lineSize.y, 1e-6);
    float inkFlow = max(uInkFlow, 0.05);
    float taperEq = mix(1.5, 14.0, smoothstep(0.2, 3.0, inkFlow));
    if (posInLineY > 0.0) posInLineY = pow(posInLineY, taperEq);

    float strandsLocal = max(uStrands, 0.05);
    float strokeBoundary = dtoa(sdGeometry, 300.0);
    float tFine   = noise01(uvLine * vec2(min(uResolution.y, uResolution.x) * 0.10 * strandsLocal, 1.0));
    float tMed    = noise01(uvLine * vec2(34.0 * strandsLocal, 1.0));
    float tCoarse = noise01(uvLine * vec2(8.0  * strandsLocal, 1.0));
    float bristleField = (tFine * 0.12 + tMed * 0.30 + tCoarse * 0.58) * strokeBoundary;
    bristleField = max(0.008, bristleField);

    float water = clamp(uWaterFlow, 0.0, 1.0);
    float texClamped = clamp(bristleField, 0.0, 1.0);
    float lo = mix(0.28, 0.02, water);
    float hi = mix(0.78, 0.38, water);
    float strokeTexture = smoothstep(lo, hi, pow(texClamped, 0.52));

    float strokeAlpha = pow(strokeTexture, (max(0.0, posInLineY) + 0.09) / inkFlow);
    strokeAlpha = 1.09 * max(0.0, strokeAlpha - pow(max(0.0, posInLineY), 0.5));
    strokeAlpha = smoothf(strokeAlpha);

    float paperBleedAmt = 60.0 + (rand(paperUV.yy) * 30.0) + (rand(paperUV.xx) * 30.0);
    return clamp(strokeAlpha * dtoa(sdGeometry, paperBleedAmt), 0.0, 1.0);
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

float drawStroke(vec2 uv, vec2 paperUV, float radius_, float sweepAmt, float lineWidth) {
    float lineLength = radius_ * PI2;
    float along = uv.x;
    float perp  = uv.y;
    vec2 uvLine = vec2(perp, along);

    float sweep = clamp(sweepAmt, 0.0, 1.0);
    float strokeLen = lineLength * sweep;

    float tAlong = clamp(along / max(strokeLen, 1e-6), 0.0, 1.0);
    float halfRange = max(uWidthRange, 1e-3) * 0.5;
    float widthCurve = smoothstep(uWidthOffset - halfRange, uWidthOffset + halfRange, tAlong);
    float lineWidth1 = lineWidth * mix(1.0, clamp(uWidthEnd, 0.0, 1.0), widthCurve);

    vec3 hu = deformLine(uvLine, lineLength);
    vec2 huUV = hu.xy;
    float centerOff = hu.z;

    float bodyHalfW = lineWidth1 * 0.5;
    float anchorS = clamp(uWidthAnchor, 0.0, 1.0) * 2.0 - 1.0;
    float bodyCenter = centerOff + anchorS * 0.5 * (lineWidth - lineWidth1);
    float d_body = abs(perp - bodyCenter) - bodyHalfW;

    float base = strokeAlpha(huUV, paperUV, vec2(lineWidth1, max(strokeLen, 1e-6)), d_body);
    // smooth taper at both ends — no hard SDF clips, so no square cuts
    float fadeLen = lineWidth * 3.0;
    float startFade = smoothstep(0.0, fadeLen, along);
    float endFade   = smoothstep(strokeLen, max(strokeLen - fadeLen, 0.0), along);
    return base * startFade * endFade;
}

void main() {
    // world coords: x in [-aspect,aspect], y in [-1,1] (matches the composite quad)
    vec2 uv = (2.0 * gl_FragCoord.xy - uResolution) / uResolution.y;

    float r = length(uv);
    float a = atan(uv.x, uv.y) - uAngleStart;
    if (CLOCKWISE) a = -a;
    float phase = mod(a, PI2);
    vec2 suv = vec2(phase * r, r - uRadius);

    float alpha = drawStroke(suv, uv, uRadius, uSweep, uLineWidth);
    fragColor = vec4(INK, alpha);
}
