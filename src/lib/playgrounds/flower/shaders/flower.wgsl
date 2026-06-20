// Sumi-e ink flower — WGSL twin of shaders/flower.frag.glsl. One fullscreen
// triangle; petals are SDF brush strokes folded in polar space, stacked in
// concentric layers. Same ink machinery as the GLSL version.
//
// Uniform struct fields MUST match the `uniforms` list in index.js, in order
// (the engine packs a uniform buffer from that list — engine/gpu/webgpu.js).

struct Uni {
  uResolution: vec2<f32>,
  uPetals: f32, uLayers: f32, uLength: f32, uWidth: f32,
  uTipSharp: f32, uTipNotch: f32, uBaseBias: f32, uLayerScale: f32,
  uLayerTwist: f32, uSwirl: f32, uInkFlow: f32, uWaterFlow: f32,
  uInkColor: vec4<f32>, uBgColor: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

const PI2: f32 = 6.28318531;

struct VsOut { @builtin(position) pos: vec4<f32>, @location(0) vUV: vec2<f32> };

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> VsOut {
  var P = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  let p = P[vid];
  var o: VsOut;
  o.vUV = p * 0.5 + 0.5;
  o.pos = vec4(p, 0.0, 1.0);
  return o;
}

// cheap sin-free hash (Dave Hoskins)
fn hash(p: vec2<f32>) -> vec2<f32> {
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
  let n = h * h * h * h * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
  return dot(n, vec3(70.0));
}
fn noise01(p: vec2<f32>) -> f32 { return clamp((noise(p) + 0.5) * 0.5, 0.0, 1.0); }

fn inkStroke(uvLine: vec2<f32>, tAlong: f32, sd: f32, inpColor: vec3<f32>, brush: vec4<f32>) -> vec3<f32> {
  let water = clamp(u.uWaterFlow, 0.0, 1.0);
  let bloom = noise01(uvLine * 3.0);
  let jag = noise(vec2(uvLine.y * 6.0, uvLine.x * 2.5)) * 0.6
          + noise(vec2(uvLine.y * 15.0, uvLine.x * 2.5)) * 0.4;
  let amp = mix(0.012, 0.05, water) * mix(0.6, 1.8, bloom);
  let sdb = sd + jag * amp;
  let edgeAA = mix(0.004, 0.012, water);
  let fill = 1.0 - smoothstep(-edgeAA, edgeAA, sdb);
  if (fill <= 0.0) { return inpColor; }

  let depth = clamp(-sd / 0.12, 0.0, 1.0);
  let edgePool = pow(1.0 - depth, 1.4);
  let tipDark = smoothstep(0.2, 1.0, clamp(tAlong, 0.0, 1.0));
  var dens = 0.24 + 0.42 * tipDark;
  dens = max(dens, edgePool * 0.8);
  dens = pow(clamp(dens, 0.0, 1.0), 1.0 / max(u.uInkFlow, 0.1));

  let gran = noise01(uvLine * 2.0) * 0.65 + noise01(uvLine * 4.5) * 0.35;
  dens = dens * mix(1.0 - 0.3 * water, 1.0 + 0.22 * water, gran);

  let val = clamp(dens, 0.0, 1.0);
  let val5 = val * 5.0;
  var tone = (floor(val5) + smoothstep(0.25, 0.75, fract(val5))) / 5.0;
  tone = mix(val, tone, 0.35);

  let alpha = clamp(fill * tone * brush.a, 0.0, 1.0);
  return mix(inpColor, brush.rgb, alpha);
}

struct Petal { sd: f32, uvLine: vec2<f32>, tAlong: f32 };

fn petalRing(uv: vec2<f32>, petals: f32, len: f32, wid: f32, twist: f32) -> Petal {
  let r = length(uv);
  var a = atan2(uv.x, uv.y) + twist;
  a = a + u.uSwirl * r;
  let cell = PI2 / max(petals, 1.0);
  let fa = a / cell + 0.5;
  let local = (fract(fa) - 0.5) * cell;

  let y = r;
  let x = local * r;
  let t = clamp(y / max(len, 1e-4), 0.0, 1.0);

  let aexp = max(u.uBaseBias, 0.1);
  let bexp = max(u.uTipSharp, 0.1);
  let tp = aexp / (aexp + bexp);
  let peak = pow(tp, aexp) * pow(1.0 - tp, bexp);
  var prof = pow(t, aexp) * pow(1.0 - t, bexp) / max(peak, 1e-4);
  prof = max(prof, smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.7, 1.0, t)) * 0.35);
  let halfW = max(wid * prof, 1e-4);

  let notchW = wid * 0.45 + 1e-4;
  let dip = max(u.uTipNotch, 0.0) * len * exp(-(x * x) / (notchW * notchW));
  let tipLen = len - dip;

  var sd = abs(x) - halfW;
  sd = max(sd, y - tipLen);
  sd = max(sd, -y);

  var pr: Petal;
  pr.sd = sd; pr.uvLine = vec2(x, y); pr.tAlong = t;
  return pr;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let aspect = u.uResolution.x / u.uResolution.y;
  let uv = vec2((in.vUV.x * 2.0 - 1.0) * aspect, in.vUV.y * 2.0 - 1.0);

  var col = u.uBgColor.rgb;

  let layers = i32(clamp(u.uLayers, 1.0, 5.0) + 0.5);
  for (var i = 4; i >= 0; i = i - 1) {
    if (i >= layers) { continue; }
    let fi = f32(i);
    let scale = pow(clamp(u.uLayerScale, 0.4, 1.0), fi);
    let len = u.uLength * scale;
    let wid = u.uWidth * scale;
    var twist = u.uLayerTwist * fi;
    twist = twist + (PI2 / max(u.uPetals, 1.0)) * 0.5 * (fi - 2.0 * floor(fi / 2.0));

    let pet = petalRing(uv, u.uPetals, len, wid, twist);
    let f = mix(1.0, 0.82, fi / f32(max(layers - 1, 1)));
    let ink = vec4(u.uInkColor.rgb * f, u.uInkColor.a);
    col = inkStroke(pet.uvLine, pet.tAlong, pet.sd, col, ink);
  }

  let grain = (noise01(uv * 180.0) - 0.5) * 0.02;
  col = clamp(col + vec3(grain), vec3(0.0), vec3(1.0));
  return vec4(col, 1.0);
}
