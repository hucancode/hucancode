precision highp float;

uniform int uMode;
const int MODE_POLAR     = 0;
const int MODE_CARTESIAN = 1;
const int MODE_POLYLINE  = 2;

uniform vec2  iResolution;
uniform float uInkFlow;        // wet/dry: high = floods gaps + sharp taper, low = dries early
uniform float uStrands;        // bristle density across the stroke width
uniform float uWaterFlow;      // 0..1, dry/sparse → wet/solid ink (uniform across stroke)
uniform float uWobble;         // 0..1 multiplier on humanize displacements
uniform float uOpacity;        // global multiplier on stroke alpha
uniform float uLineWidth;      // stroke width (world units)
uniform float uWidthEnd;       // tail width as fraction of head width
uniform float uWidthOffset;    // width step centre (0 = tip .. 1 = tail)
uniform float uWidthRange;     // width step transition softness
uniform vec4  uBrushColor;
uniform vec4  uBgColor;

// POLAR / CARTESIAN mode
uniform float uRadius;
uniform float uAngleStart;
uniform float uSweepAmt;
uniform float uClockwise;
uniform float uWidthAnchor;    // stroke edge anchor: 0=inside, 0.5=center, 1=outside

// POLYLINE mode (more computation)
uniform sampler2D curveTex;
uniform float curveTexWidth;
uniform int   curveLen;
uniform float curveTotalLen;

varying vec2 vUV;

const float PI  = 3.14159265;
const float PI2 = 6.28318531;

// CPU-built spatial grid for body polyline.
// Texture layout: GRID_W*2 × GRID_H, RGBA float. Each cell = 2 RGBA pixels = 8 segment IDs.
// Empty slot = -1.
uniform sampler2D gridTex;
uniform vec2 gridSize;       // (GRID_W, GRID_H)
uniform vec2 gridOrigin;     // world bbox min
uniform vec2 gridCellSize;   // world cell size

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

float brushStrokeAlpha(vec2 uvLine, vec2 paperUV, vec2 lineSize,
                       float sdGeometry, float brushAlpha) {
    float rawPos = uvLine.y / max(lineSize.y, 1e-6);
    float posInLineY = rawPos;

    float inkFlow = max(uInkFlow, 0.05);
    float taperEq = mix(1.5, 14.0, smoothstep(0.2, 3.0, inkFlow));
    if (posInLineY > 0.0) {
        posInLineY = pow(posInLineY, taperEq);
    }

    float strandsLocal = max(uStrands, 0.05);
    float strokeBoundary = dtoa(sdGeometry, 300.0);

    float tFine   = noise01(uvLine * vec2(min(iResolution.y, iResolution.x) * 0.10 * strandsLocal, 1.0));
    float tMed    = noise01(uvLine * vec2(34.0 * strandsLocal, 1.0));
    float tCoarse = noise01(uvLine * vec2(8.0  * strandsLocal, 1.0));
    float bristleField = (tFine * 0.12 + tMed * 0.30 + tCoarse * 0.58) * strokeBoundary;
    bristleField = max(0.008, bristleField);

    float water = clamp(uWaterFlow, 0.0, 1.0);
    float texClamped = clamp(bristleField, 0.0, 1.0);
    float lo = mix(0.58, 0.02, water);
    float hi = mix(0.78, 0.68, water);
    float strokeTexture = smoothstep(lo, hi, pow(texClamped, 0.52));

    float strokeAlpha = pow(strokeTexture, (max(0.0, posInLineY) + 0.09) / inkFlow);
    const float strokeAlphaBoost = 1.09;
    strokeAlpha = strokeAlphaBoost * max(0.0, strokeAlpha - pow(max(0.0, posInLineY), 0.5));
    strokeAlpha = smoothf(strokeAlpha);

    float paperBleedAmt = 60.0 + (rand(paperUV.yy) * 30.0) + (rand(paperUV.xx) * 30.0);
    float alpha = strokeAlpha * brushAlpha * dtoa(sdGeometry, paperBleedAmt);
    return clamp(alpha, 0.0, 1.0);
}

// arc/line mode
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

