precision highp float;

uniform vec2  iResolution;
uniform float uRadius;
uniform float uAngleStart;
uniform float uSweepAmt;       // 0..1, portion of circle covered by stroke
uniform float uLineWidth;
uniform float uClockwise;      // 0.0 = ccw, 1.0 = cw
uniform float uTaper;          // taper exponent (1.5 = mild, 16 = sharp)
uniform float uWobble;         // 0..1 multiplier on humanize displacements
uniform float uStrands;        // density of dry-brush strands across the width (1.0 = default)
uniform float uInkFlow;        // wet/dry: >1 floods gaps with ink, <1 dries out (1.0 = default)
uniform float uWidthEnd;       // tail width as fraction of tip width (1.0 = uniform, 0.0 = pinch to nothing)
uniform float uWidthOffset;    // width step centre along the stroke (0 = tip .. 1 = tail)
uniform float uWidthRange;     // width step transition width (small = hard step, large = gradual)
uniform float uWidthAnchor;    // stroke edge anchor vs base radius: 0=inside, 0.5=center, 1=outside
uniform float uCartesian;      // 0.0 = polar (arc), 1.0 = cartesian (straight line)
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

    // Dry-brush strands: high frequency ACROSS the width (uvLine.x), ~constant
    // ALONG (y freq 1), so each band reads as a streak running down the stroke.
    // uStrands scales that across-width frequency → more/finer (or fewer/coarser)
    // strands. Clamped low so it can't collapse to a single flat band.
    float strands = max(uStrands, 0.05);
    float strokeBoundary = dtoa(sdGeometry, 300.0);
    float strokeTexture = 0.0
        + noise01(uvLine * vec2(min(iResolution.y, iResolution.x) * 0.2 * strands, 1.0))
        + noise01(uvLine * vec2(79.0 * strands, 1.0))
        + noise01(uvLine * vec2(14.0 * strands, 1.0));
    strokeTexture *= 0.333 * strokeBoundary;
    strokeTexture = max(0.008, strokeTexture);

    // uInkFlow sets wet/dry. The dry-brush texture is in [~0,1]; raising it to a
    // smaller exponent lifts it toward solid ink (gaps flood in, wetter/darker),
    // a larger exponent pushes it toward 0 (more white kasure, drier). Dividing
    // the existing taper exponent by uInkFlow does exactly that; 1.0 = unchanged.
    float strokeAlpha = pow(strokeTexture, (max(0.0, posInLineY) + 0.09) / max(uInkFlow, 0.05));
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

