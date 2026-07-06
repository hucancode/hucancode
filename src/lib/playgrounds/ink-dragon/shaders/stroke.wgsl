// position carries world coords (x in [-aspect,+aspect], y in [-1,+1]); aLineUV is 0..1 (perp_t, arc_t).
// The shared ink core (src/lib/brush/shaders/ink-core.wgsl) is spliced in at
// the marker below by composeShader().
struct Uni {
  uAspect: f32,
  uInkFlow: f32,
  uStrands: f32,
  uWaterFlow: f32,
  uOpacity: f32,
  uWobble: f32,
  uWidthEnd: f32,
  uWidthOffset: f32,
  uWidthRange: f32,
  uWidthAnchor: f32,
  uPerpClearance: f32,
  uArcClearance: f32,
  uBrushColor: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vUV01: vec2<f32>,
  @location(1) vWorld: vec2<f32>,
};

@vertex
fn vs(@location(0) position: vec3<f32>, @location(1) aLineUV: vec2<f32>) -> VsOut {
  var o: VsOut;
  o.vUV01 = aLineUV;
  o.vWorld = position.xy;
  o.pos = vec4(position.x / u.uAspect, position.y, 0.0, 1.0);
  return o;
}

//#include ink-core.wgsl

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  return inkStrokeColor(strokeField(in.vUV01), in.vWorld);
}
