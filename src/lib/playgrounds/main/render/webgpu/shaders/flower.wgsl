// Bloom flower. WGSL port of webgl/shaders/flower.frag.glsl (+ inline vert).
// INSTANCED: one quad per flower; per-flower placement/bloom/seed/alpha come
// from a storage buffer indexed by instance_index. Premultiplied output.

struct Uni {
  uViewProj: mat4x4<f32>,
  uPetals: f32,
  uLayers: f32,
  uInkColor: vec3<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

const PI: f32 = 3.14159265;
const PI2: f32 = 6.28318531;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vLocal: vec2<f32>,
  @location(1) @interpolate(flat) bloom: f32,
  @location(2) @interpolate(flat) seed: f32,
  @location(3) @interpolate(flat) alpha: f32,
};

// per-instance: iData0 = (centerX, centerY, scale, z); iData1 = (bloom, seed, alpha, _)
@vertex
fn vs(@builtin(vertex_index) vid: u32, @location(1) iData0: vec4<f32>, @location(2) iData1: vec4<f32>) -> VsOut {
  var C = array<vec2<f32>, 4>(vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0));
  let c = C[vid];
  var o: VsOut;
  o.vLocal = c;
  o.bloom = iData1.x;
  o.seed = iData1.y;
  o.alpha = iData1.z;
  let world = vec3(iData0.xy + c * iData0.z, iData0.w);
  o.pos = u.uViewProj * vec4(world, 1.0);
  return o;
}

