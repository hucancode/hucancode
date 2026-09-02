// GPU RAY TRACER (raster fullscreen pass). The BVH and per-instance records are
// packed into DATA TEXTURES so the tracer runs on WebGPU and WebGL2 alike (no
// compute, no storage buffers/textures). BVH node refs stay rgba32f (indices
// must be exact); node child boxes are rgba16f (see scene.js for the layout
// and why both children's boxes live in the parent).

struct Params {
  camOrigin: vec3<f32>,
  camFwd: vec3<f32>,
  camRight: vec3<f32>,
  camUp: vec3<f32>,
  lightDir: vec3<f32>,
  tanHalf: f32,
  aspect: f32,
  softness: f32,
  reset: f32,
  raycount: i32,
  sampleBase: i32,
  frameNo: i32,
  width: i32,
  height: i32,
  root: i32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var bvhTex: texture_2d<f32>;      // node refs, 1 texel/node (rgba32f, exact ints)
@group(0) @binding(2) var bvhBoxTex: texture_2d<f32>;   // node child boxes, 3 texels/node (rgba16f)
@group(0) @binding(3) var instTex: texture_2d<f32>;
@group(0) @binding(4) var accPrev: texture_2d<f32>;

const EPS = 1e-5;      // world-distance epsilon for a hit
const PAR = 1e-9;      // near-parallel guard for planar faces
const INF = 1e30;

// lighting / sky palette (linear)
const LIGHT_COLOR = vec3<f32>(1.35, 1.25, 1.05);
const AMB_SKY = vec3<f32>(0.55, 0.60, 0.72);
const AMB_GROUND = vec3<f32>(0.28, 0.26, 0.24);
const SUN_GLOW = vec3<f32>(1.5, 1.15, 0.7);
const ZENITH = vec3<f32>(0.14, 0.20, 0.33);
const HORIZON = vec3<f32>(0.52, 0.56, 0.66);
const SHADOW_EPS = 1e-3;

// material types (must match MAT in src/lib/raytrace/scene.js)
const MAT_LAMBERTIAN = 0;
const MAT_METAL = 1;
const MAT_DIELECTRIC = 2;
const MAX_DEPTH = 4;

struct Hit {
  t: f32,
  n: vec3<f32>,
};

struct TraceResult {
  t: f32,
  kind: i32,   // -2 sky, -1 ground plane, >=0 instance index
  n: vec3<f32>,
};

// fast integer hash mixing pixel coords + frame index, for per-pixel decorrelation
fn hash3(x: i32, y: i32, z: i32) -> u32 {
  var n = (u32(x) * 73856093u) ^ (u32(y) * 19349663u) ^ (u32(z) * 83492791u);
  n = (n ^ (n >> 16u)) * 0x45d9f3bu;
  n = (n ^ (n >> 16u)) * 0x45d9f3bu;
  return n ^ (n >> 16u);
}

// radical-inverse Halton sample in base b — low-discrepancy per-pixel jitter
fn halton(i: i32, b: i32) -> f32 {
  var f = 1.0;
  var r = 0.0;
  var n = i;
  while (n > 0) {
    f = f / f32(b);
    r = r + f * f32(n % b);
    n = n / b;
  }
  return r;
}

// one of 64 golden-spiral directions on the area-light cone around lightDir
fn areaLightDir(k: i32) -> vec3<f32> {
  let ld = params.lightDir;
  var up = vec3<f32>(0.0, 1.0, 0.0);
  if (abs(ld.y) > 0.99) { up = vec3<f32>(1.0, 0.0, 0.0); }
  let t1 = normalize(cross(ld, up));
  let t2 = cross(ld, t1);
  let r = sqrt((f32(k) + 0.5) / 64.0);
  let a = f32(k) * 2.399963229728653;
  let ca = cos(a) * r * params.softness;
  let cb = sin(a) * r * params.softness;
  return normalize(ld + t1 * ca + t2 * cb);
}

// instance data texture layout (width=8, one row per instance):
//   texel 0 = (kind, p0, p1, p2)         texel 1 = (p3, IM0, IM1, IM2)
//   texel 2 = (IM3, IM4, IM5, IM6)       texel 3 = (IM7, IM8, IMT0, IMT1)
//   texel 4 = (IMT2, IMT3, IMT4, IMT5)   texel 5 = (IMT6, IMT7, IMT8, IinvT.x)
//   texel 6 = (IinvT.y, IinvT.z, cr, cg) texel 7 = (cb, mat, matParam, pad)
fn instT(i: i32, t: i32) -> vec4<f32> { return textureLoad(instTex, vec2<i32>(t, i), 0); }

// row-major inverse matrix (IM) times a vector — t1,t2,t3 are instT(i,1..3),
// passed in so a leaf visit fetches each texel once instead of once per call
fn matMulV(t1: vec4<f32>, t2: vec4<f32>, t3: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    t1.y * v.x + t1.z * v.y + t1.w * v.z,
    t2.x * v.x + t2.y * v.y + t2.z * v.z,
    t2.w * v.x + t3.x * v.y + t3.y * v.z,
  );
}

