// Flat ink ribbon.
// position carries world coords (x in [-aspect,+aspect], y in [-1,+1]); the
// mesh shapes the taper, the fragment only fades opacity along the arc.
struct Uni {
  uAspect: f32,
  uBrushColor: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vUV01: vec2<f32>,
};

@vertex
fn vs(@location(0) position: vec3<f32>, @location(1) aLineUV: vec2<f32>) -> VsOut {
  var o: VsOut;
  o.vUV01 = aLineUV;
  o.pos = vec4(position.x / u.uAspect, position.y, 0.0, 1.0);
  return o;
}

const TAIL_FADE: f32 = 0.35; // arc span over which the tail fades in

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let alpha = u.uBrushColor.w * smoothstep(0.0, TAIL_FADE, in.vUV01.y);
  if (alpha <= 0.0) { discard; }
  return vec4(u.uBrushColor.xyz, alpha);
}
