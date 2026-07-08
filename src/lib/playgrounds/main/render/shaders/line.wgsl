// Debug path lines / points. WGSL port of the inline LINE_VERT/FRAG. Point size
// is fixed at 1px (WGSL has no gl_PointSize); debug-only, so acceptable.

struct Uni {
  uVP: mat4x4<f32>,
  uAspect: f32,
  u3D: i32,
  uColor: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

@vertex
fn vs(@location(0) aPos: vec3<f32>) -> @builtin(position) vec4<f32> {
  if (u.u3D == 1) {
    return u.uVP * vec4(aPos, 1.0);
  }
  return vec4(aPos.x / u.uAspect, aPos.y, 0.0, 1.0);
}

@fragment
fn fs() -> @location(0) vec4<f32> {
  return u.uColor;
}
