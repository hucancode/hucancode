// Bagua ring — WGSL twin of shaders/bagua.frag.glsl. Fullscreen quad; vertex
// shader rotates sampled coords (uRot) and scales clip size (uScale). The eight
// trigrams are stems of broken/full bars laid around a ring by polar angle.
// Uniform struct fields MUST match the `uniforms` list in index.js.

struct Uni {
  uScale: vec2<f32>,
  uRot: f32,
  time: f32,
  alpha: f32,
  uBitCount: f32,
};
@group(0) @binding(0) var<uniform> u: Uni;

const PI: f32 = 3.14159265359;
const PIX2: f32 = 6.28318530718;
const EPSILON: f32 = 0.01;
const BAR_HEIGHT: f32 = 0.07;
const BAR_MARGIN: f32 = 0.02;
const CIRCLE_RADIUS: f32 = 1.1;

struct VsOut { @builtin(position) pos: vec4<f32>, @location(0) vUV: vec2<f32> };

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> VsOut {
  var P = array<vec2<f32>, 6>(
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0),
    vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0));
  let p = P[vid];
  let c = cos(u.uRot);
  let s = sin(u.uRot);
  let r = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  var o: VsOut;
  o.vUV = r * 0.5 + 0.5;
  o.pos = vec4(p * u.uScale, 0.0, 1.0);
  return o;
}

fn rangeF(l: f32, r: f32, x: f32) -> f32 {
  return smoothstep(l, l + EPSILON, x) * smoothstep(r + EPSILON, r, x);
}
fn rangeInvert(l: f32, r: f32, x: f32) -> f32 {
  return smoothstep(l, l + EPSILON, x) + smoothstep(r + EPSILON, r, x);
}
fn rotateMat(angle: f32) -> mat2x2<f32> {
  // columns must match the GLSL mat2(cos,-sin,sin,cos): col0=(cos,-sin),
  // col1=(sin,cos). WGSL `uv * M` is row-vec×matrix, same as GLSL — so identical
  // columns give identical rotation. (The flipped sign here dropped 6/8 trigrams.)
  return mat2x2<f32>(cos(angle), -sin(angle), sin(angle), cos(angle));
}

// bar = full bar for x = 1, broken bar for x = 0
fn bar(x: i32, uv: vec2<f32>, barWidth: f32) -> f32 {
  let cut = barWidth * 0.1;
  var ret = rangeF(-barWidth * 0.5, barWidth * 0.5, uv.x) *
            rangeF(-BAR_HEIGHT * 0.5, BAR_HEIGHT * 0.5, uv.y);
  if (x == 0) {
    ret = ret * rangeInvert(cut, -cut, uv.x);
  }
  return ret;
}

// stem = bar x bitCount
fn stem(x: i32, uv: vec2<f32>, bitCount: i32, barWidth: f32) -> f32 {
  let bit = i32(0.5 - (uv.y + CIRCLE_RADIUS * 0.5) / (BAR_HEIGHT + BAR_MARGIN));
  if (bit < 0 || bit >= bitCount) {
    return 0.0;
  }
  let k = (x >> u32(bit)) & 1;
  let offset = vec2(0.0, CIRCLE_RADIUS * 0.5 + f32(bit) * (BAR_HEIGHT + BAR_MARGIN));
  return bar(k, uv + offset, barWidth);
}

// bagua = stem x (2^bitCount)
fn bagua(uv: vec2<f32>, bitCount: i32, barWidth: f32) -> f32 {
  let n = (1 << u32(bitCount));
  let i = round(f32(n) * (0.75 - atan2(uv.y, uv.x) / PIX2));
  return stem(i32(i), uv * rotateMat(i * PIX2 / f32(n)), bitCount, barWidth);
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let bitCount = i32(u.uBitCount + 0.5);
  var uv = in.vUV * 2.0 - 1.0;
  let barWidth = PI / f32(1 << u32(bitCount));
  uv = uv * (CIRCLE_RADIUS + (BAR_HEIGHT + BAR_MARGIN) * f32(bitCount * 2));
  let v = bagua(uv, bitCount, barWidth);
  return vec4(v, v, v, u.alpha * v);
}