// Per-pixel humanization of the straight stroke. Returns the displaced uvLine in
// .xy and the centerline PERPENDICULAR wobble (centered on 0) in .z.
// The centerline wobble must depend ONLY on uvLine.y (along-stroke position).
// If it depended on uvLine.x (perp), every body pixel at the same along would see
// a different centerline — smearing the body into a fuzzy band and detaching the
// cap (single centerOff) from it as wobble grows.
vec3 humanizeBrushStroke(vec2 uvLine, float lineLength) {
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

// Draws the stroke along the +x axis. The incoming uv is already in stroke space:
//   uv.x = distance ALONG the stroke (0 at the start cap, growing toward the tail),
//   uv.y = signed PERPENDICULAR distance from the centerline (0 = on the line).
// All the width / taper / anchor / wobble / cap logic operates normally here. The
// stroke is always straight; main() decides whether screen space maps into here as
// a translation (cartesian) or a wrap around the origin (polar). radius_ only sets
// the nominal length (= its circumference once wrapped); placement is main()'s job.
// capAlong is the along-coordinate to use for the round start cap. It matches
// uv.x for the body, EXCEPT it must be signed around 0 so the whole disc draws.
// In polar, uv.x = phase*r with phase in [0,2π) never goes negative, so the back
// half of the cap would wrap to the far end and vanish; main() passes a signed
// version (the far end wrapped back to small-negative) to keep the cap whole.
vec3 drawStroke(vec2 uv, float capAlong, vec3 inpColor, vec4 brushColor,
                float radius_, float sweepAmt, float lineWidth) {
    float lineLength = radius_ * PI2;
    float along = uv.x;
    float perp  = uv.y;

    vec2 uvLine = vec2(perp, along);

    float sweep = clamp(sweepAmt, 0.0, 1.0);
    float strokeLen = lineLength * sweep;

    // width distribution along the stroke: full width (1.0) at the tip (along=0),
    // uWidthEnd at the tail, blended by a smoothstep "step":
    //   uWidthOffset moves where the width drops (low = drops early/concave,
    //     high = stays wide then drops late/convex),
    //   uWidthRange sets how soft the drop is (small = abrupt step, large = gradual).
    float tAlong = clamp(along / max(strokeLen, 1e-6), 0.0, 1.0);
    float halfRange = max(uWidthRange, 1e-3) * 0.5;
    float widthCurve = smoothstep(uWidthOffset - halfRange, uWidthOffset + halfRange, tAlong);
    float lineWidth1 = lineWidth * mix(1.0, clamp(uWidthEnd, 0.0, 1.0), widthCurve);

    vec3 hu = humanizeBrushStroke(uvLine, lineLength);
    vec2 huUV = hu.xy;
    float centerOff = hu.z;

    // Body geometry: slab around the centerline. Unswept length is killed by taper
    // alpha (posInLineY > 1 drives strokeAlpha to 0), so no hard far clip.
    // uWidthAnchor (0..1) pins one EDGE of the stroke. 0 = inside edge anchored,
    // 1 = outside edge anchored, 0.5 = centered. Remapped to signed [-1,1]. The
    // anchored edge stays put; the opposite edge tapers in as width shrinks.
    float bodyHalfW = lineWidth1 * 0.5;
    float anchorS = clamp(uWidthAnchor, 0.0, 1.0) * 2.0 - 1.0;
    float bodyCenter = centerOff + anchorS * 0.5 * (lineWidth - lineWidth1);
    float d_body = abs(perp - bodyCenter) - bodyHalfW;
    // Clip the back half-plane at along=0 so the body doesn't extend behind the
    // start; the round cap below softens that edge.
    d_body = max(d_body, -along);

    // lineSize.y = strokeLen so posInLineY reaches 1.0 (full taper fade-out)
    // exactly at the swept length — eliminates the hard cut at the tail.
    vec3 ret = colorBrushStroke(huUV, uv, vec2(lineWidth1, max(strokeLen, 1e-6)),
                                d_body, inpColor, brushColor);

    // Solid round cap at the stroke START (where brush touches paper).
    // The faded END needs no cap — taper handles its falloff naturally.
    // Sits at along=0 on the centerline, measured in stroke space — which is
    // locally isometric at along=0 in both mappings, so the cap stays round.
    float capCenter = humanizeBrushStroke(vec2(0.0, 0.0), lineLength).z;
    vec2 startPos = vec2(0.0, capCenter);
    float dStart = distance(vec2(capAlong, perp), startPos) - lineWidth * 0.5;
    vec2 capUV = vec2(huUV.x, 0.0);
    vec3 startCol = colorBrushStroke(capUV, uv, vec2(lineWidth, lineLength),
                                     dStart, inpColor, brushColor);
    return min(ret, startCol);
}

void main() {
    float aspect = iResolution.x / iResolution.y;
    vec2 uv = vec2((vUV.x * 2.0 - 1.0) * aspect, vUV.y * 2.0 - 1.0);

    // Map screen space into the stroke's straight (along x, perp y) frame — the
    // ONLY place polar vs cartesian differ. drawStroke always draws along +x with
    // along=0 at the start cap and the centerline at perp=0. In BOTH modes:
    //   uAngleStart translates the stroke along x (start position / sweep phase),
    //   uRadius     translates the stroke along y (perp offset / ring radius),
    //   uClockwise  flips the along direction.
    // Applying the clockwise flip BEFORE the polar wrap keeps along=0 pinned to the
    // true start (where the wrap is locally isometric), so the cap stays attached.
    vec2 suv;
    float capAlong;                                 // signed along for the start cap
    if (uCartesian > 0.5) {
        float along = uv.x;
        if (uClockwise > 0.5) along = -along;
        // x-translation scaled by uRadius so it matches the polar arc-length shift
        // (in polar the start moves angleStart*r along the arc).
        suv = vec2(along - uAngleStart * uRadius, uv.y - uRadius);
        capAlong = suv.x;                           // already signed around 0
    } else {
        float r = length(uv);
        float a = atan(uv.x, uv.y) - uAngleStart;   // angle relative to the start
        if (uClockwise < 0.5) a = -a;               // CCW is the default
        float phase = mod(a, PI2);                  // 0 at start, grows along sweep
        suv = vec2(phase * r, r - uRadius);
        // wrap the far end (phase near 2π) back to small-negative so the back half
        // of the cap, which lives just behind the start, draws as part of the disc.
        capAlong = (phase > PI ? phase - PI2 : phase) * r;
    }

    vec3 col = uBgColor.rgb;
    col = drawStroke(suv, capAlong, col, uBrushColor, uRadius, uSweepAmt, uLineWidth);
    col.rgb += (rand(uv)-.5)*.08;
    col.rgb = clamp(col.rgb, vec3(0), vec3(1));
    gl_FragColor = vec4(col, 1.0);
}
