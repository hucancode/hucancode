// Ink-splash wash. WGSL port of webgl/shaders/splash.frag.glsl. Procedural
// simplex fbm blob + magicBox speckles, posterised to ink tones.

struct Uni {
  uResolution: vec2<f32>,
  uGrow: f32,
  uSpread: f32,
  uAmount: f32,
  uClock: f32,
  uInkDark: vec3<f32>,  // high coverage
  uInkLight: vec3<f32>, // low coverage
};
@group(0) @binding(0) var<uniform> u: Uni;

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
  var P = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  return vec4(P[vid], 0.0, 1.0);
}

fn hash2(p: vec2<f32>) -> vec2<f32> {
  let q = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(q) * 43758.5453123);
}
fn noise(p: vec2<f32>) -> f32 {
  let K1 = 0.366025404;
  let K2 = 0.211324865;
  let i = floor(p + (p.x + p.y) * K1);
  let a = p - i + (i.x + i.y) * K2;
  var o: vec2<f32>;
  if (a.x > a.y) { o = vec2(1.0, 0.0); } else { o = vec2(0.0, 1.0); }
  let b = a - o + K2;
  let c = a - 1.0 + 2.0 * K2;
  let h = max(vec3(0.5) - vec3(dot(a, a), dot(b, b), dot(c, c)), vec3(0.0));
  let n = h * h * h * h * vec3(dot(a, hash2(i + vec2(0.0))), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));
  return dot(n, vec3(70.0));
}
fn noise01(p: vec2<f32>) -> f32 { return clamp((noise(p) + 0.5) * 0.5, 0.0, 1.0); }
fn fbm(p0: vec2<f32>) -> f32 {
  var a = 0.5;
  var s = 0.0;
  var p = p0;
  for (var i = 0; i < 5; i = i + 1) { s = s + a * noise(p); p = p * 2.13; a = a * 0.5; }
  return s;
}

fn magicBox3(p0: vec3<f32>) -> f32 {
  let MAGIC = 0.55;
  var p = 1.0 - abs(1.0 - (p0 - 2.0 * floor(p0 / 2.0)));
  var lastLength = length(p);
  var tot = 0.0;
  for (var i = 0; i < 13; i = i + 1) {
    p = abs(p) / (lastLength * lastLength) - MAGIC;
    let newLength = length(p);
    tot = tot + abs(newLength - lastLength);
    lastLength = newLength;
  }
  return tot;
}
fn magicBox2(uv: vec2<f32>) -> f32 {
  let M = mat3x3<f32>(
    0.28862355854826727, 0.6997227302779844, 0.6535170557707412,
    0.06997493955670424, 0.6653237235314099, -0.7432683571499161,
    -0.9548821651308448, 0.26025457467376617, 0.14306504491456504);
  let p = 0.5 * (M * vec3(uv, 0.0));
  return magicBox3(p);
}

@fragment
fn fs(@builtin(position) fc: vec4<f32>) -> @location(0) vec4<f32> {
  let res = u.uResolution;
  let grow = u.uGrow;
  let spread = u.uSpread;
  let amount = u.uAmount;
  let clock = u.uClock;
  let inkDark = u.uInkDark;
  let inkLight = u.uInkLight;

  let w = (2.0 * fc.xy - res) / res.y;
  let r = length(w);

  let fb = fbm(w * 3.0 + vec2(0.0, clock * 0.04));
  let field = fb + 0.6 - r / max(spread, 1e-3);
  let level = mix(0.95, -0.25, clamp(grow, 0.0, 1.0));
  let aa = 0.05;
  let shape = smoothstep(level + aa, level - aa, field);

  let grain = noise01(w * 11.0) * 0.6 + noise01(w * 26.0) * 0.4;
  let thr = mix(0.82, 0.12, clamp(amount, 0.0, 1.0));
  let patches = smoothstep(thr, thr + 0.36, fbm(w * 2.3 + vec2(11.0, 7.0)));
  var ink = shape * grain * patches * 1.0;

  let reach = spread * grow;
  var speck = pow(smoothstep(22.0, 40.0, magicBox2((w + 9.0) * 3.0)), 2.0);
  speck = speck * smoothstep(reach * 1.7, reach * 0.85, r);
  ink = max(ink, speck * clamp(amount, 0.0, 1.0) * 4.5);

  ink = clamp(ink, 0.0, 1.0);

  let col = mix(inkLight, inkDark, ink);
  return vec4(col, ink);
}