// row-major inverse-transpose matrix (IMT) times a vector — t3,t4,t5 are instT(i,3..5)
fn matMulNormal(t3: vec4<f32>, t4: vec4<f32>, t5: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    t3.z * v.x + t3.w * v.y + t4.x * v.z,
    t4.y * v.x + t4.z * v.y + t4.w * v.z,
    t5.x * v.x + t5.y * v.y + t5.z * v.z,
  );
}

// ---- shared analytic solvers ------------------------------------------------
// The 10 primitive kinds boil down to two quadric families sharing the Y axis:
// a "cone" x^2+z^2=(1+k*y)^2 (k=0 is a plain cylinder wall) and a sphere shell
// |p|=r, plus axis-aligned planar caps. Routing every kind through ONE solver
// per family means a ray runs the identical instruction stream no matter which
// of those kinds it actually hit — only the coefficients (radius, k, y-range,
// quadrant mask) differ — which keeps SIMD lanes inside a BVH leaf in lockstep
// instead of diverging over a 10-way shape switch. Only the box (curved-top
// slab) doesn't fit either family and stays bespoke below.

// nearest/farthest real root of a*t^2 + 2*hb*t + c = 0 (half-b form: fewer
// multiplies than the textbook b/4ac form), ordered near-first regardless of
// sign(a). (INF, INF) if no real root.
fn quadRoots(a: f32, hb: f32, c: f32) -> vec2<f32> {
  let disc = hb * hb - a * c;
  if (disc < 0.0) { return vec2<f32>(INF, INF); }
  let sq = sqrt(disc);
  let inva = 1.0 / a;
  let r0 = (-hb - sq) * inva;
  let r1 = (-hb + sq) * inva;
  return vec2<f32>(min(r0, r1), max(r0, r1));
}

// radial wall x^2+z^2=r2 (axis Y), near/far ordered. (INF, INF) if the ray is
// ~parallel to the axis (no wall crossing possible).
fn cylRoots(o: vec3<f32>, d: vec3<f32>, r2: f32) -> vec2<f32> {
  let a = d.x * d.x + d.z * d.z;
  if (a <= PAR) { return vec2<f32>(INF, INF); }
  return quadRoots(a, o.x * d.x + o.z * d.z, o.x * o.x + o.z * o.z - r2);
}

// keep the closer of two candidates — the single join point every shape
// funnels through, so every kind pays the same cost to pick its hit.
fn tryCand(t: f32, cn: vec3<f32>, best: ptr<function, f32>, n: ptr<function, vec3<f32>>) {
  if (t > EPS && t < *best) { *best = t; *n = cn; }
}

// one radial wall test: near root first, far root only tried if the near one
// misses its y-range/quadrant (mx/mz: 0 disables that quadrant constraint).
// nsign flips the outward normal (an inner cavity wall, e.g. gear's hole).
fn wallHit(o: vec3<f32>, d: vec3<f32>, r2: f32, ylo: f32, yhi: f32, mx: f32, mz: f32, nsign: f32, best: ptr<function, f32>, n: ptr<function, vec3<f32>>) {
  let r = cylRoots(o, d, r2);
  if (r.x >= INF) { return; }
  for (var i = 0; i < 2; i = i + 1) {
    let t = select(r.y, r.x, i == 0);
    let x = o.x + d.x * t; let y = o.y + d.y * t; let z = o.z + d.z * t;
    if (y >= ylo && y <= yhi && (mx <= 0.0 || x >= 0.0) && (mz <= 0.0 || z >= 0.0)) {
      tryCand(t, vec3<f32>(x * nsign, 0.0, z * nsign), best, n);
      return;
    }
  }
}

// one spherical shell test (radius^2 = r2), y-clamped, near root first.
fn sphereHit(o: vec3<f32>, d: vec3<f32>, a: f32, hb: f32, r2: f32, ylo: f32, yhi: f32, flip: f32, best: ptr<function, f32>, n: ptr<function, vec3<f32>>) {
  let rt = quadRoots(a, hb, o.x * o.x + o.y * o.y + o.z * o.z - r2);
  if (rt.x >= INF) { return; }
  for (var i = 0; i < 2; i = i + 1) {
    let t = select(rt.y, rt.x, i == 0);
    let y = o.y + d.y * t;
    if (y >= ylo && y <= yhi) {
      tryCand(t, vec3<f32>((o.x + d.x * t) * flip, y * flip, (o.z + d.z * t) * flip), best, n);
      return;
    }
  }
}

