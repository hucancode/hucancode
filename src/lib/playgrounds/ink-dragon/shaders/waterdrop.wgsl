// Verlet whisker: a curve-texture sampled polyline SDF rendered on a fullscreen
// quad. WGSL twin of basic.vert.glsl + waterdrop.frag.glsl. The curve points
// (x, y, cumulativeArc) are packed one-per-texel into an rgba32float DATA TEXTURE
// (1 row); sampled with textureLoad (exact texel, matching the GLSL NEAREST fetch).
//
// Uniform struct fields MUST match the `uniforms` list in index.js, in order.

struct Uni {
  uModel: mat4x4<f32>,
  uAspect: f32,
  curveLen: f32,
  curveTotalLen: f32,
  curveTexWidth: f32,
  uOffset: f32,
  uArcLength: f32,
  uLineWidth: f32,
  uInkFlow: f32,
  uOpacity: f32,
  uWidthEnd: f32,
  uWidthOffset: f32,
  uWidthRange: f32,
  uBrushColor: vec4<f32>,
  uBgColor: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;
@group(0) @binding(1) var curveTex: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vUV: vec2<f32>,
};

@vertex
fn vs(@location(0) position: vec3<f32>, @location(1) uv: vec2<f32>) -> VsOut {
  var o: VsOut;
  o.vUV = uv;
  o.pos = u.uModel * vec4(position, 1.0);
  return o;
}

fn sampleCurve(i: i32) -> vec3<f32> {
  return textureLoad(curveTex, vec2<i32>(i, 0), 0).xyz;
}

// project p onto segment ab; returns (unsignedDist, t in [0,1], segLen)
fn segProject(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> vec3<f32> {
  let d = b - a;
  let L = max(length(d), 1e-6);
  let n = d / L;
  let t = clamp(dot(p - a, n), 0.0, L);
  let q = a + n * t;
  return vec3(length(p - q), t / L, L);
}

fn sdPolyline(p: vec2<f32>, n: i32) -> vec3<f32> {
  let STRIDE = 8;
  var coarseBest = 1e9;
  var coarseI = 0;
  for (var i = 0; i < 32; i = i + 1) {
    let idx = i * STRIDE;
    if (idx >= n) { break; }
    let d = length(p - sampleCurve(idx).xy);
    if (d < coarseBest) { coarseBest = d; coarseI = idx; }
  }
  var bestAbs = 1e9;
  var bestArc = 0.0;
  let flo = max(0, coarseI - STRIDE);
  let fhi = min(n - 1, coarseI + STRIDE);
  for (var i = 0; i < 16; i = i + 1) {
    let idx = flo + i;
    if (idx >= fhi) { break; }
    let a3 = sampleCurve(idx);
    let b3 = sampleCurve(idx + 1);
    let r = segProject(p, a3.xy, b3.xy);
    if (r.x < bestAbs) {
      bestAbs = r.x;
      bestArc = a3.z + r.y * r.z;
    }
  }
  return vec3(bestAbs, bestArc, 0.0);
}

fn curvePointAtArc(s: f32, n: i32) -> vec2<f32> {
  var lo = 0;
  var hi = n - 2;
  for (var i = 0; i < 9; i = i + 1) {
    if (lo >= hi) { break; }
    let mid = (lo + hi) / 2;
    if (sampleCurve(mid + 1).z < s) { lo = mid + 1; } else { hi = mid; }
  }
  let a = sampleCurve(lo);
  let b = sampleCurve(lo + 1);
  return mix(a.xy, b.xy, (s - a.z) / max(b.z - a.z, 1e-6));
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let p = vec2((in.vUV.x * 2.0 - 1.0) * u.uAspect, in.vUV.y * 2.0 - 1.0);

  let n = i32(u.curveLen + 0.5);
  if (n < 2) {
    return u.uBgColor;
  }

  let pr = sdPolyline(p, n);
  var sd = pr.x;
  var arc = pr.y;

  let startArc = u.uOffset * u.curveTotalLen;
  let endArc = startArc + u.uArcLength * u.curveTotalLen;
  let visibleLen = max(endArc - startArc, 1e-6);

  if (arc > endArc) {
    let ep = curvePointAtArc(endArc, n);
    sd = distance(p, ep);
    arc = endArc;
  }

  let t01 = clamp((endArc - arc) / visibleLen, 0.0, 1.0);

  let halfRange = max(u.uWidthRange, 1e-3) * 0.5;
  let widthCurve = smoothstep(u.uWidthOffset - halfRange, u.uWidthOffset + halfRange, t01);
  let w = u.uLineWidth * mix(1.0, clamp(u.uWidthEnd, 0.0, 1.0), widthCurve);
  let d = sd - w * 0.5;

  let aa = max(fwidth(d), 1e-6);
  var strokeA = smoothstep(aa, -aa, d);
  strokeA = strokeA * u.uOpacity * u.uBrushColor.a;

  let flowMul = mix(smoothstep(1.0, 0.0, t01), 1.0, clamp(u.uInkFlow, 0.0, 1.0));
  strokeA = strokeA * flowMul;

  let outA = strokeA + u.uBgColor.a * (1.0 - strokeA);
  let outRGB = (strokeA * u.uBrushColor.rgb + u.uBgColor.rgb * u.uBgColor.a * (1.0 - strokeA)) / max(outA, 1e-6);
  return vec4(outRGB, outA);
}
