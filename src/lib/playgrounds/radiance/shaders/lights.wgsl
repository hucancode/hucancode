// Radiance Cascades (2D) — moving light blobs, drawn as instanced quads into
// the light accumulation buffer (additive). Lights emit without occluding, so
// the fragment alpha is 0 (occlusion lives only in the painted scene texture).

struct Uni {
  dims: vec2<f32>,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> u: Uni;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec3<f32>,
};

@vertex
fn vs(
  @builtin(vertex_index) vid: u32,
  @location(0) lPos: vec2<f32>,
  @location(1) lRadius: f32,
  @location(2) lColor: vec3<f32>,
) -> VsOut {
  let corner = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
  );
  let c = corner[vid];
  let world = lPos + c * lRadius;
  let ndc = vec2<f32>((world.x / u.dims.x) * 2.0 - 1.0, 1.0 - (world.y / u.dims.y) * 2.0);
  var o: VsOut;
  o.pos = vec4<f32>(ndc, 0.0, 1.0);
  o.uv = c;
  o.color = lColor;
  return o;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let d = length(in.uv);
  if (d > 1.0) { discard; }
  // Gaussian falloff for a soft glow, normalized to reach zero at the edge.
  let k = 10.0;
  let falloff = (exp(-d * d * k) - exp(-k)) / (1.0 - exp(-k));
  return vec4<f32>(in.color * falloff, 0.0);
}