float arcStrokeAlpha(vec2 suv, vec2 paperUV) {
    float lineLength = uRadius * PI2;
    float along = suv.x;
    float perp  = suv.y;

    vec2 uvLine = vec2(perp, along);
    float sweep = clamp(uSweepAmt, 0.0, 1.0);
    float strokeLen = lineLength * sweep;

    float tAlong = clamp(along / max(strokeLen, 1e-6), 0.0, 1.0);
    float halfRange = max(uWidthRange, 1e-3) * 0.5;
    float widthCurve = smoothstep(uWidthOffset - halfRange, uWidthOffset + halfRange, tAlong);
    float lineWidth1 = uLineWidth * mix(1.0, clamp(uWidthEnd, 0.0, 1.0), widthCurve);

    vec3 hu = deformLine(uvLine, lineLength);
    vec2 huUV = hu.xy;
    float centerOff = hu.z;

    float bodyHalfW = lineWidth1 * 0.5;
    float anchorS = clamp(uWidthAnchor, 0.0, 1.0) * 2.0 - 1.0;
    float bodyCenter = centerOff + anchorS * 0.5 * (uLineWidth - lineWidth1);
    float d_body = abs(perp - bodyCenter) - bodyHalfW;

    // per-strand tip jitter
    float strandsHead = max(uStrands, 0.05) * 0.15;
    float baseFreq = 25.0 * strandsHead;
    float jPerp = huUV.x;
    float j1 = noise01(vec2(jPerp * baseFreq,       0.0));
    float j2 = noise01(vec2(jPerp * baseFreq * 2.3, 11.3));
    float j3 = noise01(vec2(jPerp * baseFreq * 4.7, 27.7));
    float jitter = j1 * 0.65 + j2 * 0.22 + j3 * 0.13;
    float tipPush = pow(jitter, 1.1) * uLineWidth * 2.2;
    d_body = max(d_body, -(along - tipPush));

    return brushStrokeAlpha(huUV, paperUV,
                            vec2(lineWidth1, max(strokeLen, 1e-6)),
                            d_body, uBrushColor.a);
}

// general polyline mode (need more computation)
vec3 sampleCurve(int i) {
    float u = (float(i) + 0.5) / curveTexWidth;
    return texture2D(curveTex, vec2(u, 0.5)).xyz;
}
vec3 segProject(vec2 p, vec2 a, vec2 b, bool extendEnd) {
    vec2 d = b - a;
    float L = max(length(d), 1e-6);
    vec2 n = d / L;
    vec2 ap = p - a;
    float tHi = extendEnd ? 1e6 : L;
    float t = clamp(dot(ap, n), 0.0, tHi);
    vec2 q = a + n * t;
    vec2 perp = p - q;
    float side = sign(perp.x * n.y - perp.y * n.x);
    if (side == 0.0) side = 1.0;
    return vec3(length(perp) * side, t / L, L);
}
// Test one segment by index; mutates running best-distance trackers.
// Inlined via macro because GLSL ES 1.00 lacks `out` mutation guarantees
// across drivers when called repeatedly in hot loops.
#define TEST_SEGMENT(IDX)                                                     \
{                                                                             \
    int segIdx = startIdx + IDX;                                              \
    vec3 a3 = sampleCurve(segIdx);                                            \
    vec3 b3 = sampleCurve(segIdx + 1);                                        \
    bool isLast = (segIdx == curveLen - 2);                                   \
    vec3 r  = segProject(p, a3.xy, b3.xy, isLast);                            \
    float ad = abs(r.x);                                                      \
    if (ad < bestAbs) {                                                       \
        bestAbs = ad;                                                         \
        bestSigned = r.x;                                                     \
        bestArc = a3.z + r.y * r.z;                                           \
    }                                                                         \
}

