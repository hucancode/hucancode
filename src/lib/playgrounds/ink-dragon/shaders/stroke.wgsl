// Ink ribbon body stroke. WGSL twin of stroke-polyline.vert.glsl + stroke.frag.glsl.
// position carries world coords (x in [-aspect,+aspect], y in [-1,+1]); aLineUV
// is the 0..1 (perp_t, arc_t) parameter. The orthographic camera is identity, so
// clip = world with x divided back by aspect. Drawn straight to screen (no flip).
//
// Uniform struct fields MUST match the `uniforms` list in index.js, in order.

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

fn hash2(p: vec2<f32>) -> vec2<f32> {
  let q = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(q) * 43758.5453123);
}
fn noise(p: vec2<f32>) -> f32 {
  let K1 = 0.366025404;
  let K2 = 0.211324865;
  let i = floor(p + (p.x + p.y) * K1);
  let a = p - i + (i.x + i.y) * K2;
  var o: vec2<f32>;
  if (a.x > a.y) { o = vec2(1.0, 0.0); } else { o = vec2(0.0, 1.0); }
  let b = a - o + K2;
  let c = a - 1.0 + 2.0 * K2;
  let h = max(vec3(0.5) - vec3(dot(a, a), dot(b, b), dot(c, c)), vec3(0.0));
  let n = h * h * h * h * vec3(dot(a, hash2(i + vec2(0.0))), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));
  return dot(n, vec3(70.0));
}
fn noise01(p: vec2<f32>) -> f32 { return clamp((noise(p) + 0.5) * 0.5, 0.0, 1.0); }
fn rand(co: vec2<f32>) -> f32 { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
fn dtoa(d: f32, amount: f32) -> f32 { return clamp(1.0 / (clamp(d, 1.0 / amount, 1.0) * amount), 0.0, 1.0); }
fn smoothf(x: f32) -> f32 { return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }

fn brushStrokeAlpha(uvLine: vec2<f32>, paperUV: vec2<f32>, sdGeometry: f32, brushAlpha: f32, fwx: f32) -> f32 {
  var posInLineY = uvLine.y;
  let inkFlow = max(u.uInkFlow, 0.05);
  let taperEq = mix(1.5, 14.0, smoothstep(0.2, 3.0, inkFlow));
  if (posInLineY > 0.0) { posInLineY = pow(posInLineY, taperEq); }
  let strandsLocal = max(u.uStrands, 0.05);
  let water = clamp(u.uWaterFlow, 0.0, 1.0);
  let boundaryFalloff = mix(300.0, 8.0, water);
  let strokeBoundary = dtoa(sdGeometry, boundaryFalloff);
  let pxScale = 0.10 / max(fwx, 1e-6);
  let tFine = noise01(uvLine * vec2(pxScale * strandsLocal, 1.0));
  let tMed = noise01(uvLine * vec2(6.0 * strandsLocal, 1.0));
  let tCoarse = noise01(uvLine * vec2(1.0 * strandsLocal, 1.0));
  var bristleField = (tFine * 0.12 + tMed * 0.30 + tCoarse * 0.58) * strokeBoundary;
  bristleField = max(0.008, bristleField);
  let texClamped = clamp(bristleField, 0.0, 1.0);
  let lo = mix(0.55, 0.02, water);
  let hi = mix(0.70, 0.40, water);
  let strokeTexture = smoothstep(lo, hi, pow(texClamped, 0.52));
  var sa = pow(strokeTexture, (max(0.0, posInLineY) + 0.09) / inkFlow);
  sa = 1.09 * max(0.0, sa - pow(max(0.0, posInLineY), 0.5));
  sa = smoothf(sa);
  let paperBleedAmt = (60.0 + (rand(paperUV.yy) * 30.0) + (rand(paperUV.xx) * 30.0)) * mix(1.0, 0.18, water);
  let alpha = sa * brushAlpha * dtoa(sdGeometry, paperBleedAmt);
  return clamp(alpha, 0.0, 1.0);
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let brush = u.uBrushColor;
  let perp_t = in.vUV01.x;
  let arc_t = in.vUV01.y;
  let invArcSpan = 1.0 / max(1.0 - 2.0 * u.uArcClearance, 1e-6);
  let invPerpSpan = 1.0 / max(1.0 - 2.0 * u.uPerpClearance, 1e-6);
  let arcInPoly = (arc_t - u.uArcClearance) * invArcSpan;
  let perpInPoly = (perp_t - u.uPerpClearance) * invPerpSpan;
  let relArc = 1.0 - arcInPoly;
  let relArcC = clamp(relArc, 0.0, 1.0);

  let halfRange = max(u.uWidthRange, 1e-3) * 0.5;
  let widthCurve = smoothstep(u.uWidthOffset - halfRange, u.uWidthOffset + halfRange, relArcC);
  let widthFrac = mix(1.0, clamp(u.uWidthEnd, 0.0, 1.0), widthCurve);
  let halfW = widthFrac * 0.5;

  let anchorS = clamp(u.uWidthAnchor, 0.0, 1.0) * 2.0 - 1.0;
  var center = 0.5 + anchorS * 0.5 * (1.0 - widthFrac);

  let w = max(u.uWobble, 0.0);
  center = center + relArcC * 0.06 * w;
  center = center + (noise01(vec2(0.0, arcInPoly)) - 0.5) * 0.04 * w;
  center = center + sin(arcInPoly * 12.0) * 0.012 * w;
  center = center + (noise01(vec2(arcInPoly * 4.0, perpInPoly * 4.0)) - 0.5) * 0.01 * w;

  let perpOff = perpInPoly - center;
  let overflowTip = max(0.0, -relArc);
  let overflowTail = max(0.0, relArc - 1.0);
  let overflow = overflowTip + overflowTail;
  var d = sqrt(overflow * overflow + perpOff * perpOff) - halfW;

  let strandsHead = max(u.uStrands, 0.05) * 0.15;
  let baseFreq = 25.0 * strandsHead;
  let j1 = noise01(vec2(perpInPoly * baseFreq, 0.0));
  let j2 = noise01(vec2(perpInPoly * baseFreq * 2.3, 11.3));
  let j3 = noise01(vec2(perpInPoly * baseFreq * 4.7, 27.7));
  let jitter = j1 * 0.65 + j2 * 0.22 + j3 * 0.13;
  let tipPush = pow(jitter, 1.1) * 0.25;
  d = max(d, -(relArc - tipPush));

  let uvLine = vec2(perpOff, relArcC);
  var inkA = brushStrokeAlpha(uvLine, in.vWorld, d, brush.a, fwidth(uvLine.x));
  inkA = clamp(inkA * u.uOpacity, 0.0, 1.0);
  return vec4(brush.rgb, inkA);
}
