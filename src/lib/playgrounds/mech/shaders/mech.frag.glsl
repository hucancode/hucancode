#version 300 es
precision highp float;
precision highp int;

// SDF raymarcher (WebGL2 twin of mech.wgsl). Scene = nodes packed in nodeTex,
// 6 texels/node, folded by CSG op. See mech.wgsl for the layout commentary.

in vec2 vUv;
out vec4 fragColor;

uniform highp sampler2D nodeTex;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform vec3 uLightDir;
uniform vec3 uKeyColor;
uniform vec3 uFillColor;
uniform vec3 uBgTop;
uniform vec3 uBgBot;
uniform float uFloorY;
uniform float uCount;
uniform float uStage;
uniform float uSelected;
uniform float uTime;
uniform float uShadow;
uniform float uGround;

const int MAXN = 256;

vec4 texelF(int i, int c) { return texelFetch(nodeTex, ivec2(c, i), 0); }

float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

float prim(vec3 q, int ty, vec4 P, float r) {
  if (ty == 0) return length(q) - P.x;
  if (ty == 1) {
    vec3 b = P.xyz - vec3(r);
    vec3 d = abs(q) - b;
    return length(max(d, vec3(0.0))) + min(max(d.x, max(d.y, d.z)), 0.0) - r;
  }
  if (ty == 2) {
    vec2 d = vec2(length(q.xz) - (P.x - r), abs(q.y) - (P.y - r));
    return min(max(d.x, d.y), 0.0) + length(max(d, vec2(0.0))) - r;
  }
  if (ty == 3) {
    float yy = q.y - clamp(q.y, -P.y, P.y);
    return length(vec3(q.x, yy, q.z)) - P.x;
  }
  if (ty == 4) {
    vec2 q2 = vec2(length(q.xz), q.y);
    float h = P.y, r1 = P.x, r2 = P.z;
    vec2 k1 = vec2(r2, h);
    vec2 k2 = vec2(r2 - r1, 2.0 * h);
    vec2 ca = vec2(q2.x - min(q2.x, (q2.y < 0.0) ? r1 : r2), abs(q2.y) - h);
    vec2 cb = q2 - k1 + k2 * clamp(dot(k1 - q2, k2) / dot(k2, k2), 0.0, 1.0);
    float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
    return s * sqrt(min(dot(ca, ca), dot(cb, cb))) - r;
  }
  if (ty == 5) {
    vec2 t2 = vec2(length(q.xz) - P.x, q.y);
    return length(t2) - P.y - r;
  }
  if (ty == 7) {
    // female ball socket: a spherical shell bowl kept below P.z (open at +Y). a
    // valid intersection SDF (shell ∩ half-space) — self-contained, so it NEVER
    // carves neighbours or the floor the way a subtract node would.
    //   P.x = mid radius   P.y = wall half-thickness   P.z = open-plane height
    float shell = abs(length(q) - P.x) - P.y;
    float cap = q.y - P.z;
    return max(shell, cap) - r;
  }
  if (ty == 8) {
    // open C-arc with a RECTANGULAR cross-section: a box [P.y,P.z] swept on a
    // circle of radius P.x in the XY plane, kept across ±P.w about +Y (flat
    // end-caps). square-torus ∩ angular wedge — self-contained, hard edges.
    vec3 qq = q; qq.x = abs(qq.x);
    float u = length(qq.xy) - P.x;               // radial offset from the ring centreline
    vec2 d2 = abs(vec2(u, qq.z)) - vec2(P.y, P.z);
    float ring = length(max(d2, vec2(0.0))) + min(max(d2.x, d2.y), 0.0);
    float cap = dot(qq.xy, vec2(cos(P.w), -sin(P.w)));  // radial end-plane at angle P.w
    return max(ring, cap) - r;
  }
  // truncated square pyramid: base half P.x (bottom -Y), TOP half P.z (top +Y),
  // half-height P.y. P.z = 0 -> a pointed apex (a plain pyramid). square-section
  // capped-cone math (Chebyshev radius), so the same param does taper + cut-off.
  float qx = max(abs(q.x), abs(q.z));
  vec2 q2 = vec2(qx, q.y);
  float h = P.y, r1 = P.x, r2 = P.z;
  vec2 k1 = vec2(r2, h);
  vec2 k2 = vec2(r2 - r1, 2.0 * h);
  vec2 ca = vec2(q2.x - min(q2.x, (q2.y < 0.0) ? r1 : r2), abs(q2.y) - h);
  vec2 cb = q2 - k1 + k2 * clamp(dot(k1 - q2, k2) / dot(k2, k2), 0.0, 1.0);
  float sgn = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return sgn * sqrt(min(dot(ca, ca), dot(cb, cb))) - r;
}

vec3 localP(int i, vec3 p) {
  vec3 dl = p - texelF(i, 3).xyz;
  return vec3(dot(texelF(i, 0).xyz, dl), dot(texelF(i, 1).xyz, dl), dot(texelF(i, 2).xyz, dl));
}

float mapD(vec3 p) {
  float d = (uGround > 0.5) ? (p.y - uFloorY) : 1e9;
  int n = int(uCount);
  for (int i = 0; i < MAXN; i++) {
    if (i >= n) break;
    if (texelF(i, 5).w > uStage + 0.5) continue;
    float pd = prim(localP(i, p), int(texelF(i, 0).w), texelF(i, 4), texelF(i, 2).w);
    int op = int(texelF(i, 1).w);
    float k = texelF(i, 3).w;
    if (op == 0) d = smin(d, pd, k);
    else if (op == 1) d = smax(d, -pd, k);
    else d = smax(d, pd, k);
  }
  return d;
}