fn hash2(p: vec2<f32>) -> vec2<f32> {
  var p3 = fract(vec3(p.x, p.y, p.x) * vec3(0.1031, 0.1030, 0.0973));
  p3 = p3 + dot(p3, vec3(p3.y, p3.z, p3.x) + 33.33);
  return -1.0 + 2.0 * fract((vec2(p3.x, p3.x) + vec2(p3.y, p3.z)) * vec2(p3.z, p3.y));
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

struct Knobs {
  petals: f32, layers: f32, len: f32, wid: f32, tipSharp: f32, tipNotch: f32,
  baseBias: f32, layerScale: f32, layerTwist: f32, swirl: f32, wobble: f32,
  inkFlow: f32, waterFlow: f32,
};

fn bloomKnobs(bloom: f32, seed: f32, petalsBase: f32) -> Knobs {
  let b = clamp(bloom, 0.0, 1.0);
  let open = smoothstep(0.0, 1.0, b);
  var k: Knobs;
  var petalAdj = 0.0;
  if (seed > 0.66) { petalAdj = 1.0; } else if (seed < 0.33) { petalAdj = -1.0; }
  k.petals = floor(petalsBase + petalAdj + 0.5);
  let lr = fract(seed * 91.7 + 0.137);
  if (lr < 0.5) { k.layers = 1.0; } else if (lr < 0.8) { k.layers = 2.0; } else { k.layers = 3.0; }
  k.len = mix(0.16, 0.95, open);
  k.wid = mix(0.05, 0.42, open);
  k.tipSharp = mix(2.4, 0.6, open);
  k.baseBias = mix(1.5, 0.95, open);
  k.tipNotch = mix(0.0, 0.12, open);
  k.layerScale = 0.66;
  k.layerTwist = 0.3 + 0.45 * seed;
  k.swirl = mix(1.5, 0.0, open) * (0.6 + 0.8 * seed);
  k.wobble = 0.35;
  k.inkFlow = 1.0;
  k.waterFlow = 0.6;
  return k;
}

fn inkStroke(uvLine: vec2<f32>, tAlong: f32, sd: f32, brushRGB: vec3<f32>, k: Knobs) -> vec4<f32> {
  let water = clamp(k.waterFlow, 0.0, 1.0);
  let bloomN = noise01(uvLine * 3.0);
  let jag = noise(vec2(uvLine.y * 6.0, uvLine.x * 2.5)) * 0.6 + noise(vec2(uvLine.y * 15.0, uvLine.x * 2.5)) * 0.4;
  let amp = mix(0.012, 0.05, water) * mix(0.6, 1.8, bloomN);
  let sdb = sd + jag * amp;
  let edgeAA = mix(0.004, 0.012, water);
  let fill = 1.0 - smoothstep(-edgeAA, edgeAA, sdb);
  if (fill <= 0.0) { return vec4(0.0); }

  let depth = clamp(-sd / 0.12, 0.0, 1.0);
  let edgePool = pow(1.0 - depth, 1.4);
  let tipDark = smoothstep(0.2, 1.0, clamp(tAlong, 0.0, 1.0));
  var dens = 0.24 + 0.42 * tipDark;
  dens = max(dens, edgePool * 0.8);
  dens = pow(clamp(dens, 0.0, 1.0), 1.0 / max(k.inkFlow, 0.1));

  let gran = noise01(uvLine * 2.0) * 0.65 + noise01(uvLine * 4.5) * 0.35;
  dens = dens * mix(1.0 - 0.3 * water, 1.0 + 0.22 * water, gran);

  let val = clamp(dens, 0.0, 1.0);
  let val5 = val * 5.0;
  var tone = (floor(val5) + smoothstep(0.25, 0.75, fract(val5))) / 5.0;
  tone = mix(val, tone, 0.35);

  let a = clamp(fill * tone, 0.0, 1.0);
  return vec4(brushRGB, a);
}

struct Petal { sd: f32, uvLine: vec2<f32>, tAlong: f32 };

fn petalRing(uv: vec2<f32>, petals: f32, len: f32, wid: f32, twist: f32, k: Knobs) -> Petal {
  let r = length(uv);
  var a = atan2(uv.x, uv.y) + twist;
  a = a + k.swirl * r;

  let cell = PI2 / max(petals, 1.0);
  let fa = a / cell + 0.5;
  let idx = floor(fa);
  let local = (fract(fa) - 0.5) * cell;

  let y = r;
  var x = local * r;
  let t = clamp(y / max(len, 1e-4), 0.0, 1.0);

  let w = max(k.wobble, 0.0);
  x = x + (noise01(vec2(y * 5.0, idx * 11.0)) - 0.5) * 0.05 * w;
  x = x + sin(y * 16.0 + idx) * 0.01 * w;

  let aexp = max(k.baseBias, 0.1);
  let bexp = max(k.tipSharp, 0.1);
  let tp = aexp / (aexp + bexp);
  let peak = pow(tp, aexp) * pow(1.0 - tp, bexp);
  var prof = pow(t, aexp) * pow(1.0 - t, bexp) / max(peak, 1e-4);
  prof = max(prof, smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.7, 1.0, t)) * 0.35);
  let halfW = max(wid * prof, 1e-4);

  let notchW = wid * 0.45 + 1e-4;
  let dip = max(k.tipNotch, 0.0) * len * exp(-(x * x) / (notchW * notchW));
  let tipLen = len - dip;

  var sd = abs(x) - halfW;
  sd = max(sd, y - tipLen);
  sd = max(sd, -y);

  var p: Petal;
  p.sd = sd;
  p.uvLine = vec2(x, y);
  p.tAlong = t;
  return p;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let petalsBase = u.uPetals;
  let inkColor = u.uInkColor;
  let k = bloomKnobs(in.bloom, in.seed, petalsBase);
  let b = clamp(in.bloom, 0.0, 1.0);

  var outRGB = vec3(0.0);
  var outA = 0.0;

  let layers = i32(clamp(k.layers, 1.0, 5.0) + 0.5);
  for (var i = 4; i >= 0; i = i - 1) {
    if (i >= layers) { continue; }
    let fi = f32(i);
    let ringIn = smoothstep(fi / f32(layers), fi / f32(layers) + 0.4, b);
    if (ringIn <= 0.0) { continue; }

    let scale = pow(k.layerScale, fi);
    let len = k.len * scale;
    let wid = k.wid * scale;
    var twist = k.layerTwist * fi;
    twist = twist + (PI2 / max(k.petals, 1.0)) * 0.5 * (fi - 2.0 * floor(fi / 2.0));

    let pet = petalRing(in.vLocal, k.petals, len, wid, twist, k);
    let ringRGB = inkColor * mix(1.0, 0.82, fi / f32(max(layers - 1, 1)));
    var s = inkStroke(pet.uvLine, pet.tAlong, pet.sd, ringRGB, k);
    s.a = s.a * ringIn;
    outRGB = mix(outRGB, s.rgb, s.a);
    outA = s.a + outA * (1.0 - s.a);
  }

  let a = outA * in.alpha;
  if (a <= 0.0) { discard; }
  return vec4(outRGB * a, a);
}
