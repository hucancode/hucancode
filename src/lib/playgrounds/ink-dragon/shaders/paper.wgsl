struct Uni {
  uModel: mat4x4<f32>,
  uAspect: f32,
  uBgColor: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

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

fn rand(co: vec2<f32>) -> f32 { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let world = vec2((in.vUV.x * 2.0 - 1.0) * u.uAspect, in.vUV.y * 2.0 - 1.0);
  let g = (rand(world) - 0.5) * 0.08 * u.uBgColor.a;
  let c = clamp(u.uBgColor.rgb + vec3(g), vec3(0.0), vec3(1.0));
  return vec4(c, u.uBgColor.a);
}