// axis-aligned annular cap at y=py, ri2 <= x^2+z^2 <= ro2, optional quadrant mask.
fn capHit(o: vec3<f32>, d: vec3<f32>, py: f32, ri2: f32, ro2: f32, mx: f32, mz: f32, nsign: f32, best: ptr<function, f32>, n: ptr<function, vec3<f32>>) {
  if (abs(d.y) <= PAR) { return; }
  let t = (py - o.y) / d.y;
  let x = o.x + d.x * t; let z = o.z + d.z * t; let r2 = x * x + z * z;
  if (r2 >= ri2 && r2 <= ro2 && (mx <= 0.0 || x >= 0.0) && (mz <= 0.0 || z >= 0.0)) {
    tryCand(t, vec3<f32>(0.0, nsign, 0.0), best, n);
  }
}

// axis-aligned rectangular quad on plane z=pz, x in [xlo,xhi], y in [ylo,yhi].
fn zPlaneHit(o: vec3<f32>, d: vec3<f32>, pz: f32, xlo: f32, xhi: f32, ylo: f32, yhi: f32, cn: vec3<f32>, best: ptr<function, f32>, n: ptr<function, vec3<f32>>) {
  if (abs(d.z) <= PAR) { return; }
  let t = (pz - o.z) / d.z;
  let x = o.x + d.x * t; let y = o.y + d.y * t;
  if (x >= xlo && x <= xhi && y >= ylo && y <= yhi) { tryCand(t, cn, best, n); }
}

// axis-aligned rectangular quad on plane x=px, y in [ylo,yhi], z in [zlo,zhi].
fn xPlaneHit(o: vec3<f32>, d: vec3<f32>, px: f32, ylo: f32, yhi: f32, zlo: f32, zhi: f32, cn: vec3<f32>, best: ptr<function, f32>, n: ptr<function, vec3<f32>>) {
  if (abs(d.x) <= PAR) { return; }
  let t = (px - o.x) / d.x;
  let y = o.y + d.y * t; let z = o.z + d.z * t;
  if (y >= ylo && y <= yhi && z >= zlo && z <= zhi) { tryCand(t, cn, best, n); }
}

