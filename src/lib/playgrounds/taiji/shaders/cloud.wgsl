// Uniform struct fields MUST match the `uniforms` list in index.js.
struct Uni {
  uScale: vec2<f32>,
  uRot: f32,
  time: f32,
  alpha: f32,
};
@group(0) @binding(0) var<uniform> u: Uni;

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

fn random(st: vec2<f32>) -> f32 {
  return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
}
fn noise(st: vec2<f32>) -> f32 {
  let i = floor(st);
  let f = fract(st);
  let a = random(i);
  let b = random(i + vec2(1.0, 0.0));
  let c = random(i + vec2(0.0, 1.0));
  let d = random(i + vec2(1.0, 1.0));
  let uu = f * f * (3.0 - 2.0 * f);
  return mix(a, b, uu.x) + (c - a) * uu.y * (1.0 - uu.x) + (d - b) * uu.x * uu.y;
}
fn fbm(st0: vec2<f32>) -> f32 {
  var st = st0;
  var v = 0.0;
  var a = 0.5;
  let shift = vec2(100.0);
  let ROT = mat2x2<f32>(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
  for (var i = 0; i < 5; i = i + 1) {
    v = v + a * noise(st);
    st = ROT * st * 2.0 + shift;
    a = a * 0.5;
  }
  return v;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let st = in.vUV * 3.0;
  let d = length(st - vec2(1.5));
  let circle = 1.0 - smoothstep(0.3, 1.5, d);
  var color = vec3(0.0);
  var q = vec2(0.0);
  q.x = fbm(st + 0.00 * u.time);
  q.y = fbm(st + vec2(1.0));
  var r = vec2(0.0);
  r.x = fbm(st + 1.0 * q + vec2(1.7, 9.2) + 0.15 * u.time);
  r.y = fbm(st + 1.0 * q + vec2(8.3, 2.8) + 0.126 * u.time);
  let f = fbm(st + r);
  color = mix(vec3(0.101961, 0.619608, 0.666667),
              vec3(0.666667, 0.666667, 0.498039),
              clamp((f * f) * 4.0, 0.0, 1.0));
  color = mix(color, vec3(0.0, 0.0, 0.164706), clamp(length(q), 0.0, 1.0));
  color = mix(color, vec3(0.666667, 1.0, 1.0), clamp(length(r.x), 0.0, 1.0));
  return vec4((f * f * f + 0.6 * f * f + 0.5 * f) * color, circle * u.alpha);
}
