// Uniform struct fields MUST match the `uniforms` list order in index.js.
struct Uni {
  uViewProj: mat4x4<f32>,
  uModel: mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vColor: vec3<f32>,
};

@vertex
fn vs(@location(0) position: vec3<f32>, @location(1) color: vec3<f32>) -> VsOut {
  var o: VsOut;
  o.vColor = color;
  o.pos = u.uViewProj * u.uModel * vec4(position, 1.0);
  return o;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  return vec4(in.vColor, 1.0);
}