// Spatial-grid SDF for the polyline. Per-pixel cost = O(K) where K = max
// segments per cell, not O(N) over the whole curve.
vec3 sdPolylineGrid(vec2 p) {
    if (curveLen < 2) return vec3(1e9, 0.0, 0.0);
    int startIdx = 0;

    vec2 rel = (p - gridOrigin) / gridCellSize;
    float gxF = clamp(floor(rel.x), 0.0, gridSize.x - 1.0);
    float gyF = clamp(floor(rel.y), 0.0, gridSize.y - 1.0);

    float bestAbs = 1e9, bestSigned = 1e9, bestArc = 0.0;
    float texW = gridSize.x * 2.0;
    float texH = gridSize.y;

    // 2 RGBA pixels per cell = 8 segment IDs. -1 = empty slot.
    for (int pair = 0; pair < 2; pair++) {
        float u = (gxF * 2.0 + float(pair) + 0.5) / texW;
        float v = (gyF + 0.5) / texH;
        vec4 ids = texture2D(gridTex, vec2(u, v));

        if (ids.x >= -0.5) { TEST_SEGMENT(int(ids.x)) }
        if (ids.y >= -0.5) { TEST_SEGMENT(int(ids.y)) }
        if (ids.z >= -0.5) { TEST_SEGMENT(int(ids.z)) }
        if (ids.w >= -0.5) { TEST_SEGMENT(int(ids.w)) }
    }
    return vec3(bestSigned, bestArc, 0.0);
}

float polylineStrokeAlpha(vec2 p) {
    if (curveLen < 2) return 0.0;
    vec3 pr = sdPolylineGrid(p);
    float sd = pr.x;
    float arc = pr.y;

    float visibleLen = max(curveTotalLen, 1e-6);
    // head (tip) is at arc = visibleLen; relArc 0 at tip → 1 at tail
    float relArc = visibleLen - arc;

    float tAlong = clamp(relArc / visibleLen, 0.0, 1.0);
    float halfRange = max(uWidthRange, 1e-3) * 0.5;
    float widthCurve = smoothstep(uWidthOffset - halfRange, uWidthOffset + halfRange, tAlong);
    float w = uLineWidth * mix(1.0, clamp(uWidthEnd, 0.0, 1.0), widthCurve);

    float wobble = (noise01(vec2(arc * 8.0, 0.0)) - 0.5) * uLineWidth * 0.25 * uWobble;
    float halfW = max(0.0, w * 0.5 + wobble);
    float d = abs(sd) - halfW;

    // per-strand tip jitter (matches arc mode bristle carving)
    float strandsHead = max(uStrands, 0.05) * 0.15;
    float baseFreq = 25.0 * strandsHead;
    float j1 = noise01(vec2(sd * baseFreq,       0.0));
    float j2 = noise01(vec2(sd * baseFreq * 2.3, 11.3));
    float j3 = noise01(vec2(sd * baseFreq * 4.7, 27.7));
    float jitter = j1 * 0.65 + j2 * 0.22 + j3 * 0.13;
    float tipPush = pow(jitter, 1.1) * uLineWidth * 2.2;
    d = max(d, -(relArc - tipPush));

    vec2 uvLine = vec2(sd, relArc);
    return brushStrokeAlpha(uvLine, p, vec2(w, visibleLen), d, uBrushColor.a);
}

void main() {
    float aspect = iResolution.x / iResolution.y;
    vec2 uv = vec2((vUV.x * 2.0 - 1.0) * aspect, vUV.y * 2.0 - 1.0);

    float inkA = 0.0;

    if (uMode == MODE_POLAR) {
        float r = length(uv);
        float a = atan(uv.x, uv.y) - uAngleStart;
        if (uClockwise < 0.5) a = -a;
        float phase = mod(a, PI2);
        vec2 suv = vec2(phase * r, r - uRadius);
        inkA = arcStrokeAlpha(suv, uv);
    } else if (uMode == MODE_CARTESIAN) {
        float along = uv.x;
        if (uClockwise > 0.5) along = -along;
        vec2 suv = vec2(along - uAngleStart * uRadius, uv.y - uRadius);
        inkA = arcStrokeAlpha(suv, uv);
    } else if (uMode == MODE_POLYLINE) {
        inkA = polylineStrokeAlpha(uv);
    }

    inkA = clamp(inkA * uOpacity, 0.0, 1.0);

    // 'over' composite: ink over background
    float outA = inkA + uBgColor.a * (1.0 - inkA);
    vec3 outRGB = (inkA * uBrushColor.rgb + uBgColor.rgb * uBgColor.a * (1.0 - inkA)) / max(outA, 1e-6);

    // paper grain (only on opaque backgrounds — keeps overlay use cases clean)
    outRGB += (rand(uv) - 0.5) * 0.08 * uBgColor.a;
    outRGB = clamp(outRGB, vec3(0.0), vec3(1.0));

    gl_FragColor = vec4(outRGB, outA);
}
