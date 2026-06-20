// Debug fullscreen blit of an offscreen target. WGSL port of FS_TRI_VERT + BLIT_FRAG.

@group(0) @binding(0) var tex: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vUV: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> VsOut {
  var P = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  let p = P[vid];
  var o: VsOut;
  o.vUV = p * 0.5 + 0.5;
  o.pos = vec4(p, 0.0, 1.0);
  return o;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  return textureSample(tex, samp, in.vUV);
}