// nearest positive intersection with one analytic primitive in unit space
fn intersectShape(kind: i32, p0: f32, p1: f32, p2: f32, p3: f32, o: vec3<f32>, d: vec3<f32>) -> Hit {
  var best = INF;
  var n = vec3<f32>(0.0, 1.0, 0.0);

  if (kind == 0) {
    // box (sloped/curved top surface y = A + Bc*z + Cc*z*z)
    let s = p0; let k = p1;
    let A = 0.5 - 0.5 * s + 0.25 * s * k;
    let Bc = -s; let Cc = -s * k;
    if (abs(d.x) > PAR) {
      var t = (0.5 - o.x) / d.x;
      var y = o.y + d.y * t; var z = o.z + d.z * t;
      if (y >= -0.5 && y <= A + Bc * z + Cc * z * z && z >= -0.5 && z <= 0.5) {
        tryCand(t, vec3<f32>(1.0, 0.0, 0.0), &best, &n);
      }
      t = (-0.5 - o.x) / d.x;
      y = o.y + d.y * t; z = o.z + d.z * t;
      if (y >= -0.5 && y <= A + Bc * z + Cc * z * z && z >= -0.5 && z <= 0.5) {
        tryCand(t, vec3<f32>(-1.0, 0.0, 0.0), &best, &n);
      }
    }
    if (abs(d.y) > PAR) {
      let t = (-0.5 - o.y) / d.y;
      let x = o.x + d.x * t; let z = o.z + d.z * t;
      if (x >= -0.5 && x <= 0.5 && z >= -0.5 && z <= 0.5) {
        tryCand(t, vec3<f32>(0.0, -1.0, 0.0), &best, &n);
      }
    }
    if (abs(d.z) > PAR) {
      var t = (-0.5 - o.z) / d.z;
      var x = o.x + d.x * t; var y = o.y + d.y * t;
      if (x >= -0.5 && x <= 0.5 && y >= -0.5 && y <= A + Bc * (-0.5) + Cc * 0.25) {
        tryCand(t, vec3<f32>(0.0, 0.0, -1.0), &best, &n);
      }
      t = (0.5 - o.z) / d.z;
      x = o.x + d.x * t; y = o.y + d.y * t;
      if (x >= -0.5 && x <= 0.5 && y >= -0.5 && y <= A + Bc * 0.5 + Cc * 0.25) {
        tryCand(t, vec3<f32>(0.0, 0.0, 1.0), &best, &n);
      }
    }
    // top quadric in z, extruded along x: Q*t^2 + P*t + R = 0 fits the shared
    // half-b solver directly with hb = P/2
    let Q = Cc * d.z * d.z;
    let P = Bc * d.z + 2.0 * Cc * o.z * d.z - d.y;
    let R = A + Bc * o.z + Cc * o.z * o.z - o.y;
    if (abs(Q) < PAR) {
      if (abs(P) > PAR) {
        let t = -R / P;
        let x = o.x + d.x * t; let z = o.z + d.z * t;
        if (x >= -0.5 && x <= 0.5 && z >= -0.5 && z <= 0.5 && (o.y + d.y * t) >= -0.5) {
          let nz = -(Bc + 2.0 * Cc * z);
          let il = 1.0 / length(vec2<f32>(1.0, nz));
          tryCand(t, vec3<f32>(0.0, il, nz * il), &best, &n);
        }
      }
    } else {
      let rt = quadRoots(Q, P * 0.5, R);
      if (rt.x < INF) {
        for (var i = 0; i < 2; i = i + 1) {
          let t = select(rt.y, rt.x, i == 0);
          let x = o.x + d.x * t; let z = o.z + d.z * t;
          if (x >= -0.5 && x <= 0.5 && z >= -0.5 && z <= 0.5 && (o.y + d.y * t) >= -0.5) {
            let nz = -(Bc + 2.0 * Cc * z);
            let il = 1.0 / length(vec2<f32>(1.0, nz));
            tryCand(t, vec3<f32>(0.0, il, nz * il), &best, &n);
            break;
          }
        }
      }
    }
  }

  else if (kind == 1) {
    // cylinder r=1, y 0..1
    wallHit(o, d, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, &best, &n);
    capHit(o, d, 0.0, 0.0, 1.0, 0.0, 0.0, -1.0, &best, &n);
    capHit(o, d, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, &best, &n);
  }

  else if (kind == 2) {
    // coneCut base r=1 at y=0 -> top r=p0 at y=1 (radius = 1 + k*y, k = p0-1)
    let k = p0 - 1.0;
    let a = d.x * d.x + d.z * d.z - k * k * d.y * d.y;
    let hb = (o.x * d.x + o.z * d.z) - k * d.y * (1.0 + k * o.y);
    let c = o.x * o.x + o.z * o.z - (1.0 + k * o.y) * (1.0 + k * o.y);
    if (abs(a) > PAR) {
      let rt = quadRoots(a, hb, c);
      if (rt.x < INF) {
        for (var i = 0; i < 2; i = i + 1) {
          let t = select(rt.y, rt.x, i == 0);
          let y = o.y + d.y * t;
          if (y >= 0.0 && y <= 1.0) {
            let nx = o.x + d.x * t; let nz = o.z + d.z * t;
            let ny = -k * (1.0 + k * y);
            let il = 1.0 / length(vec3<f32>(nx, ny, nz));
            tryCand(t, vec3<f32>(nx * il, ny * il, nz * il), &best, &n);
            break;
          }
        }
      }
    } else if (abs(hb) > PAR) {
      // a≈0: quadratic degenerates to linear (2*hb*t + c = 0)
      let t = -c / (2.0 * hb);
      let y = o.y + d.y * t;
      if (y >= 0.0 && y <= 1.0) {
        let nx = o.x + d.x * t; let nz = o.z + d.z * t;
        let ny = -k * (1.0 + k * y);
        let il = 1.0 / length(vec3<f32>(nx, ny, nz));
        tryCand(t, vec3<f32>(nx * il, ny * il, nz * il), &best, &n);
      }
    }
    capHit(o, d, 0.0, 0.0, 1.0, 0.0, 0.0, -1.0, &best, &n);
    capHit(o, d, 1.0, 0.0, p0 * p0, 0.0, 0.0, 1.0, &best, &n);
  }

  else if (kind == 3) {
    // sphere r=1
    let a = d.x * d.x + d.y * d.y + d.z * d.z;
    let hb = o.x * d.x + o.y * d.y + o.z * d.z;
    sphereHit(o, d, a, hb, 1.0, -INF, INF, 1.0, &best, &n);
  }

  else if (kind == 4) {
    // hemisphere r=1, dome up (+Y)
    let a = d.x * d.x + d.y * d.y + d.z * d.z;
    let hb = o.x * d.x + o.y * d.y + o.z * d.z;
    sphereHit(o, d, a, hb, 1.0, 0.0, INF, 1.0, &best, &n);
    capHit(o, d, 0.0, 0.0, 1.0, 0.0, 0.0, -1.0, &best, &n);
  }

  else if (kind == 5) {
    // cutHemisphere: hollow bowl, shell ri..1 over y 0..yc + lip + base ring
    let ri = p0; let yc = p1;
    let a = d.x * d.x + d.y * d.y + d.z * d.z;
    let hb = o.x * d.x + o.y * d.y + o.z * d.z;
    sphereHit(o, d, a, hb, 1.0, 0.0, yc, 1.0, &best, &n);
    sphereHit(o, d, a, hb, ri * ri, 0.0, yc, -1.0, &best, &n);
    // the lip is the shell's cross-section at the cut plane: each sphere's
    // radius^2 where it meets y=yc, not the y=0 ring radii
    let rr2 = max(0.0, ri * ri - yc * yc);
    let ro2 = max(0.0, 1.0 - yc * yc);
    capHit(o, d, yc, rr2, ro2, 0.0, 0.0, 1.0, &best, &n);
    capHit(o, d, 0.0, ri * ri, 1.0, 0.0, 0.0, -1.0, &best, &n);
  }

  else if (kind == 6) {
    // halfCylinder r=1, y 0..1, round side +Z, flat face z=0
    wallHit(o, d, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0, &best, &n);
    zPlaneHit(o, d, 0.0, -1.0, 1.0, 0.0, 1.0, vec3<f32>(0.0, 0.0, -1.0), &best, &n);
    capHit(o, d, 0.0, 0.0, 1.0, 0.0, 1.0, -1.0, &best, &n);
    capHit(o, d, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0, &best, &n);
  }

  else if (kind == 7) {
    // halfCylinderBox: halfCylinder + box tail to z=-dp
    let dp = p0;
    wallHit(o, d, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0, &best, &n);
    zPlaneHit(o, d, -dp, -1.0, 1.0, 0.0, 1.0, vec3<f32>(0.0, 0.0, -1.0), &best, &n);
    xPlaneHit(o, d, 1.0, 0.0, 1.0, -dp, 0.0, vec3<f32>(1.0, 0.0, 0.0), &best, &n);
    xPlaneHit(o, d, -1.0, 0.0, 1.0, -dp, 0.0, vec3<f32>(-1.0, 0.0, 0.0), &best, &n);
    // cap region is a union (round disk OR box strip) — doesn't fit the
    // simple ring+quadrant mask, so it stays a bespoke pair of tests
    if (abs(d.y) > PAR) {
      var t = -o.y / d.y;
      var x = o.x + d.x * t; var z = o.z + d.z * t;
      var inD = (x * x + z * z <= 1.0 && z >= 0.0) || (x >= -1.0 && x <= 1.0 && z >= -dp && z <= 0.0);
      if (inD) { tryCand(t, vec3<f32>(0.0, -1.0, 0.0), &best, &n); }
      t = (1.0 - o.y) / d.y;
      x = o.x + d.x * t; z = o.z + d.z * t;
      inD = (x * x + z * z <= 1.0 && z >= 0.0) || (x >= -1.0 && x <= 1.0 && z >= -dp && z <= 0.0);
      if (inD) { tryCand(t, vec3<f32>(0.0, 1.0, 0.0), &best, &n); }
    }
  }

  else if (kind == 8) {
    // quarterCylinder r=1, y 0..1, arc +X..+Z, corner origin
    wallHit(o, d, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, &best, &n);
    xPlaneHit(o, d, 0.0, 0.0, 1.0, 0.0, 1.0, vec3<f32>(-1.0, 0.0, 0.0), &best, &n);
    zPlaneHit(o, d, 0.0, 0.0, 1.0, 0.0, 1.0, vec3<f32>(0.0, 0.0, -1.0), &best, &n);
    capHit(o, d, 0.0, 0.0, 1.0, 1.0, 1.0, -1.0, &best, &n);
    capHit(o, d, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, &best, &n);
  }

  else if (kind == 9) {
    // gear: toothless annulus approximation (outer r=1, hole r=0.55)
    let ri = 0.55;
    wallHit(o, d, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, &best, &n);
    wallHit(o, d, ri * ri, 0.0, 1.0, 0.0, 0.0, -1.0, &best, &n);
    capHit(o, d, 0.0, ri * ri, 1.0, 0.0, 0.0, -1.0, &best, &n);
    capHit(o, d, 1.0, ri * ri, 1.0, 0.0, 0.0, 1.0, &best, &n);
  }

  return Hit(best, n);
}

