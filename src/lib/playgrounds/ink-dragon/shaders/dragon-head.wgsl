// Dragon head silhouette plane. WGSL twin of basic.vert.glsl + dragon-head.frag.glsl.
// A TRS-transformed quad; the fragment evaluates a top-down dragon-head SDF.
//
// Uniform struct fields MUST match the `uniforms` list in index.js, in order.

struct Uni {
  uModel: mat4x4<f32>,
  uBrushColor: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

const HEAD_W: f32 = 2.4;
const HEAD_H: f32 = 1.6;
const HEAD_SDF_OFFSET_X: f32 = -0.55;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vUV: vec2<f32>,
};

@vertex
fn vs(@location(0) position: vec3<f32>, @location(1) uv: vec2<f32>) -> VsOut {
  var o: VsOut;
  o.vUV = uv;
  o.pos = u.uModel * vec4(position, 1.0);
  return o;
}

fn sdSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}
fn sdCapsule(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, r: f32) -> f32 { return sdSegment(p, a, b) - r; }
fn sdEllipse(p: vec2<f32>, r: vec2<f32>) -> f32 { return (length(p / r) - 1.0) * min(r.x, r.y); }
fn smin2(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

fn sdDragonHead(p: vec2<f32>) -> f32 {
  let pm = vec2(p.x, abs(p.y));
  let snout = sdCapsule(p, vec2(0.05, 0.0), vec2(-0.55, 0.0), 0.08);
  let dome = sdEllipse(p - vec2(-0.82, 0.0), vec2(0.34, 0.32));
  let cheek = sdCapsule(pm, vec2(-0.55, 0.0), vec2(-0.78, 0.26), 0.07);
  var head = smin2(snout, dome, 0.12);
  head = smin2(head, cheek, 0.06);
  let jaw = sdEllipse(p - vec2(-0.30, 0.0), vec2(0.22, 0.13));
  head = smin2(head, jaw, 0.08);
  let horn = sdCapsule(pm, vec2(-0.85, 0.18), vec2(-1.30, 0.46), 0.040);
  let hornTip = sdCapsule(pm, vec2(-1.30, 0.46), vec2(-1.48, 0.62), 0.022);
  let horns = min(horn, hornTip);
  let mane1 = sdCapsule(pm, vec2(-1.05, 0.10), vec2(-1.40, 0.18), 0.028);
  let mane2 = sdCapsule(p, vec2(-1.10, 0.00), vec2(-1.50, 0.00), 0.030);
  let mane = min(mane1, mane2);
  var d = head;
  d = min(d, horns);
  d = min(d, mane);
  return d;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let p = vec2((in.vUV.x - 0.5) * HEAD_W + HEAD_SDF_OFFSET_X, (in.vUV.y - 0.5) * HEAD_H);
  let d = sdDragonHead(p);
  let aa = fwidth(d);
  let alpha = (1.0 - smoothstep(-aa, aa, d)) * u.uBrushColor.w;
  if (alpha <= 0.0) { discard; }
  return vec4(u.uBrushColor.xyz, alpha);
}
