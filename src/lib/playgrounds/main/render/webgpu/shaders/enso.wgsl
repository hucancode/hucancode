// Enso circle brush stroke (polar). WGSL port of webgl/shaders/enso.frag.glsl.
// Stroke laid out in polar coords about the origin, swept by uSweep; 3 stacked
// brush passes (bleed/wet/dry) over-composited. Straight-alpha output.

struct Uni {
  uResolution: vec2<f32>,
  uRadius: f32,
  uSweep: f32,
  uAngleStart: f32,
  uLineWidth: f32,
  uInkColor: vec3<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

const PI2: f32 = 6.28318531;
const CLOCKWISE: bool = true;
const uWobble: f32 = 0.5;
const uStrands: f32 = 2.5;
const uWidthEnd: f32 = 0.15;
const uWidthOffset: f32 = 0.55;
const uWidthRange: f32 = 1.5;
const uWidthAnchor: f32 = 1.0;
const uInkFlow: f32 = 2.0;
const uWaterFlow: f32 = 0.5;

struct Brush {
  inkFlow: f32, waterFlow: f32, strands: f32, lineWidth: f32,
  fadeEnds: f32, bleed: f32, taper: f32, stepOffset: f32,
};

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
  var P = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  return vec4(P[vid], 0.0, 1.0);
}

fn fmod(x: f32, y: f32) -> f32 { return x - y * floor(x / y); }

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

fn strokeAlpha(uvLine: vec2<f32>, paperUV: vec2<f32>, lineSize: vec2<f32>, sdGeometry: f32, b: Brush, res: vec2<f32>) -> f32 {
  var posInLineY = (uvLine.y / max(lineSize.y, 1e-6)) * b.taper;
  let inkFlow = max(b.inkFlow, 0.05);
  let taperEq = mix(1.5, 14.0, smoothstep(0.2, 3.0, inkFlow));
  if (posInLineY > 0.0) { posInLineY = pow(posInLineY, taperEq); }

  let strandsLocal = max(b.strands, 0.05);
  let strokeBoundary = dtoa(sdGeometry, 300.0);
  let tFine = noise01(uvLine * vec2(min(res.y, res.x) * 0.10 * strandsLocal, 1.0));
  let tMed = noise01(uvLine * vec2(34.0 * strandsLocal, 1.0));
  let tCoarse = noise01(uvLine * vec2(8.0 * strandsLocal, 1.0));
  var bristleField = (tFine * 0.12 + tMed * 0.30 + tCoarse * 0.58) * strokeBoundary;
  bristleField = max(0.008, bristleField);

  let water = clamp(b.waterFlow, 0.0, 1.0);
  let texClamped = clamp(bristleField, 0.0, 1.0);
  let lo = mix(0.28, 0.02, water);
  let hi = mix(0.78, 0.38, water);
  let strokeTexture = smoothstep(lo, hi, pow(texClamped, 0.52));

  var sa = pow(strokeTexture, (max(0.0, posInLineY) + 0.09) / inkFlow);
  sa = 1.09 * max(0.0, sa - pow(max(0.0, posInLineY), 0.5));
  sa = smoothf(sa);

  let paperBleedAmt = 60.0 + (rand(paperUV.yy) * 30.0) + (rand(paperUV.xx) * 30.0);
  var edge: f32;
  if (b.bleed > 0.5) { edge = dtoa(sdGeometry, paperBleedAmt); } else { edge = dtoa(sdGeometry, 300.0); }
  return clamp(sa * edge, 0.0, 1.0);
}

fn deformLine(uvLine: vec2<f32>, lineLength: f32) -> vec3<f32> {
  var h = uvLine;
  let w = max(uWobble, 0.0);
  let linePosY = h.y / max(lineLength, 1e-6);
  h.x = h.x + linePosY * 0.24 * w;
  var centerOff = 0.0;
  centerOff = centerOff + (noise01(vec2(0.0, uvLine.y)) - 0.5) * 0.04 * w;
  centerOff = centerOff + sin(uvLine.y * 3.0) * 0.019 * w;
  h.x = h.x + sin(uvLine.x * 30.0) * 0.02 * w;
  h.x = h.x + (noise01(uvLine * 5.0) - 0.5) * 0.005 * w;
  return vec3(h, centerOff);
}

