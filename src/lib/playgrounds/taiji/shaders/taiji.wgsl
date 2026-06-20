// Uniform struct fields MUST match the `uniforms` list in index.js.
struct Uni {
  uScale: vec2<f32>,
  uRot: f32,
  alpha: f32,
  uStroke: f32,
  uDot: f32,
  color1: vec3<f32>,
  color2: vec3<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

const EPSILON: f32 = 0.01;
const BIG_CIRCLE_RADIUS: f32 = 0.4;

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

fn smoothT(t: f32, x: f32) -> f32 { return smoothstep(t - EPSILON * 0.5, t + EPSILON * 0.5, x); }
fn whiteCircle(r: f32, o: vec2<f32>, uv: vec2<f32>) -> f32 {
  return smoothstep(r + EPSILON * 0.5, r - EPSILON * 0.5, length(uv - o));
}
fn blackCircle(r: f32, o: vec2<f32>, uv: vec2<f32>) -> f32 {
  return smoothstep(r - EPSILON * 0.5, r + EPSILON * 0.5, length(uv - o));
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  var v = 0.0;
  let uv = in.vUV * 2.0 - 1.0;
  let center = vec2(0.0);
  let centerTop = center + vec2(0.0, BIG_CIRCLE_RADIUS);
  let centerBottom = center + vec2(0.0, -BIG_CIRCLE_RADIUS);
  v = v + whiteCircle(BIG_CIRCLE_RADIUS * 2.0, center, uv) * smoothT(0.0, uv.x);
  v = v + whiteCircle(BIG_CIRCLE_RADIUS, centerTop, uv);
  v = v * blackCircle(BIG_CIRCLE_RADIUS, centerBottom, uv);
  v = v + whiteCircle(u.uDot, centerBottom, uv);
  v = v * blackCircle(u.uDot, centerTop, uv);
  v = clamp(v, 0.0, 1.0);
  let mask = whiteCircle(BIG_CIRCLE_RADIUS * 2.0 + u.uStroke, center, uv);
  return vec4(u.color1 * v + u.color2 * (1.0 - v), mask * u.alpha);
}