// ray/AABB slab entry distance (INF = miss), with precomputed inverse direction
fn slabEntry(o: vec3<f32>, d: vec3<f32>, invD: vec3<f32>, mn: vec3<f32>, mx: vec3<f32>) -> f32 {
  var t0 = 0.0;
  var t1 = INF;
  if (d.x != 0.0) {
    let a = (mn.x - o.x) * invD.x;
    let b = (mx.x - o.x) * invD.x;
    t0 = max(t0, min(a, b));
    t1 = min(t1, max(a, b));
    if (t0 > t1) { return INF; }
  } else if (o.x < mn.x || o.x > mx.x) { return INF; }
  if (d.y != 0.0) {
    let a = (mn.y - o.y) * invD.y;
    let b = (mx.y - o.y) * invD.y;
    t0 = max(t0, min(a, b));
    t1 = min(t1, max(a, b));
    if (t0 > t1) { return INF; }
  } else if (o.y < mn.y || o.y > mx.y) { return INF; }
  if (d.z != 0.0) {
    let a = (mn.z - o.z) * invD.z;
    let b = (mx.z - o.z) * invD.z;
    t0 = max(t0, min(a, b));
    t1 = min(t1, max(a, b));
    if (t0 > t1) { return INF; }
  } else if (o.z < mn.z || o.z > mx.z) { return INF; }
  return t0;
}

