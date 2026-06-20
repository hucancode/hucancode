// Glyph SDF reveal, ink only. WGSL port of webgl/shaders/glyph.frag.glsl.
// Fullscreen triangle; samples the seg DATA TEXTURE (rgba32float, 4 texels/seg)
// via textureLoad. No y-flip: WebGPU's top-left frag origin + top-down texture
// storage cancel against the composite quad's sampling (see render/scene.js).

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

struct Seg {
  p1: vec2<f32>, p2: vec2<f32>, ctrl: vec2<f32>,
  pr1: f32, pr2: f32, k: f32, belly: f32, hasBelly: i32,
  t0: f32, dur: f32, v0: f32, v1: f32,
};

fn getSeg(i: i32) -> Seg {
  let a = textureLoad(segTex, vec2<i32>(0, i), 0);
  let b = textureLoad(segTex, vec2<i32>(1, i), 0);
  let c = textureLoad(segTex, vec2<i32>(2, i), 0);
  let d = textureLoad(segTex, vec2<i32>(3, i), 0);
  var s: Seg;
  s.p1 = a.xy; s.p2 = a.zw;
  s.ctrl = b.xy; s.pr1 = b.z; s.pr2 = b.w;
  s.k = c.x; s.belly = c.y; s.hasBelly = i32(c.z + 0.5); s.t0 = c.w;
  s.dur = d.x; s.v0 = d.y; s.v1 = d.z;
  return s;
}

fn bez(p1: vec2<f32>, c: vec2<f32>, p2: vec2<f32>, t: f32) -> vec2<f32> {
  let uu = 1.0 - t;
  return uu * uu * uu * p1 + (3.0 * uu * uu * t + 3.0 * uu * t * t) * c + t * t * t * p2;
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

fn sdRoundedCone(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, r1: f32, r2: f32) -> f32 {
  let ba = b - a;
  let l2 = dot(ba, ba);
  if (l2 < 1e-12) { return length(p - a) - r1; }
  let rr = r1 - r2;
  let a2 = l2 - rr * rr;
  let il2 = 1.0 / l2;
  let pa = p - a;
  let y = dot(pa, ba);
  let z = y - l2;
  let xv = pa * l2 - ba * y;
  let x2 = dot(xv, xv);
  let y2 = y * y * l2;
  let z2 = z * z * l2;
  let k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) { return sqrt(x2 + z2) * il2 - r2; }
  if (sign(y) * a2 * y2 < k) { return sqrt(x2 + y2) * il2 - r1; }
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
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
    let s = getSeg(i);
    let p1 = s.p1;
    let p2 = s.p2;
    let c = s.ctrl;
    let pa = s.pr1;
    let pb = s.pr2;

    let tp = clamp((time - s.t0) / s.dur, 0.0, 1.0);
    if (tp <= 0.0) { continue; }
    let r = revealArc(tp, s.v0, s.v1);

    let cen = (p1 + p2) * 0.5;
    let hullR = max(length(p1 - cen), length(c - cen));
    if (length(w - cen) - hullR - baseRadius > aa) { continue; }

    var prevPos = bez(p1, c, p2, 0.0);
    var prevRad = baseRadius * max(MIN_PRESS, pa);
    for (var kk = 1; kk <= SAMPLES; kk = kk + 1) {
      let t = (f32(kk) / f32(SAMPLES)) * r;
      var pr: f32;
      if (s.hasBelly == 1) {
        pr = pressureAt(pa, pb, s.k, t, s.belly);
      } else {
        pr = mix(pa, pb, t);
      }
      let pos = bez(p1, c, p2, t);
      let rad = baseRadius * max(MIN_PRESS, pr);
      dmin = min(dmin, sdRoundedCone(w, prevPos, pos, prevRad, rad));
      prevPos = pos;
      prevRad = rad;
    }
  }

  let ink = smoothstep(aa, -aa, dmin);
  return vec4(inkColor, ink);
}
