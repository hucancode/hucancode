// Ink ribbon stroke. WGSL twin of webgl/shaders/stroke.frag.glsl (+ inline vert).
// Body drawn camera-relative (subtract camY). uSimple = 1 takes a cheap flat path.
// The shared ink core (src/lib/brush/shaders/ink-core.wgsl) is spliced in at
// the marker below by composeShader().

struct Uni {
  uAspect: f32,
  uCamY: f32,
  uFlipY: f32,
  uExt: f32,
  uInkFlow: f32,
  uStrands: f32,
  uWaterFlow: f32,
  uWobble: f32,
  uOpacity: f32,
  uWidthEnd: f32,
  uWidthOffset: f32,
  uWidthRange: f32,
  uWidthAnchor: f32,
  uPerpClearance: f32,
  uArcClearance: f32,
  uSimple: i32,
  uBrushColor: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vUV01: vec2<f32>,
  @location(1) vWorld: vec2<f32>,
};

@vertex
fn vs(@location(0) aPos: vec2<f32>, @location(1) aLineUV: vec2<f32>) -> VsOut {
  var o: VsOut;
  o.vUV01 = aLineUV;
  o.vWorld = aPos;
  o.pos = vec4(aPos.x / (u.uAspect * u.uExt), (aPos.y - u.uCamY) / u.uExt * u.uFlipY, 0.0, 1.0);
  return o;
}

//#include ink-core.wgsl

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let f = strokeField(in.vUV01);

  if (u.uSimple == 1) {
    // cheap flat ink for whiskers: soft edge, slight tail taper, no bristles
    let aa = fwidth(f.perpOff) + 1e-4;
    let av = (1.0 - smoothstep(-aa, aa, f.d)) * u.uBrushColor.a * u.uOpacity;
    if (av <= 0.0) { discard; }
    return vec4(u.uBrushColor.rgb, av);
  }

  return inkStrokeColor(f, in.vWorld);
}