// nearest hit along the PRIMARY ray (ordered near-first traversal + best pruning)
fn tracePrimary(o: vec3<f32>, d: vec3<f32>) -> TraceResult {
  let invD = vec3<f32>(
    select(0.0, 1.0 / d.x, d.x != 0.0),
    select(0.0, 1.0 / d.y, d.y != 0.0),
    select(0.0, 1.0 / d.z, d.z != 0.0),
  );
  var best = INF;
  var kind = -2;
  var n = vec3<f32>(0.0, 1.0, 0.0);

  var stack = array<i32, 128>();
  var sp = 0;
  if (params.root != -1) { stack[0] = params.root; sp = 1; }
  while (sp > 0) {
    sp = sp - 1;
    let nref = stack[sp];
    if (nref < 0) {
      // leaf, encoded inline in the parent — no bvhTex fetch needed
      let i = -nref - 2;
      let t0 = instT(i, 0);
      let t1 = instT(i, 1);
      let t2 = instT(i, 2);
      let t3 = instT(i, 3);
      let t4 = instT(i, 4);
      let t5 = instT(i, 5);
      let t6 = instT(i, 6);
      let kkind = i32(t0.x);
      let p0 = t0.y; let p1 = t0.z; let p2 = t0.w; let p3 = t1.x;
      let lo = matMulV(t1, t2, t3, o) + vec3<f32>(t5.w, t6.x, t6.y);
      let ld = matMulV(t1, t2, t3, d);
      let h = intersectShape(kkind, p0, p1, p2, p3, lo, ld);
      if (h.t < best) {
        best = h.t; kind = i;
        n = normalize(matMulNormal(t3, t4, t5, h.n));
      }
    } else {
      // internal node: both children's refs + boxes live right here, in one
      // non-dependent fetch — no follow-up load to learn either child's box
      let node = nref;
      let rf = textureLoad(bvhTex, vec2<i32>(0, node), 0);
      let b0 = textureLoad(bvhBoxTex, vec2<i32>(0, node), 0);
      let b1 = textureLoad(bvhBoxTex, vec2<i32>(1, node), 0);
      let b2 = textureLoad(bvhBoxTex, vec2<i32>(2, node), 0);
      let leftRef = i32(rf.x);
      let rightRef = i32(rf.y);
      let lmn = vec3<f32>(b0.x, b0.y, b0.z);
      let lmx = vec3<f32>(b0.w, b1.x, b1.y);
      let rmn = vec3<f32>(b1.z, b1.w, b2.x);
      let rmx = vec3<f32>(b2.y, b2.z, b2.w);
      let tl = slabEntry(o, d, invD, lmn, lmx);
      let tr = slabEntry(o, d, invD, rmn, rmx);
      if (tl <= tr) {
        if (tr < best) { stack[sp] = rightRef; sp = sp + 1; }
        if (tl < best) { stack[sp] = leftRef; sp = sp + 1; }
      } else {
        if (tl < best) { stack[sp] = leftRef; sp = sp + 1; }
        if (tr < best) { stack[sp] = rightRef; sp = sp + 1; }
      }
    }
  }

  // analytic ground plane y = 0
  if (d.y < -1e-9) {
    let t = -o.y / d.y;
    if (t > 1e-5 && t < best) { best = t; kind = -1; n = vec3<f32>(0.0, 1.0, 0.0); }
  }

  return TraceResult(best, kind, n);
}

