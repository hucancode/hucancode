// Flight-path overlay: transform the baked frame origins and draw them as a
// line strip. WGSL twin of the inline GLSL PATH_VERT/PATH_FRAG in index.js.
//
// Uniform struct fields MUST match the `uniforms` list in index.js, in order.

struct Uni {
  uViewProj: mat4x4<f32>,
  uColor: vec3<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

@vertex
fn vs(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
  return u.uViewProj * vec4(position, 1.0);
}

@fragment
fn fs() -> @location(0) vec4<f32> {
  return vec4(u.uColor, 0.5);
}
