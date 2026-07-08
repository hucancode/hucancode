// Uniform struct order MUST match the `uniforms` list in index.js.
struct Uni {
  uResolution: vec2<f32>,
  uBaseRadius: f32,
  uZoom: f32,
  uPan: vec2<f32>,
  uGridSize: f32,
  uShowGrid: i32,
  uTime: f32,   // playhead; edit view passes +inf (1e9) = everything revealed
  uNSeg: i32,
};
@group(0) @binding(0) var<uniform> u: Uni;
@group(0) @binding(1) var uSegTex: texture_2d<f32>;

const SAMPLES: i32 = 10;
const MIN_PRESS: f32 = 0.0;
const GRAIN: f32 = 0.05;
const VIGNETTE: f32 = 0.5;

const PAPER_COLOR = vec3<f32>(1.000, 0.988, 0.878);
const INK_COLOR   = vec3<f32>(0.067, 0.067, 0.067);
const GRID_COLOR  = vec4<f32>(0.784, 0.235, 0.235, 0.25);

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

fn seg(col: i32, row: i32) -> vec4<f32> { return textureLoad(uSegTex, vec2<i32>(col, row), 0); }

fn bez(p1: vec2<f32>, c: vec2<f32>, p2: vec2<f32>, t: f32) -> vec2<f32> {
  let uu = 1.0 - t;
  return uu * uu * uu * p1 + (3.0 * uu * uu * t + 3.0 * uu * t * t) * c + t * t * t * p2;
}

// Pressure at arc progress s: quad value curve through (belly,k), endpoints
// (0,A),(1,B). Linear segs are baked as belly=0.5, k=(A+B)/2, which reduces
// this exactly to mix(A, B, s) — no branch needed.
fn pressureAt(A: f32, B: f32, k: f32, s: f32, bellyX: f32) -> f32 {
  let cx = clamp(bellyX, 0.0, 1.0);
  let a = 1.0 - 2.0 * cx;
  let b = 2.0 * cx;
  let c = -s;
  var t: f32;
  if (abs(a) < 1e-6) {
    t = select(s, -c / b, b > 1e-6);
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

fn sdCapsule(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, ra: f32, rb: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-12), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

// 米 grid coverage. The grid is symmetric in both axes, so fold into the
// first quadrant: the 8 line segments collapse to 3 distances — square
// border, axis cross, and diagonals (cross/diag penalized past the border
// so they don't extend outside the square).
fn komeGrid(w: vec2<f32>, aa: f32, side: f32) -> f32 {
  let hw = side * 0.5;
  let a = abs(w);
  let m = max(a.x, a.y);
  let outside = max(m - hw, 0.0);
  let border = abs(m - hw);
  let cross = min(a.x, a.y) + outside;
  let diag = abs(a.x - a.y) * 0.7071068 + outside;
  let d = min(border, min(cross, diag));
  let lw = aa * 0.9;
  return 1.0 - smoothstep(lw - aa, lw + aa, d);
}

fn grainNoise(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) * 2.0 - 1.0;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let frag = in.vUV * u.uResolution;
  let wv = (2.0 * frag - u.uResolution) / u.uResolution.y;
  let w = wv / u.uZoom + u.uPan;

  let px = (2.0 / u.uResolution.y) / u.uZoom;
  let aa = 1.5 * px;

  var col = PAPER_COLOR;
  if (u.uShowGrid == 1) {
    let g = komeGrid(w, aa, u.uGridSize);
    col = mix(col, GRID_COLOR.rgb, g * GRID_COLOR.a);
  }

  var dmin = 1e9;
  for (var i = 0; i < u.uNSeg; i = i + 1) {
    let H = seg(0, i);                                   // center.xy, hullR, t0
    if (u.uTime <= H.w) { continue; }
    if (length(w - H.xy) - H.z - u.uBaseRadius > aa) { continue; }

    let A = seg(1, i);                                   // p1.xy, p2.xy
    let B = seg(2, i);                                   // ctrl.xy, pr1, pr2
    let Cc = seg(3, i);                                  // k, belly, dur
    let D = seg(4, i);                                   // v0, v1
    let p1 = A.xy;
    let p2 = A.zw;
    let c = B.xy;
    let pa = B.z;
    let pb = B.w;

    let tp = clamp((u.uTime - H.w) / max(Cc.z, 1e-6), 0.0, 1.0);
    let r = revealArc(tp, D.x, D.y);

    var prevPos = p1;
    var prevRad = u.uBaseRadius * max(MIN_PRESS, pa);
    for (var k = 1; k <= SAMPLES; k = k + 1) {
      let t = (f32(k) / f32(SAMPLES)) * r;
      let pr = pressureAt(pa, pb, Cc.x, t, Cc.y);
      let pos = bez(p1, c, p2, t);
      let rad = u.uBaseRadius * max(MIN_PRESS, pr);
      dmin = min(dmin, sdCapsule(w, prevPos, pos, prevRad, rad));
      prevPos = pos;
      prevRad = rad;
    }
  }

  let ink = smoothstep(aa, -aa, dmin);
  col = mix(col, INK_COLOR, ink);

  let n = grainNoise(frag) * GRAIN;
  col = col * (1.0 + n * (1.0 - 0.5 * ink));
  let uv = frag / u.uResolution;
  let vig = 1.0 - VIGNETTE * dot(uv - 0.5, uv - 0.5) * 2.0;
  col = col * vig;

  return vec4(col, 1.0);
}
