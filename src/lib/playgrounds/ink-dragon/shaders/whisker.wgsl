// pure passthrough: positions are pre-baked to clip space JS-side
struct Uni {
  uBrushColor: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

@vertex
fn vs(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
  return vec4(position.xy, 0.0, 1.0);
}

@fragment
fn fs() -> @location(0) vec4<f32> {
  return u.uBrushColor;
}
