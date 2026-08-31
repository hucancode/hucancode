// Composite: read the accumulated linear HDR trace buffer (accTex, rgba32f),
// divide by the sample count stored in alpha, then expose + tone-map + sRGB.
// One fullscreen triangle, WebGPU only.

struct BlitParams {
  exposure: f32,
};

@group(0) @binding(0) var<uniform> p: BlitParams;
@group(0) @binding(1) var accTex: texture_2d<f32>;

struct VOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VOut {
  let positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
  );
  var out: VOut;
  let pos = positions[vi];
  out.pos = vec4<f32>(pos, 0.0, 1.0);
  out.uv = vec2<f32>(pos.x * 0.5 + 0.5, 0.5 - pos.y * 0.5);
  return out;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4<f32> {
  let dims = vec2<f32>(textureDimensions(accTex));
  let coord = vec2<i32>(clamp(in.uv * dims, vec2<f32>(0.0), dims - vec2<f32>(1.0)));
  let acc = textureLoad(accTex, coord, 0);
  let samples = max(acc.a, 1.0);
  var c = acc.rgb / samples;
  c = 1.0 - exp(-c * p.exposure);
  c = pow(c, vec3<f32>(1.0 / 2.2));
  return vec4<f32>(c, 1.0);
}
