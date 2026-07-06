struct Uni {
  uResolution: vec2<f32>,
  uClockwise: f32,
  uRadius: f32,
  uAngleStart: f32,
  uLineWidth: f32,
  uWobble: f32,
  uStrands: f32,
  uInkFlow: f32,
  uWaterFlow: f32,
  uWidthEnd: f32,
  uWidthOffset: f32,
  uWidthRange: f32,
  uWidthAnchor: f32,
  uSweepAmt: f32,
  uOpacityBleed: f32,
  uOpacityWet: f32,
  uOpacityDry: f32,
  uBrushColor: vec4<f32>,
  uBgColor: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

const PI2: f32 = 6.28318531;
const POLAR: bool = true;

struct VsOut { @builtin(position) pos: vec4<f32>, @location(0) vUV: vec2<f32> };

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> VsOut {
  var P = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  let p = P[vid];
  var o: VsOut;
  o.vUV = p * 0.5 + 0.5;
  o.pos = vec4(p, 0.0, 1.0);
  return o;
}

fn hash(p0: vec2<f32>) -> vec2<f32> {
  var p = vec2(dot(p0, vec2(127.1, 311.7)), dot(p0, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
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
  let n = h * h * h * h * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
  return dot(n, vec3(70.0));
}
fn noise01(p: vec2<f32>) -> f32 { return clamp((noise(p) + 0.5) * 0.5, 0.0, 1.0); }
fn rand(co: vec2<f32>) -> f32 { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
fn dtoa(d: f32, amount: f32) -> f32 { return clamp(1.0 / (clamp(d, 1.0 / amount, 1.0) * amount), 0.0, 1.0); }
fn smoothf(x: f32) -> f32 { return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }

// Per-layer brush settings — base uniforms get scaled into 3 of these.
struct Brush {
  inkFlow: f32,
  waterFlow: f32,
  strands: f32,
  lineWidth: f32,
  fadeEnds: f32,
  bleed: f32,
  taper: f32,
  stepOffset: f32,
};

fn colorBrushStroke(uvLine: vec2<f32>, paperUV: vec2<f32>, lineSize: vec2<f32>,
                    sdGeometry: f32, inpColor: vec3<f32>, brushColor: vec4<f32>, b: Brush) -> vec3<f32> {
  let rawPos = uvLine.y / max(lineSize.y, 1e-6);
  var posInLineY = rawPos * b.taper;

  let inkFlow = max(b.inkFlow, 0.05);
  let taperEq = mix(1.5, 14.0, smoothstep(0.2, 3.0, inkFlow));
  if (posInLineY > 0.0) {
    posInLineY = pow(posInLineY, taperEq);
  }

  let strandsLocal = max(b.strands, 0.05);
  let strokeBoundary = dtoa(sdGeometry, 300.0);

  let tFine = noise01(uvLine * vec2(min(u.uResolution.y, u.uResolution.x) * 0.10 * strandsLocal, 1.0));
  let tMed = noise01(uvLine * vec2(34.0 * strandsLocal, 1.0));
  let tCoarse = noise01(uvLine * vec2(8.0 * strandsLocal, 1.0));
  var bristleField = (tFine * 0.12 + tMed * 0.30 + tCoarse * 0.58) * strokeBoundary;
  bristleField = max(0.008, bristleField);

  let water = clamp(b.waterFlow, 0.0, 1.0);
  let texClamped = clamp(bristleField, 0.0, 1.0);
  let lo = mix(0.28, 0.02, water);
  let hi = mix(0.78, 0.38, water);
  let strokeTexture = smoothstep(lo, hi, pow(texClamped, 0.52));

  var strokeAlpha = pow(strokeTexture, (max(0.0, posInLineY) + 0.09) / inkFlow);
  let strokeAlphaBoost = 1.09;
  strokeAlpha = strokeAlphaBoost * max(0.0, strokeAlpha - pow(max(0.0, posInLineY), 0.5));
  strokeAlpha = smoothf(strokeAlpha);

  let paperBleedAmt = 60.0 + (rand(paperUV.yy) * 30.0) + (rand(paperUV.xx) * 30.0);
  var edge: f32;
  if (b.bleed > 0.5) { edge = dtoa(sdGeometry, paperBleedAmt); } else { edge = dtoa(sdGeometry, 300.0); }
  var alpha = strokeAlpha * brushColor.a * edge;
  if (b.fadeEnds > 0.5) {
    alpha = min(alpha, 0.45);
    alpha = alpha * (1.0 - smoothstep(0.82, 1.0, rawPos));
    let jag = noise01(vec2(uvLine.x * 14.0, 0.0)) * 0.7
            + noise01(vec2(uvLine.x * 34.0, 7.0)) * 0.3;
    let edgePos = jag * 0.22;
    alpha = alpha * smoothstep(edgePos, edgePos + 0.015, rawPos);
  }
  alpha = clamp(alpha, 0.0, 1.0);
  return mix(inpColor, brushColor.rgb, alpha);
}

fn deformLine(uvLine: vec2<f32>, lineLength: f32) -> vec3<f32> {
  var h = uvLine;
  let w = max(u.uWobble, 0.0);
  let twistAmt = 0.24 * w;
  let linePosY = h.y / max(lineLength, 1e-6);
  h.x = h.x + linePosY * twistAmt;

  var centerOff = 0.0;
  centerOff = centerOff + (noise01(vec2(0.0, uvLine.y) * 1.0) - 0.5) * 0.04 * w;
  centerOff = centerOff + sin(uvLine.y * 3.0) * 0.019 * w;
  h.x = h.x + sin(uvLine.x * 30.0) * 0.02 * w;
  h.x = h.x + (noise01(uvLine * 5.0) - 0.5) * 0.005 * w;
  return vec3(h.x, h.y, centerOff);
}

fn drawStroke(uv: vec2<f32>, paperUV: vec2<f32>, inpColor: vec3<f32>, brushColor: vec4<f32>,
              radius_: f32, sweepAmt: f32, b: Brush) -> vec3<f32> {
  let lineWidth = b.lineWidth;
  let lineLength = radius_ * PI2;
  let along = uv.x;
  let perp = uv.y;

  let uvLine = vec2(perp, along);

  let sweep = clamp(sweepAmt, 0.0, 1.0);
  let strokeLen = lineLength * sweep;

  let tAlong = clamp(along / max(strokeLen, 1e-6), 0.0, 1.0);
  let halfRange = max(u.uWidthRange, 1e-3) * 0.5;
  let wOff = u.uWidthOffset + b.stepOffset;
  let widthCurve = smoothstep(wOff - halfRange, wOff + halfRange, tAlong);
  let lineWidth1 = lineWidth * mix(1.0, clamp(u.uWidthEnd, 0.0, 1.0), widthCurve);

  let hu = deformLine(uvLine, lineLength);
  let huUV = vec2(hu.x, hu.y);
  let centerOff = hu.z;

  let bodyHalfW = lineWidth1 * 0.5;
  let anchorS = clamp(u.uWidthAnchor, 0.0, 1.0) * 2.0 - 1.0;
  let bodyCenter = centerOff + anchorS * 0.5 * (lineWidth - lineWidth1);
  var d_body = abs(perp - bodyCenter) - bodyHalfW;

  let strandsHead = max(b.strands, 0.05) * 0.15;
  let baseFreq = 25.0 * strandsHead;
  let jPerp = huUV.x;
  let j1 = noise01(vec2(jPerp * baseFreq, 0.0));
  let j2 = noise01(vec2(jPerp * baseFreq * 2.3, 11.3));
  let j3 = noise01(vec2(jPerp * baseFreq * 4.7, 27.7));
  let jitter = j1 * 0.65 + j2 * 0.22 + j3 * 0.13;
  let tipPush = pow(jitter, 1.1) * lineWidth * 2.2;
  if (b.fadeEnds < 0.5) { d_body = max(d_body, -(along - tipPush)); }

  return colorBrushStroke(huUV, paperUV, vec2(lineWidth1, max(strokeLen, 1e-6)),
                          d_body, inpColor, brushColor, b);
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let aspect = u.uResolution.x / u.uResolution.y;
  let uv = vec2((in.vUV.x * 2.0 - 1.0) * aspect, in.vUV.y * 2.0 - 1.0);

  var suv: vec2<f32>;
  if (POLAR) {
    let r = length(uv);
    var a = atan2(uv.x, uv.y) - u.uAngleStart;
    if (u.uClockwise > 0.5) { a = -a; }
    let phase = a - PI2 * floor(a / PI2);
    suv = vec2(phase * r, r - u.uRadius);
  } else {
    suv = vec2(uv.x + aspect - u.uAngleStart * u.uRadius, uv.y - u.uRadius);
  }

  var col = u.uBgColor.rgb;

  // 3 stacked passes, wide-light to narrow-dark.
  let bleed = Brush(u.uInkFlow * 0.4,
                    clamp(u.uWaterFlow * 1.3 + 0.2, 0.0, 1.0),
                    u.uStrands * 1.6,
                    u.uLineWidth * 1.0,
                    1.0, 1.0, 1.0, 0.35);
  let wet = Brush(u.uInkFlow * 0.3,
                  clamp(u.uWaterFlow * 1.5 + 0.5, 0.0, 1.0),
                  u.uStrands * 0.7,
                  u.uLineWidth * 0.8,
                  0.0, 0.0, 1.0, 0.2);
  let dry = Brush(u.uInkFlow * 2.8,
                  u.uWaterFlow * 0.2,
                  u.uStrands * 0.5,
                  u.uLineWidth * 0.4,
                  0.0, 0.0, 1.0, 0.0);

  let bleedSweepGate = smoothstep(0.1, 0.5, u.uSweepAmt);
  let inkBleed = vec4(u.uBrushColor.rgb, u.uBrushColor.a * clamp(u.uOpacityBleed, 0.0, 1.0) * bleedSweepGate);
  let inkWet = vec4(u.uBrushColor.rgb, u.uBrushColor.a * clamp(u.uOpacityWet, 0.0, 1.0));
  let inkDry = vec4(u.uBrushColor.rgb, u.uBrushColor.a * clamp(u.uOpacityDry, 0.0, 1.0));

  col = drawStroke(suv, uv, col, inkBleed, u.uRadius, u.uSweepAmt, bleed);
  col = drawStroke(suv, uv, col, inkWet, u.uRadius, u.uSweepAmt, wet);
  col = drawStroke(suv, uv, col, inkDry, u.uRadius, u.uSweepAmt, dry);

  col = col + (rand(uv) - 0.5) * 0.05;
  col = clamp(col, vec3(0.0), vec3(1.0));
  return vec4(col, 1.0);
}
