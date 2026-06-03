precision highp float;

uniform vec2  iResolution;
uniform sampler2D curveTex;
uniform int   curveLen;
uniform float curveTotalLen;
uniform float curveTexWidth;
uniform float uOffset;
uniform float uArcLength;
uniform float uWidth;
uniform float uTaper;
uniform float uInkFlow;       // unused (API compat)
uniform float uOpacity;
uniform vec4  uBrushColor;
uniform vec4  uBgColor;

varying vec2 vUV;

vec3 sampleCurve(int i) {
    float u = (float(i) + 0.5) / curveTexWidth;
    return texture2D(curveTex, vec2(u, 0.5)).xyz;
}

// project p onto segment ab; returns (unsignedDist, t in [0,1], segLen)
vec3 segProject(vec2 p, vec2 a, vec2 b) {
    vec2 d = b - a;
    float L = max(length(d), 1e-6);
    vec2 n = d / L;
    float t = clamp(dot(p - a, n), 0.0, L);
    vec2 q = a + n * t;
    return vec3(length(p - q), t / L, L);
}

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
    float bestArc = 0.0;
    int flo = max(0, coarseI - STRIDE);
    int fhi = min(curveLen - 1, coarseI + STRIDE);
    for (int i = 0; i < 16; i++) {
        int idx = flo + i;
        if (idx >= fhi) break;
        vec3 a3 = sampleCurve(idx);
        vec3 b3 = sampleCurve(idx + 1);
        vec3 r  = segProject(p, a3.xy, b3.xy);
        if (r.x < bestAbs) {
            bestAbs = r.x;
            bestArc = a3.z + r.y * r.z;
        }
    }
    return vec3(bestAbs, bestArc, 0.0);
}

vec2 curvePointAtArc(float s) {
    // Binary search — arc lengths are monotonically increasing
    int lo = 0;
    int hi = curveLen - 2;
    for (int i = 0; i < 9; i++) {
        if (lo >= hi) break;
        int mid = (lo + hi) / 2;
        if (sampleCurve(mid + 1).z < s) lo = mid + 1;
        else hi = mid;
    }
    vec3 a = sampleCurve(lo);
    vec3 b = sampleCurve(lo + 1);
    return mix(a.xy, b.xy, (s - a.z) / max(b.z - a.z, 1e-6));
}

void main() {
    float aspect = iResolution.x / iResolution.y;
    vec2 p = vec2((vUV.x * 2.0 - 1.0) * aspect, vUV.y * 2.0 - 1.0);

    if (curveLen < 2) {
        gl_FragColor = uBgColor;
        return;
    }

    vec3 pr = sdPolyline(p);
    float sd = pr.x;
    float arc = pr.y;

    float startArc = uOffset * curveTotalLen;
    float endArc   = startArc + uArcLength * curveTotalLen;
    float visibleLen = max(endArc - startArc, 1e-6);

    // round cap at tip (head end)
    if (arc > endArc) {
        vec2 ep = curvePointAtArc(endArc);
        sd = distance(p, ep);
        arc = endArc;
    }

    // t01: 0 at tip (full width), 1 at tail (zero width)
    float t01 = clamp((endArc - arc) / visibleLen, 0.0, 1.0);
    float taper = max(uTaper, 0.0001);
    // wide along most of stroke, sharp pointy collapse near tail when taper>1
    float w = uWidth * (1.0 - pow(t01, taper));
    float d = sd - w * 0.5;

    // antialiased edge
    float aa = 2.0 / iResolution.y;
    float strokeA = smoothstep(aa, -aa, d);
    strokeA *= uOpacity * uBrushColor.a;

    // 'over' composite with background
    float outA = strokeA + uBgColor.a * (1.0 - strokeA);
    vec3 outRGB = (strokeA * uBrushColor.rgb + uBgColor.rgb * uBgColor.a * (1.0 - strokeA)) / max(outA, 1e-6);
    gl_FragColor = vec4(outRGB, outA);
}
