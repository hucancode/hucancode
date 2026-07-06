// Composite an offscreen ink layer as a textured quad on the z=0 world plane,
// through the orbit camera. WGSL port of the inline COMPOSITE_VERT/FRAG.

struct Uni {
  uViewProj: mat4x4<f32>,
  uOpacity: f32,
  uAspect: f32,
  uZ: f32,
  uStationY: f32,
  uExt: f32,
};
@group(0) @binding(0) var<uniform> u: Uni;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vUV: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> VsOut {
  var C = array<vec2<f32>, 4>(vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0));
  let aspect = u.uAspect;
  let z = u.uZ;
  let stationY = u.uStationY;
  let c = C[vid];
  var o: VsOut;
  o.vUV = c;
  let world = vec3((c.x * 2.0 - 1.0) * aspect * u.uExt, (c.y * 2.0 - 1.0) * u.uExt + stationY, z);
  o.pos = u.uViewProj * vec4(world, 1.0);
  return o;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  return textureSample(tex, samp, in.vUV) * u.uOpacity; // premultiplied scale
}