fn drawStroke(uv: vec2<f32>, paperUV: vec2<f32>, lineLength: f32, strokeLen: f32, b: Brush, lineWidthU: f32, res: vec2<f32>) -> f32 {
  let lineWidth = b.lineWidth;
  let along = uv.x;
  let perp = uv.y;
  let uvLine = vec2(perp, along);

  let tAlong = clamp(along / max(strokeLen, 1e-6), 0.0, 1.0);
  let halfRange = max(uWidthRange, 1e-3) * 0.5;
  let wOff = uWidthOffset + b.stepOffset;
  let widthCurve = smoothstep(wOff - halfRange, wOff + halfRange, tAlong);
  let lineWidth1 = lineWidth * mix(1.0, clamp(uWidthEnd, 0.0, 1.0), widthCurve);

  let hu = deformLine(uvLine, lineLength);
  let huUV = hu.xy;
  let centerOff = hu.z;

  let bodyHalfW = lineWidth1 * 0.5;
  let anchorS = clamp(uWidthAnchor, 0.0, 1.0) * 2.0 - 1.0;
  let bodyCenter = centerOff + anchorS * 0.5 * (lineWidth - lineWidth1);
  let d_body = abs(perp - bodyCenter) - bodyHalfW;

  var base = strokeAlpha(huUV, paperUV, vec2(lineWidth1, max(strokeLen, 1e-6)), d_body, b, res);
  let alongClamped = clamp(along, 0.0, lineLength);

  if (b.fadeEnds > 0.5) {
    base = min(base, 0.45);
    let t = clamp(alongClamped / max(strokeLen, 1e-6), 0.0, 1.0);
    base = base * (1.0 - smoothstep(0.82, 1.0, t));
    let jag = noise01(vec2(huUV.x * 14.0, 0.0)) * 0.7 + noise01(vec2(huUV.x * 34.0, 7.0)) * 0.3;
    let edgePos = jag * 0.22;
    base = base * smoothstep(edgePos, edgePos + 0.015, t);
    return base;
  }

  let fadeLen = min(lineWidth * 5.0, strokeLen * 0.45);
  let bristleT = perp / max(lineWidthU, 1e-4);
  let tn1 = noise01(vec2(bristleT * 5.5, 1.71));
  let tn2 = noise01(vec2(bristleT * 13.0, 5.19));
  let tailVar = tn1 * 0.65 + tn2 * 0.35;
  let tailLen = max(fadeLen * mix(0.40, 1.0, tailVar), 1e-5);
  let startFade = smoothstep(0.0, tailLen, alongClamped);
  let hn1 = noise01(vec2(bristleT * 11.0, 8.33));
  let hn2 = noise01(vec2(bristleT * 27.3, 13.7));
  let headVar = hn1 * 0.65 + hn2 * 0.35;
  let headLen = fadeLen * mix(0.15, 1.0, headVar);
  let endFade = smoothstep(strokeLen, max(strokeLen - headLen, 0.0), alongClamped);
  return base * startFade * endFade;
}

fn layerAlpha(uv: vec2<f32>, r: f32, phase: f32, lineLength: f32, strokeLen: f32, b: Brush, radius: f32, lineWidthU: f32, res: vec2<f32>) -> f32 {
  let along = phase * radius;
  if (along > lineLength) { return 0.0; }
  let suv = vec2(along, r - radius);
  return drawStroke(suv, uv, lineLength, strokeLen, b, lineWidthU, res);
}

@fragment
fn fs(@builtin(position) fc: vec4<f32>) -> @location(0) vec4<f32> {
  let res = u.uResolution;
  let radius = u.uRadius;
  let sweep = u.uSweep;
  let angleStart = u.uAngleStart;
  let lineWidthU = u.uLineWidth;
  let inkColor = u.uInkColor;

  let uv = (2.0 * fc.xy - res) / res.y;
  let r = length(uv);
  var a = atan2(uv.x, uv.y) - angleStart;
  if (CLOCKWISE) { a = -a; }
  let phase = fmod(a, PI2);

  let lineLength = radius * PI2;
  let strokeLen = lineLength * clamp(sweep, 0.0, 1.0);

  let bleed = Brush(uInkFlow * 0.4, clamp(uWaterFlow * 1.3 + 0.2, 0.0, 1.0), uStrands * 1.6, lineWidthU * 1.0, 1.0, 1.0, 1.0, 0.35);
  let wet = Brush(uInkFlow * 0.7, uWaterFlow * 0.7, uStrands * 0.7, lineWidthU * 0.8, 0.0, 0.0, 1.0, 0.2);
  let dry = Brush(uInkFlow * 2.8, uWaterFlow * 0.2, uStrands * 0.5, lineWidthU * 0.4, 0.0, 0.0, 1.0, 0.0);

  let aBleed = layerAlpha(uv, r, phase, lineLength, strokeLen, bleed, radius, lineWidthU, res) * smoothstep(0.1, 0.5, sweep);
  let aWet = layerAlpha(uv, r, phase, lineLength, strokeLen, wet, radius, lineWidthU, res);
  let aDry = layerAlpha(uv, r, phase, lineLength, strokeLen, dry, radius, lineWidthU, res);

  var alpha = aBleed;
  alpha = alpha + aWet * (1.0 - alpha);
  alpha = alpha + aDry * (1.0 - alpha);
  return vec4(inkColor, alpha);
}