// any instance blocking the ray toward the light? (near-first any-hit)
fn shadowed(o: vec3<f32>, d: vec3<f32>) -> f32 {
  let invD = vec3<f32>(
    select(0.0, 1.0 / d.x, d.x != 0.0),
    select(0.0, 1.0 / d.y, d.y != 0.0),
    select(0.0, 1.0 / d.z, d.z != 0.0),
  );
  var stack = array<i32, 128>();
  var sp = 0;
  if (params.root != -1) { stack[0] = params.root; sp = 1; }
  while (sp > 0) {
    sp = sp - 1;
    let nref = stack[sp];
    if (nref < 0) {
      let i = -nref - 2;
      let t0 = instT(i, 0);
      let t1 = instT(i, 1);
      let t2 = instT(i, 2);
      let t3 = instT(i, 3);
      let t5 = instT(i, 5);
      let t6 = instT(i, 6);
      let kkind = i32(t0.x);
      let p0 = t0.y; let p1 = t0.z; let p2 = t0.w; let p3 = t1.x;
      let lo = matMulV(t1, t2, t3, o) + vec3<f32>(t5.w, t6.x, t6.y);
      let ld = matMulV(t1, t2, t3, d);
      let h = intersectShape(kkind, p0, p1, p2, p3, lo, ld);
      if (h.t < INF) { return 0.0; }
    } else {
      let node = nref;
      let rf = textureLoad(bvhTex, vec2<i32>(0, node), 0);
      let b0 = textureLoad(bvhBoxTex, vec2<i32>(0, node), 0);
      let b1 = textureLoad(bvhBoxTex, vec2<i32>(1, node), 0);
      let b2 = textureLoad(bvhBoxTex, vec2<i32>(2, node), 0);
      let leftRef = i32(rf.x);
      let rightRef = i32(rf.y);
      let lmn = vec3<f32>(b0.x, b0.y, b0.z);
      let lmx = vec3<f32>(b0.w, b1.x, b1.y);
      let rmn = vec3<f32>(b1.z, b1.w, b2.x);
      let rmx = vec3<f32>(b2.y, b2.z, b2.w);
      let tl = slabEntry(o, d, invD, lmn, lmx);
      let tr = slabEntry(o, d, invD, rmn, rmx);
      if (tl <= tr) {
        if (tr < INF) { stack[sp] = rightRef; sp = sp + 1; }
        if (tl < INF) { stack[sp] = leftRef; sp = sp + 1; }
      } else {
        if (tl < INF) { stack[sp] = leftRef; sp = sp + 1; }
        if (tr < INF) { stack[sp] = rightRef; sp = sp + 1; }
      }
    }
  }
  return 1.0;
}

fn skyColor(rd: vec3<f32>) -> vec3<f32> {
  let t = rd.y * 0.5 + 0.5;
  var col = ZENITH * t + HORIZON * (1.0 - t);
  let dd = max(0.0, dot(rd, params.lightDir));
  let glow = pow(dd, 24.0) * 0.9;
  col = col + SUN_GLOW * glow;
  return col;
}

// deterministic 0..1 per (pixel, bounce, frame) — decorrelates the one
// sample-per-frame accumulation without a RNG state buffer
fn rand01(x: i32, y: i32, depth: i32, salt: i32) -> f32 {
  let h = hash3(x, y, params.frameNo * 7 + depth * 131 + salt);
  return f32(h & 0xffffu) / 65536.0;
}

fn randUnitVector(x: i32, y: i32, depth: i32, salt: i32) -> vec3<f32> {
  var v = vec3<f32>(0.0, 1.0, 0.0);
  for (var i = 0; i < 8; i = i + 1) {
    let a = rand01(x, y, depth, salt + i * 3);
    let b = rand01(x, y, depth, salt + i * 3 + 1);
    let c = rand01(x, y, depth, salt + i * 3 + 2);
    v = vec3<f32>(a * 2.0 - 1.0, b * 2.0 - 1.0, c * 2.0 - 1.0);
    if (dot(v, v) <= 1.0 && dot(v, v) > 1e-6) { break; }
  }
  return normalize(v);
}

fn schlick(cosine: f32, ior: f32) -> f32 {
  let r0 = (1.0 - ior) / (1.0 + ior);
  let r0sq = r0 * r0;
  return r0sq + (1.0 - r0sq) * pow(1.0 - cosine, 5.0);
}

