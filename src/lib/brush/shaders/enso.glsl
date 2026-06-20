const float PI  = 3.14159265;
const float PI2 = 6.28318531;
const bool  CLOCKWISE = true;
// false -> straight line instead of circle (cartesian, easier to debug)
const bool  POLAR = true;

float uRadius       = 0.55;
float uAngleStart   = 0.0;
float uLineWidth    = 0.28;
float uWobble       = 0.5;
float uStrands      = 1.5;
float uWidthEnd     = 0.15;
float uWidthOffset  = 0.55;
float uWidthRange   = 1.5;
float uWidthAnchor  = 1.0;
vec4  uBrushColor   = vec4(0.05, 0.05, 0.07, 1.0);
vec4  uBgColor      = vec4(0.96, 0.93, 0.86, 1.0);
float uInkFlow      = 1.0;
float uWaterFlow    = 0.7;

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


vec3 colorBrushStroke(vec2 uvLine, vec2 paperUV, vec2 lineSize,
                      float sdGeometry, vec3 inpColor, vec4 brushColor) {
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
    float lo = mix(0.28, 0.02, water);
    float hi = mix(0.78, 0.38, water);
    float strokeTexture = smoothstep(lo, hi, pow(texClamped, 0.52));

    float strokeAlpha = pow(strokeTexture, (max(0.0, posInLineY) + 0.09) / inkFlow);
    const float strokeAlphaBoost = 1.09;
    strokeAlpha = strokeAlphaBoost * max(0.0, strokeAlpha - pow(max(0.0, posInLineY), 0.5));
    strokeAlpha = smoothf(strokeAlpha);

    float paperBleedAmt = 60.0 + (rand(paperUV.yy) * 30.0) + (rand(paperUV.xx) * 30.0);
    float alpha = strokeAlpha * brushColor.a * dtoa(sdGeometry, paperBleedAmt);
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
                float radius_, float sweepAmt, float lineWidth) {
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

    float strandsHead = max(uStrands, 0.05) * 0.15;
    float baseFreq = 25.0 * strandsHead;
    float jPerp = huUV.x;
    float j1 = noise01(vec2(jPerp * baseFreq,       0.0));
    float j2 = noise01(vec2(jPerp * baseFreq * 2.3, 11.3));
    float j3 = noise01(vec2(jPerp * baseFreq * 4.7, 27.7));
    float jitter = j1 * 0.65 + j2 * 0.22 + j3 * 0.13;
    float tipPush = pow(jitter, 1.1) * lineWidth * 2.2;
    d_body = max(d_body, -(along - tipPush));

    return colorBrushStroke(huUV, paperUV, vec2(lineWidth1, max(strokeLen, 1e-6)),
                            d_body, inpColor, brushColor);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 vUV = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;
    vec2 uv = vec2((vUV.x * 2.0 - 1.0) * aspect, vUV.y * 2.0 - 1.0);
    float uSweepAmt = 0.65 + 0.35 * sin(iTime * 0.6);

    float mx = clamp(iMouse.x / iResolution.x, 0.0, 1.0);
    uInkFlow      = mix(2.0, 0.5, mx);
    //uWaterFlow    = mix(0.1, 1.0, mx);
    //uLineWidth    = mix(0.1, 1.0, mx);
    //uWobble       = mix(0.0, 1.0, mx);
    //uStrands      = mix(0.1, 3.0, mx);
    //uWidthAnchor  = mix(0.0, 1.0, mx);
    //uWidthEnd     = mix(0.0, 1.0, mx);

    vec2 suv;
    if (POLAR) {
        float r = length(uv);
        float a = atan(uv.x, uv.y) - uAngleStart;
        if (CLOCKWISE) a = -a;
        float phase = mod(a, PI2);
        suv = vec2(phase * r, r - uRadius);
    } else {
        suv = vec2(uv.x + aspect - uAngleStart * uRadius, uv.y - uRadius);
    }

    vec3 col = uBgColor.rgb;
    col = drawStroke(suv, uv, col, uBrushColor, uRadius, uSweepAmt, uLineWidth);

    col.rgb += (rand(uv)-.5)*.05;
    col.rgb = clamp(col.rgb, vec3(0), vec3(1));
    fragColor = vec4(col, 1.0);
}