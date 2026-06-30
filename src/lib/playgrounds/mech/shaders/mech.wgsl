// SDF raymarcher. The scene is NOT meshes — it's the array of nodes packed into
// nodeTex (6 texels/node). Each node folds into the field by its CSG op:
//   union -> smin, subtract -> smax(d,-pd), intersect -> smax(d,pd). round bevels
//   edges, stage gates the 1->2->3 reveal. One implicit ground plane grounds it.

struct Uni {
  uCamPos: vec3<f32>,
  uCamRight: vec3<f32>,
  uCamUp: vec3<f32>,
  uCamFwd: vec3<f32>,
  uLightDir: vec3<f32>,
  uKeyColor: vec3<f32>,
  uFillColor: vec3<f32>,
  uBgTop: vec3<f32>,
  uBgBot: vec3<f32>,
  uFloorY: f32,
  uCount: f32,
  uStage: f32,
  uSelected: f32,
  uTime: f32,
  uShadow: f32,
  uGround: f32,
};
@group(0) @binding(0) var<uniform> u: Uni;
@group(0) @binding(1) var nodeTex: texture_2d<f32>;

const MAXN: i32 = 256;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vUv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> VsOut {
  var P = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  var o: VsOut;
  let p = P[vid];
  o.vUv = p;
  o.pos = vec4(p, 0.0, 1.0);
  return o;
}

fn texelF(i: i32, c: i32) -> vec4<f32> { return textureLoad(nodeTex, vec2<i32>(c, i), 0); }

