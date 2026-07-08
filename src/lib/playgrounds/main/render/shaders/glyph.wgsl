// Glyph SDF reveal, ink only.
// Samples the seg DATA TEXTURE (rgba32float, 5 texels/seg, texel 0 = header:
// cen.xy, hullR, t0) via textureLoad. Glyph-space coords come from the quad
// UV, so both backends map identically (no y-flip juggling).

struct Uni {
  uViewProj: mat4x4<f32>,
  uOpacity: f32,
  uAspect: f32,
  uZ: f32,
  uStationY: f32,
  uExt: f32,
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

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vUV: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> VsOut {
  var C = array<vec2<f32>, 4>(vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0));
  let c = C[vid];
  var o: VsOut;
  o.vUV = c;
  let world = vec3((c.x * 2.0 - 1.0) * u.uAspect * u.uExt, (c.y * 2.0 - 1.0) * u.uExt + u.uStationY, u.uZ);
  o.pos = u.uViewProj * vec4(world, 1.0);
  return o;
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
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let res = u.uResolution;
  let baseRadius = u.uBaseRadius;
  let time = u.uTime;
  let nSeg = u.uNSeg;
  let inkColor = u.uInkColor;

  // quad-local UV -> glyph-space coords (x in [-aspect,aspect], y in [-1,1], both * ext)
  let w = vec2((in.vUV.x * 2.0 - 1.0) * u.uAspect, in.vUV.y * 2.0 - 1.0) * u.uExt;
  let px = 2.0 / res.y;
  let aa = 1.5 * px;

  var dmin = 1e9;
  for (var i = 0; i < nSeg; i = i + 1) {
    if (dmin < -aa) { break; } // fragment already fully inside ink

    let hdr = textureLoad(segTex, vec2<i32>(0, i), 0); // cen.xy, hullR, t0
    if (time <= hdr.w) { continue; }
    if (length(w - hdr.xy) - hdr.z - baseRadius > aa) { continue; }

    let a = textureLoad(segTex, vec2<i32>(1, i), 0); // p1.xy, p2.xy
    let b = textureLoad(segTex, vec2<i32>(2, i), 0); // ctrl.xy, pr1, pr2
    let c = textureLoad(segTex, vec2<i32>(3, i), 0); // k, belly, dur
    let d = textureLoad(segTex, vec2<i32>(4, i), 0); // v0, v1
    let p1 = a.xy;
    let p2 = a.zw;
    let ctrl = b.xy;
    let pa = b.z;
    let pb = b.w;

    let tp = clamp((time - hdr.w) / c.z, 0.0, 1.0);
    let r = revealArc(tp, d.x, d.y);

    // Horner coeffs of the cubic bezier (both inner controls at ctrl)
    let b1 = 3.0 * (ctrl - p1);
    let b2 = 3.0 * (p1 - ctrl);
    let b3 = p2 - p1;

    var prevPos = p1;
    var prevRad = baseRadius * max(MIN_PRESS, pa);
    for (var kk = 1; kk <= SAMPLES; kk = kk + 1) {
      let t = (f32(kk) / f32(SAMPLES)) * r;
      // linear segs bake belly=0.5, k=(A+B)/2 -> pressureAt degenerates to mix
      let pr = pressureAt(pa, pb, c.x, t, c.y);
      let pos = ((b3 * t + b2) * t + b1) * t + p1;
      let rad = baseRadius * max(MIN_PRESS, pr);
      dmin = min(dmin, sdCone(w, prevPos, pos, prevRad, rad));
      prevPos = pos;
      prevRad = rad;
    }
  }

  let ink = smoothstep(aa, -aa, dmin);
  return vec4(inkColor, ink * u.uOpacity);
}