float mapC(vec3 p, out vec3 col, out float emi, out float isFloor) {
  float d = (uGround > 0.5) ? (p.y - uFloorY) : 1e9;
  float cd = d;
  col = vec3(0.05, 0.06, 0.08);
  emi = 0.0;
  isFloor = 1.0;                   // until a solid node out-ranks the floor plane
  int sel = int(uSelected);
  int n = int(uCount);
  for (int i = 0; i < MAXN; i++) {
    if (i >= n) break;
    if (texelF(i, 5).w > uStage + 0.5) continue;
    float pd = prim(localP(i, p), int(texelF(i, 0).w), texelF(i, 4), texelF(i, 2).w);
    int op = int(texelF(i, 1).w);
    float k = texelF(i, 3).w;
    if (op == 0) {
      d = smin(d, pd, k);
      if (pd < cd) { cd = pd; col = texelF(i, 5).xyz; emi = (i == sel) ? 1.0 : 0.0; isFloor = 0.0; }
    } else if (op == 1) {
      d = smax(d, -pd, k);
    } else {
      d = smax(d, pd, k);
    }
  }
  return d;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.0012;
  return normalize(
    e.xyy * mapD(p + e.xyy) +
    e.yyx * mapD(p + e.yyx) +
    e.yxy * mapD(p + e.yxy) +
    e.xxx * mapD(p + e.xxx));
}

float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.03;
  for (int i = 0; i < 28; i++) {
    float h = mapD(ro + rd * t);
    if (h < 0.001) return 0.0;
    res = min(res, 9.0 * h / t);
    t += clamp(h, 0.03, 0.3);
    if (t > 14.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

float ao(vec3 p, vec3 nrm) {
  float s = 0.0, w = 1.0;
  for (int i = 1; i < 6; i++) {
    float dd = 0.05 * float(i);
    s += w * (dd - mapD(p + nrm * dd));
    w *= 0.62;
  }
  return clamp(1.0 - 2.2 * s, 0.0, 1.0);
}

// procedural grid floor: AA minor lines every 1 unit, brighter major lines every
// 5, fading with distance so it doesn't moire into the haze. replaces the flat
// ground albedo with a blueprint-style map.
vec3 gridFloor(vec2 pxz, float fade) {
  vec3 base = vec3(0.04, 0.05, 0.07);
  vec2 g1 = abs(fract(pxz - 0.5) - 0.5) / max(fwidth(pxz), vec2(1e-4));
  float m1 = 1.0 - clamp(min(g1.x, g1.y), 0.0, 1.0);
  vec2 p5 = pxz / 5.0;
  vec2 g5 = abs(fract(p5 - 0.5) - 0.5) / max(fwidth(p5), vec2(1e-4));
  float m5 = 1.0 - clamp(min(g5.x, g5.y), 0.0, 1.0);
  vec3 c = base;
  c = mix(c, vec3(0.11, 0.14, 0.19), m1 * 0.7 * fade);
  c = mix(c, vec3(0.24, 0.31, 0.42), m5 * fade);
  return c;
}

void main() {
  vec3 rd = normalize(uCamFwd + vUv.x * uCamRight + vUv.y * uCamUp);
  vec3 ro = uCamPos;

  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < 120; i++) {
    float d = mapD(ro + rd * t);
    if (d < 0.0012 * t + 0.0005) { hit = true; break; }
    t += d;
    if (t > 60.0) break;
  }

  vec3 outc;
  if (hit) {
    vec3 p = ro + rd * t;
    vec3 col; float emi; float isFloor;
    mapC(p, col, emi, isFloor);
    vec3 alb = (isFloor > 0.5) ? gridFloor(p.xz, clamp(1.3 - t * 0.03, 0.0, 1.0)) : col;
    vec3 nrm = calcNormal(p);
    vec3 v = normalize(uCamPos - p);
    vec3 L = normalize(uLightDir);
    float dif = clamp(dot(nrm, L), 0.0, 1.0);
    float sh = (uShadow > 0.5) ? softShadow(p + nrm * 0.02, L) : 1.0;
    float occ = ao(p, nrm);
    vec3 hv = normalize(L + v);
    float spe = pow(clamp(dot(nrm, hv), 0.0, 1.0), 42.0);
    float fres = pow(1.0 - clamp(dot(nrm, v), 0.0, 1.0), 4.0);
    float amb = clamp(0.5 + 0.5 * nrm.y, 0.0, 1.0);
    outc = alb * (uFillColor * amb * occ + uKeyColor * dif * sh);
    outc += uKeyColor * spe * sh * 0.7;
    outc += uFillColor * fres * 0.35 * occ;
    float glow = 0.35 + emi * (0.4 + 0.4 * sin(uTime * 6.0));
    outc += alb * emi * glow;
    float fog = 1.0 - exp(-0.0009 * t * t);
    outc = mix(outc, mix(uBgBot, uBgTop, 0.5), fog * 0.5);
  } else {
    outc = mix(uBgBot, uBgTop, clamp(rd.y * 0.7 + 0.4, 0.0, 1.0));
  }

  outc = pow(max(outc, vec3(0.0)), vec3(1.0 / 2.2));
  fragColor = vec4(outc, 1.0);
}
