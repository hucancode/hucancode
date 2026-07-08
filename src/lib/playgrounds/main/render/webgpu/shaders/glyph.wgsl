// Glyph SDF reveal, ink only. WGSL port of webgl/shaders/glyph.frag.glsl.
// Fullscreen triangle; samples the seg DATA TEXTURE (rgba32float, 5 texels/seg,
// texel 0 = header: cen.xy, hullR, t0) via textureLoad. No y-flip: WebGPU's
// top-left frag origin + top-down texture storage cancel against the composite
// quad's sampling (see render/scene.js).

struct Uni {
  uResolution: vec2<f32>,
  uBaseRadius: f32,
  uTime: f32,
  uNSeg: i32,
  uInkColor: vec3<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;
@group(0) @binding(1) var segTex: texture_2d<f32>;

const SAMPLES: i32 = 10;
const MIN_PRESS: f32 = 0.0;

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
  var P = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  return vec4(P[vid], 0.0, 1.0);
}

fn sdCone(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, r1: f32, r2: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-12), 0.0, 1.0);
  return length(pa - ba * h) - mix(r1, r2, h);
}

fn pressureAt(A: f32, B: f32, k: f32, s: f32, bellyX: f32) -> f32 {
  let cx = clamp(bellyX, 0.0, 1.0);
  let a = 1.0 - 2.0 * cx;
  let b = 2.0 * cx;
  let c = -s;
  var t: f32;
  if (abs(a) < 1e-6) {
    if (b > 1e-6) { t = -c / b; } else { t = s; }
  } else {
    let disc = max(0.0, b * b - 4.0 * a * c);
    t = (-b + sqrt(disc)) / (2.0 * a);
  }
  t = clamp(t, 0.0, 1.0);
  let uu = 1.0 - t;
  return uu * uu * A + 2.0 * uu * t * k + t * t * B;
}

fn revealArc(tp: f32, v0: f32, v1: f32) -> f32 {
  let dv = v1 - v0;
  if (abs(dv) < 1e-5) { return clamp(tp, 0.0, 1.0); }
  let ratio = v1 / v0;
  return clamp(v0 * (pow(ratio, tp) - 1.0) / dv, 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) fc: vec4<f32>) -> @location(0) vec4<f32> {
  let res = u.uResolution;
  let baseRadius = u.uBaseRadius;
  let time = u.uTime;
  let nSeg = u.uNSeg;
  let inkColor = u.uInkColor;

  let frag = fc.xy;
  let w = (2.0 * frag - res) / res.y;
  let px = 2.0 / res.y;
  let aa = 1.5 * px;

  var dmin = 1e9;
  for (var i = 0; i < nSeg; i = i + 1) {
    if (dmin < -aa) { break; } // fragment already fully inside ink

    // header texel: cull on time + hull with 1 load before loading the rest
    let hdr = textureLoad(segTex, vec2<i32>(0, i), 0); // cen.xy, hullR, t0
    if (time <= hdr.w) { continue; }
    if (length(w - hdr.xy) - hdr.z - baseRadius > aa) { continue; }

    let a = textureLoad(segTex, vec2<i32>(1, i), 0); // p1.xy, p2.xy
    let b = textureLoad(segTex, vec2<i32>(2, i), 0); // ctrl.xy, pr1, pr2
    let c = textureLoad(segTex, vec2<i32>(3, i), 0); // k, belly, hasBelly, dur
    let d = textureLoad(segTex, vec2<i32>(4, i), 0); // v0, v1
    let p1 = a.xy;
    let p2 = a.zw;
    let ctrl = b.xy;
    let pa = b.z;
    let pb = b.w;
    let hasBelly = c.z > 0.5;

    let tp = clamp((time - hdr.w) / c.w, 0.0, 1.0);
    let r = revealArc(tp, d.x, d.y);

    // bezier as a Horner polynomial: coeffs once per seg, 3 fma per sample
    // (curve is a cubic with both inner controls at ctrl)
    let b1 = 3.0 * (ctrl - p1);
    let b2 = 3.0 * (p1 - ctrl);
    let b3 = p2 - p1;

    var prevPos = p1;
    var prevRad = baseRadius * max(MIN_PRESS, pa);
    for (var kk = 1; kk <= SAMPLES; kk = kk + 1) {
      let t = (f32(kk) / f32(SAMPLES)) * r;
      var pr: f32;
      if (hasBelly) {
        pr = pressureAt(pa, pb, c.x, t, c.y);
      } else {
        pr = mix(pa, pb, t);
      }
      let pos = ((b3 * t + b2) * t + b1) * t + p1;
      let rad = baseRadius * max(MIN_PRESS, pr);
      dmin = min(dmin, sdCone(w, prevPos, pos, prevRad, rad));
      prevPos = pos;
      prevRad = rad;
    }
  }

  let ink = smoothstep(aa, -aa, dmin);
  return vec4(inkColor, ink);
}
