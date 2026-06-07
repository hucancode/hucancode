precision highp float;

uniform vec2  iResolution;
uniform vec2  uHeadPos;        // world-space tip position
uniform vec2  uHeadDir;        // normalized chain direction at tip
uniform float uHeadSize;       // world units per local-space unit
uniform float uShowHead;       // 0 = hidden, 1 = visible
uniform vec4  uBrushColor;

varying vec2 vUV;

float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}
float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    return sdSegment(p, a, b) - r;
}
float sdEllipse(vec2 p, vec2 r) {
    return (length(p / r) - 1.0) * min(r.x, r.y);
}
float smin2(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Top-down chinese dragon head silhouette.
// Local frame: nose tip near (0,0), dragon body extends in -x direction.
float sdDragonHead(vec2 p) {
    vec2 pm = vec2(p.x, abs(p.y));
    float snout = sdCapsule(p, vec2(0.05, 0.0), vec2(-0.55, 0.0), 0.08);
    float dome  = sdEllipse(p - vec2(-0.82, 0.0), vec2(0.34, 0.32));
    float cheek = sdCapsule(pm, vec2(-0.55, 0.0), vec2(-0.78, 0.26), 0.07);
    float head  = smin2(snout, dome, 0.12);
    head = smin2(head, cheek, 0.06);

    float jaw = sdEllipse(p - vec2(-0.30, 0.0), vec2(0.22, 0.13));
    head = smin2(head, jaw, 0.08);

    float horn    = sdCapsule(pm, vec2(-0.85, 0.18), vec2(-1.30, 0.46), 0.040);
    float hornTip = sdCapsule(pm, vec2(-1.30, 0.46), vec2(-1.48, 0.62), 0.022);
    float horns   = min(horn, hornTip);

    float mane1 = sdCapsule(pm, vec2(-1.05, 0.10), vec2(-1.40, 0.18), 0.028);
    float mane2 = sdCapsule(p,  vec2(-1.10, 0.00), vec2(-1.50, 0.00), 0.030);
    float mane  = min(mane1, mane2);

    float d = head;
    d = min(d, horns);
    d = min(d, mane);
    return d;
}

void main() {
    if (uShowHead < 0.5 || uHeadSize < 1e-4) discard;

    vec2 hd = uHeadDir;
    float hl = length(hd);
    if (hl < 1e-5) discard;
    hd /= hl;

    float aspect = iResolution.x / iResolution.y;
    vec2 p = vec2((vUV.x * 2.0 - 1.0) * aspect, vUV.y * 2.0 - 1.0);

    vec2 perp = vec2(-hd.y, hd.x);
    vec2 rel = p - uHeadPos;
    vec2 pLocal = vec2(dot(rel, hd), dot(rel, perp)) / uHeadSize;

    const float EYE_OFFSET = 0.55;
    float headSD = sdDragonHead(pLocal - vec2(EYE_OFFSET, 0.0)) * uHeadSize;
    float aa = 2.0 / iResolution.y;
    float alpha = (1.0 - smoothstep(-aa, aa, headSD)) * uBrushColor.a;

    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(uBrushColor.rgb, alpha);
}