// Iterative path trace (WGSL has no recursion). Lambertian stops at the first
// diffuse bounce with direct sun + ambient; metal and dielectric chains bounce
// up to MAX_DEPTH, tinted by the instance color at every hit.
fn shadeHit(tr0: TraceResult, ro: vec3<f32>, rd: vec3<f32>, px: i32, py: i32) -> vec3<f32> {
  var o = ro;
  var d = rd;
  var through = vec3<f32>(1.0);
  var col = vec3<f32>(0.0);
  var tr = tr0;

  for (var depth = 0; depth < MAX_DEPTH; depth = depth + 1) {
    if (tr.kind == -2) {
      col = col + through * skyColor(d);
      break;
    }

    let p = o + d * tr.t;
    let frontFace = dot(tr.n, d) < 0.0;
    var nf = tr.n;
    if (!frontFace) { nf = -tr.n; }

    var albedo = vec3<f32>(0.8);
    var mtype = MAT_LAMBERTIAN;
    var mparam = 0.0;

    if (tr.kind == -1) {
      let gx = floor(p.x);
      let gz = floor(p.z);
      let ch = select(0.24, 0.42, ((i32(gx) + i32(gz)) & 1) == 1);
      albedo = vec3<f32>(ch, ch * 0.99, ch * 0.92);
    } else {
      let t6 = instT(tr.kind, 6);
      let t7 = instT(tr.kind, 7);
      albedo = vec3<f32>(t6.z, t6.w, t7.x);
      mtype = i32(t7.y);
      mparam = t7.z;
    }

    if (mtype == MAT_LAMBERTIAN) {
      let nl = max(0.0, dot(nf, params.lightDir));
      var shadow = 0.0;
      if (nl > 0.0) {
        let k = i32(hash3(px, py, params.frameNo + depth * 97) % 64u);
        shadow = shadowed(p + nf * SHADOW_EPS, areaLightDir(k));
      }

      // Oren-Nayar diffuse: roughness (mparam) softens the Lambertian term and
      // adds grazing retro-reflection; 0 collapses back to pure Lambert.
      let v = -d;
      let nv = max(0.0, dot(nf, v));
      let sigma = clamp(mparam, 0.0, 1.0);
      let sigma2 = sigma * sigma;
      let A = 1.0 - 0.5 * sigma2 / (sigma2 + 0.33);
      let B = 0.45 * sigma2 / (sigma2 + 0.09);
      let lp = params.lightDir - nf * nl;
      let vp = v - nf * nv;
      let ll = length(lp);
      let vl = length(vp);
      var cosAz = 0.0;
      if (ll > 1e-5 && vl > 1e-5) {
        cosAz = clamp(dot(lp, vp) / (ll * vl), -1.0, 1.0);
      }
      let sinTl = sqrt(max(0.0, 1.0 - nl * nl));
      let sinTv = sqrt(max(0.0, 1.0 - nv * nv));
      let maxCos = max(nl, nv);
      let sinAlphaTanBeta = select(0.0, sinTl * sinTv / maxCos, maxCos > 1e-5);
      let on = A + B * max(cosAz, 0.0) * sinAlphaTanBeta;

      let hemi = nf.y * 0.5 + 0.5;
      let amb = AMB_GROUND + (AMB_SKY - AMB_GROUND) * hemi;
      let diff = on * nl * shadow;
      var c = albedo * (amb + LIGHT_COLOR * diff);
      if (tr.kind == -1) {
        let fog = 1.0 - exp(-tr.t * 0.018);
        c = c + (HORIZON - c) * fog;
      }
      col = col + through * c;
      break;
    }

    else if (mtype == MAT_METAL) {
      let r0 = reflect(d, nf);
      let fuzz = clamp(mparam, 0.0, 1.0);
      let r = normalize(r0 + randUnitVector(px, py, depth, 31) * fuzz);
      if (dot(r, nf) <= 1e-4) { break; }
      through = through * albedo;
      o = p + nf * SHADOW_EPS;
      d = r;
    }

    else {
      // dielectric: Schlick-weighted reflect/refract (the true, unflipped
      // normal determines the interface side)
      let ior = max(mparam, 1.001);
      let nn = select(-tr.n, tr.n, frontFace);
      let cosTheta = min(dot(-d, nn), 1.0);
      let sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
      let etaI = select(ior, 1.0, frontFace);
      let etaT = select(1.0, ior, frontFace);
      let ratio = etaI / etaT;
      if (etaI * sinTheta <= etaT && rand01(px, py, depth, 991) > schlick(cosTheta, ior)) {
        d = normalize(refract(d, nn, ratio));
        o = p - nn * SHADOW_EPS;
      } else {
        d = normalize(reflect(d, nn));
        o = p + nn * SHADOW_EPS;
      }
      through = through * albedo;
    }

    tr = tracePrimary(o, d);
  }

  return col;
}

struct VOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VOut {
  let positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
  );
  var o: VOut;
  let p = positions[vi];
  o.pos = vec4<f32>(p, 0.0, 1.0);
  o.uv = vec2<f32>(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return o;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4<f32> {
  let x = i32(clamp(floor(in.uv.x * f32(params.width)), 0.0, f32(params.width) - 1.0));
  let y = i32(clamp(floor(in.uv.y * f32(params.height)), 0.0, f32(params.height) - 1.0));

  let o = params.camOrigin;
  let rc = max(1, params.raycount);
  var sum = vec3<f32>(0.0);

  // trace `raycount` decorrelated rays per pixel this frame; each uses its own
  // Halton offset so the batch stays stratified across frames
  for (var s = 0; s < rc; s = s + 1) {
    let jx = halton(params.sampleBase + s, 2);
    let jy = halton(params.sampleBase + s, 3);
    let u = (f32(x) + jx) / f32(params.width);
    let v = (f32(y) + jy) / f32(params.height);
    let sx = (2.0 * u - 1.0) * params.tanHalf * params.aspect;
    let sy = (1.0 - 2.0 * v) * params.tanHalf;
    let d = normalize(params.camFwd + params.camRight * sx + params.camUp * sy);
    let tr = tracePrimary(o, d);
    sum = sum + shadeHit(tr, o, d, x, y);
  }

  let coord = vec2<i32>(x, y);
  let prev = textureLoad(accPrev, coord, 0);
  if (params.reset > 0.5) {
    return vec4<f32>(sum, f32(rc));
  }
  return vec4<f32>(prev.rgb + sum, prev.a + f32(rc));
}
