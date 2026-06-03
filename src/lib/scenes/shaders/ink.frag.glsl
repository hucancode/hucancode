precision highp float;

uniform vec2  iResolution;
uniform float uRadius;
uniform float uAngleStart;
uniform float uSweepAmt;       // 0..1, portion of circle covered by stroke
uniform float uLineWidth;
uniform float uClockwise;      // 0.0 = ccw, 1.0 = cw
uniform float uTaper;          // taper exponent (1.5 = mild, 16 = sharp)
uniform float uWobble;         // 0..1 multiplier on humanize displacements
uniform float uWidthEnd;       // tail width as fraction of tip width (1.0 = uniform, 0.0 = pinch to nothing)
uniform float uWidthTaperPow;  // width-distribution curve exponent (1=linear, >1=stays thick longer, <1=drops fast)
uniform float uWidthAlign;     // stroke alignment vs base radius: -1=inside, 0=center, +1=outside
uniform vec4  uBrushColor;
uniform vec4  uBgColor;

varying vec2 vUV;

const float PI  = 3.14159265;
const float PI2 = 6.28318531;

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

vec3 colorBrushStroke(vec2 uvLine, vec2 uvPaper, vec2 lineSize,
                      float sdGeometry, vec3 inpColor, vec4 brushColor) {
    float posInLineY = uvLine.y / max(lineSize.y, 1e-6);

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
    float alpha = strokeAlpha * brushColor.a * dtoa(sdGeometry, paperBleedAmt);
    alpha = clamp(alpha, 0.0, 1.0);
    return mix(inpColor, brushColor.rgb, alpha);
}

vec3 humanizeBrushStrokeDonut(vec2 uvLine, float radius_, float lineLength) {
    vec2 h = uvLine;
    float w = max(uWobble, 0.0);
    float twistAmt = 0.24 * w;
    float linePosY = h.y / max(lineLength, 1e-6);
    h.x += linePosY * twistAmt;

    // humanizedRadius must depend ONLY on uvLine.y (along-stroke position).
    // If it depended on uvLine.x (perp), every body pixel at the same angle would
    // see a different ring radius — making the ring a fuzzy band and the cap
    // (single huR) detached from it as wobble grows.
    float humanizedRadius = radius_;
    humanizedRadius += (noise01(vec2(0.0, uvLine.y) * 1.0) - 0.5) * 0.04 * w;
    humanizedRadius += sin(uvLine.y * 3.0) * 0.019 * w;
    h.x += sin(uvLine.x * 30.0) * 0.02 * w;
    h.x += (noise01(uvLine * 5.0) - 0.5) * 0.005 * w;
    return vec3(h, humanizedRadius);
}

vec3 colorBrushStrokeDonut(vec2 uv, vec3 inpColor, vec4 brushColor,
                           vec2 o, float radius_, float angleStart,
                           float sweepAmt, float lineWidth, bool clockwise) {
    vec2 rel = uv - o;
    // atan(x,y) measures angle from +Y going CW (matches the (sin,cos) basis used below).
    // The +PI then -PI dance in the original implementation cancels out at the start
    // pixel, so along=0 corresponds to the start position regardless of cw/ccw.
    float angle = atan(rel.x, rel.y) + PI;     // 0..2pi
    angle = mod(angle - angleStart + PI, PI2);
    if (!clockwise) angle = PI2 - angle;
    float lineLength = radius_ * PI2;
    float along = angle / PI2 * lineLength;

    vec2 uvLine = vec2(radius_ - length(rel), along);

    float sweep = clamp(sweepAmt, 0.0, 1.0);
    float strokeLen = lineLength * sweep;

    // width distribution: full at tip (start), uWidthEnd at tail.
    // pow(1-t, uWidthTaperPow) shapes the falloff curve.
    float tAlong = clamp(along / max(strokeLen, 1e-6), 0.0, 1.0);
    float widthCurve = pow(1.0 - tAlong, max(uWidthTaperPow, 1e-3));
    float lineWidth1 = lineWidth * mix(clamp(uWidthEnd, 0.0, 1.0), 1.0, widthCurve);

    vec3 hu = humanizeBrushStrokeDonut(uvLine, radius_, lineLength);
    vec2 huUV = hu.xy;
    float huR = hu.z;

    // Body geometry: ring SDF. Unswept arc is killed by taper alpha (posInLineY > 1
    // drives strokeAlpha to 0), so no hard distance clip — that would re-introduce
    // the tail cut.
    // uWidthAlign shifts ring center inward/outward. Scaled by (1 - widthEnd) so
    // uniform strokes (widthEnd ≈ 1) get no shift — align is only meaningful when
    // there's a taper to anchor against the base radius.
    float bodyHalfW = lineWidth1 * 0.5;
    float alignFactor = 1.0 - clamp(uWidthEnd, 0.0, 1.0);
    float bodyCenterR = huR + clamp(uWidthAlign, -1.0, 1.0) * alignFactor * (lineWidth * 0.5);
    float d_body = abs(length(rel) - bodyCenterR) - bodyHalfW;

    // lineSize.y = strokeLen so posInLineY reaches 1.0 (full taper fade-out)
    // exactly at the body clip boundary — eliminates the hard cut at the tail.
    vec3 ret = colorBrushStroke(huUV, uv, vec2(lineWidth1, max(strokeLen, 1e-6)),
                                d_body, inpColor, brushColor);

    // Solid round cap at the stroke START (where brush touches paper).
    // The faded END needs no cap — taper handles its falloff naturally;
    // a solid dot there would clash with the fade.
    // Also covers the body seam at angleStart when sweep≈1 and the CCW start
    // hole (start pixel maps to along=lineLength → outside [0,strokeLen]).
    vec2 startUVLine = vec2(0.0, 0.0);
    vec3 huStart = humanizeBrushStrokeDonut(startUVLine, radius_, lineLength);
    // shift cap center by same scaled align offset so cap seams with body
    // (alignFactor=0 when uniform → cap stays at base radius)
    float capCenterR = huStart.z + clamp(uWidthAlign, -1.0, 1.0) * alignFactor * (lineWidth * 0.5);
    vec2 startPos = o + vec2(sin(angleStart), cos(angleStart)) * capCenterR;
    float dStart = distance(uv, startPos) - lineWidth * 0.5;
    vec2 capUV = vec2(huUV.x, 0.0);
    vec3 startCol = colorBrushStroke(capUV, uv, vec2(lineWidth, lineLength),
                                     dStart, inpColor, brushColor);
    return min(ret, startCol);
}

void main() {
    float aspect = iResolution.x / iResolution.y;
    vec2 uv = vec2((vUV.x * 2.0 - 1.0) * aspect, vUV.y * 2.0 - 1.0);

    vec3 col = uBgColor.rgb;
    col = colorBrushStrokeDonut(uv, col, uBrushColor,
                                vec2(0.0, 0.0),
                                uRadius,
                                uAngleStart,
                                uSweepAmt,
                                uLineWidth,
                                uClockwise > 0.5);
    col.rgb += (rand(uv)-.5)*.08;
    col.rgb = clamp(col.rgb, vec3(0), vec3(1));
    gl_FragColor = vec4(col, 1.0);
}