fn smin(a: f32, b: f32, k: f32) -> f32 {
  if (k <= 0.0) { return min(a, b); }
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
fn smax(a: f32, b: f32, k: f32) -> f32 { return -smin(-a, -b, k); }

fn prim(q: vec3<f32>, ty: i32, P: vec4<f32>, r: f32) -> f32 {
  if (ty == 0) { return length(q) - P.x; }
  if (ty == 1) {
    let b = P.xyz - vec3<f32>(r);
    let d = abs(q) - b;
    return length(max(d, vec3<f32>(0.0))) + min(max(d.x, max(d.y, d.z)), 0.0) - r;
  }
  if (ty == 2) {
    let d = vec2<f32>(length(q.xz) - (P.x - r), abs(q.y) - (P.y - r));
    return min(max(d.x, d.y), 0.0) + length(max(d, vec2<f32>(0.0))) - r;
  }
  if (ty == 3) {
    let yy = q.y - clamp(q.y, -P.y, P.y);
    return length(vec3<f32>(q.x, yy, q.z)) - P.x;
  }
  if (ty == 4) {
    let q2 = vec2<f32>(length(q.xz), q.y);
    let h = P.y; let r1 = P.x; let r2 = P.z;
    let k1 = vec2<f32>(r2, h);
    let k2 = vec2<f32>(r2 - r1, 2.0 * h);
    let ca = vec2<f32>(q2.x - min(q2.x, select(r2, r1, q2.y < 0.0)), abs(q2.y) - h);
    let cb = q2 - k1 + k2 * clamp(dot(k1 - q2, k2) / dot(k2, k2), 0.0, 1.0);
    let s = select(1.0, -1.0, cb.x < 0.0 && ca.y < 0.0);
    return s * sqrt(min(dot(ca, ca), dot(cb, cb))) - r;
  }
  if (ty == 5) {
    let t2 = vec2<f32>(length(q.xz) - P.x, q.y);
    return length(t2) - P.y - r;
  }
  // truncated square pyramid: base half P.x (bottom -Y), TOP half P.z (top +Y),
  // half-height P.y. P.z = 0 -> a pointed apex (a plain pyramid). square-section
  // capped-cone math (Chebyshev radius), so the same param does taper + cut-off.
  let qx = max(abs(q.x), abs(q.z));
  let q2 = vec2<f32>(qx, q.y);
  let h = P.y; let r1 = P.x; let r2 = P.z;
  let k1 = vec2<f32>(r2, h);
  let k2 = vec2<f32>(r2 - r1, 2.0 * h);
  let ca = vec2<f32>(q2.x - min(q2.x, select(r2, r1, q2.y < 0.0)), abs(q2.y) - h);
  let cb = q2 - k1 + k2 * clamp(dot(k1 - q2, k2) / dot(k2, k2), 0.0, 1.0);
  let sgn = select(1.0, -1.0, cb.x < 0.0 && ca.y < 0.0);
  return sgn * sqrt(min(dot(ca, ca), dot(cb, cb))) - r;
}

// local point for node i given world p
fn localP(i: i32, p: vec3<f32>) -> vec3<f32> {
  let c0 = texelF(i, 0); let c1 = texelF(i, 1); let c2 = texelF(i, 2); let t3 = texelF(i, 3);
  let dl = p - t3.xyz;
  return vec3<f32>(dot(c0.xyz, dl), dot(c1.xyz, dl), dot(c2.xyz, dl));
}

// distance-only field (used for marching, normals, shadows, AO)
fn mapD(p: vec3<f32>) -> f32 {
  var d = select(1e9, p.y - u.uFloorY, u.uGround > 0.5);
  let n = i32(u.uCount);
  for (var i = 0; i < MAXN; i = i + 1) {
    if (i >= n) { break; }
    if (texelF(i, 5).w > u.uStage + 0.5) { continue; }
    let c0 = texelF(i, 0); let c1 = texelF(i, 1); let c2 = texelF(i, 2);
    let pd = prim(localP(i, p), i32(c0.w), texelF(i, 4), c2.w);
    let op = i32(c1.w); let k = texelF(i, 3).w;
    if (op == 0) { d = smin(d, pd, k); }
    else if (op == 1) { d = smax(d, -pd, k); }
    else { d = smax(d, pd, k); }
  }
  return d;
}

struct Hit { d: f32, col: vec3<f32>, emi: f32, floor: f32 };

// field + nearest-surface albedo (subtract/intersect keep the base color)
fn mapC(p: vec3<f32>) -> Hit {
  var h: Hit;
  h.d = select(1e9, p.y - u.uFloorY, u.uGround > 0.5);
  var cd = h.d;                      // floor as the initial color candidate (off -> never picked)
  h.col = vec3<f32>(0.05, 0.06, 0.08);
  h.emi = 0.0;
  h.floor = 1.0;                     // until a solid node out-ranks the floor plane
  let sel = i32(u.uSelected);
  let n = i32(u.uCount);
  for (var i = 0; i < MAXN; i = i + 1) {
    if (i >= n) { break; }
    if (texelF(i, 5).w > u.uStage + 0.5) { continue; }
    let c0 = texelF(i, 0); let c1 = texelF(i, 1); let c2 = texelF(i, 2);
    let pd = prim(localP(i, p), i32(c0.w), texelF(i, 4), c2.w);
    let op = i32(c1.w); let k = texelF(i, 3).w;
    if (op == 0) {
      h.d = smin(h.d, pd, k);
      if (pd < cd) { cd = pd; h.col = texelF(i, 5).xyz; h.emi = select(0.0, 1.0, i == sel); h.floor = 0.0; }
    } else if (op == 1) {
      h.d = smax(h.d, -pd, k);
    } else {
      h.d = smax(h.d, pd, k);
    }
  }
  return h;
}

fn calcNormal(p: vec3<f32>) -> vec3<f32> {
  let e = vec2<f32>(1.0, -1.0) * 0.0012;
  return normalize(
    e.xyy * mapD(p + e.xyy) +
    e.yyx * mapD(p + e.yyx) +
    e.yxy * mapD(p + e.yxy) +
    e.xxx * mapD(p + e.xxx));
}

fn softShadow(ro: vec3<f32>, rd: vec3<f32>) -> f32 {
  var res = 1.0;
  var t = 0.03;
  for (var i = 0; i < 28; i = i + 1) {
    let hh = mapD(ro + rd * t);
    if (hh < 0.001) { return 0.0; }
    res = min(res, 9.0 * hh / t);
    t = t + clamp(hh, 0.03, 0.3);
    if (t > 14.0) { break; }
  }
  return clamp(res, 0.0, 1.0);
}

fn ao(p: vec3<f32>, nrm: vec3<f32>) -> f32 {
  var s = 0.0; var w = 1.0;
  for (var i = 1; i < 6; i = i + 1) {
    let dd = 0.05 * f32(i);
    s = s + w * (dd - mapD(p + nrm * dd));
    w = w * 0.62;
  }
  return clamp(1.0 - 2.2 * s, 0.0, 1.0);
}

// procedural grid floor: AA minor lines every 1 unit, brighter major lines
// every 5, fading out with distance so it doesn't moire into the haze. replaces
// the flat ground albedo with a blueprint-style map.
fn gridFloor(pxz: vec2<f32>, fade: f32) -> vec3<f32> {
  let base = vec3<f32>(0.04, 0.05, 0.07);
  let g1 = abs(fract(pxz - 0.5) - 0.5) / max(fwidth(pxz), vec2<f32>(1e-4));
  let m1 = 1.0 - clamp(min(g1.x, g1.y), 0.0, 1.0);
  let p5 = pxz / 5.0;
  let g5 = abs(fract(p5 - 0.5) - 0.5) / max(fwidth(p5), vec2<f32>(1e-4));
  let m5 = 1.0 - clamp(min(g5.x, g5.y), 0.0, 1.0);
  var c = base;
  c = mix(c, vec3<f32>(0.11, 0.14, 0.19), m1 * 0.7 * fade);
  c = mix(c, vec3<f32>(0.24, 0.31, 0.42), m5 * fade);
  return c;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let rd = normalize(u.uCamFwd + in.vUv.x * u.uCamRight + in.vUv.y * u.uCamUp);
  let ro = u.uCamPos;

  var t = 0.0;
  var hit = false;
  for (var i = 0; i < 120; i = i + 1) {
    let p = ro + rd * t;
    let d = mapD(p);
    if (d < 0.0012 * t + 0.0005) { hit = true; break; }
    t = t + d;
    if (t > 60.0) { break; }
  }

  var outc: vec3<f32>;
  if (hit) {
    let p = ro + rd * t;
    let m = mapC(p);
    var alb = m.col;
    if (m.floor > 0.5) { alb = gridFloor(p.xz, clamp(1.3 - t * 0.03, 0.0, 1.0)); }
    let nrm = calcNormal(p);
    let v = normalize(u.uCamPos - p);
    let L = normalize(u.uLightDir);
    let dif = clamp(dot(nrm, L), 0.0, 1.0);
    var sh = 1.0;
    if (u.uShadow > 0.5) { sh = softShadow(p + nrm * 0.02, L); }
    let occ = ao(p, nrm);
    let hv = normalize(L + v);
    let spe = pow(clamp(dot(nrm, hv), 0.0, 1.0), 42.0);
    let fres = pow(1.0 - clamp(dot(nrm, v), 0.0, 1.0), 4.0);
    let amb = clamp(0.5 + 0.5 * nrm.y, 0.0, 1.0);
    outc = alb * (u.uFillColor * amb * occ + u.uKeyColor * dif * sh);
    outc = outc + u.uKeyColor * spe * sh * 0.7;
    outc = outc + u.uFillColor * fres * 0.35 * occ;
    // emissive parts (glass/visor) + selection pulse
    let glow = 0.35 + m.emi * (0.4 + 0.4 * sin(u.uTime * 6.0));
    outc = outc + alb * m.emi * glow;
    // distance haze toward the background
    let fog = 1.0 - exp(-0.0009 * t * t);
    outc = mix(outc, mix(u.uBgBot, u.uBgTop, 0.5), fog * 0.5);
  } else {
    outc = mix(u.uBgBot, u.uBgTop, clamp(rd.y * 0.7 + 0.4, 0.0, 1.0));
  }

  outc = pow(max(outc, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
  return vec4(outc, 1.0);
}
