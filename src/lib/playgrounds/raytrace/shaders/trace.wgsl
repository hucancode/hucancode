// GPU RAY TRACER (WebGPU compute)

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
  jx: f32,
  jy: f32,
  frameNo: i32,
  width: i32,
  height: i32,
  root: i32,
  nodeCount: i32,
  instanceCount: i32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> bvh: array<f32>;
@group(0) @binding(2) var<storage, read> inst: array<f32>;
@group(0) @binding(3) var accPrev: texture_2d<f32>;
@group(0) @binding(4) var accNext: texture_storage_2d<rgba32float, write>;

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

// row-major 3x3 starting at `base` in the instance array, times a vector
fn matMulVAt(base: i32, v: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    inst[base] * v.x + inst[base + 1] * v.y + inst[base + 2] * v.z,
    inst[base + 3] * v.x + inst[base + 4] * v.y + inst[base + 5] * v.z,
    inst[base + 6] * v.x + inst[base + 7] * v.y + inst[base + 8] * v.z,
  );
}

// nearest positive intersection with one analytic primitive in unit space
fn intersectShape(kind: i32, p0: f32, p1: f32, p2: f32, p3: f32, o: vec3<f32>, d: vec3<f32>) -> Hit {
  var best = INF;
  var n = vec3<f32>(0.0, 1.0, 0.0);

  if (kind == 0) {
    // box (sloped/curved top surface y = A + B*z + C*z*z)
    let s = p0; let k = p1;
    let A = 0.5 - 0.5 * s + 0.25 * s * k;
    let Bc = -s; let Cc = -s * k;
    if (abs(d.x) > PAR) {
      var t = (0.5 - o.x) / d.x;
      var y = o.y + d.y * t; var z = o.z + d.z * t;
      if (y >= -0.5 && y <= A + Bc * z + Cc * z * z && z >= -0.5 && z <= 0.5) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(1.0, 0.0, 0.0); }
      }
      t = (-0.5 - o.x) / d.x;
      y = o.y + d.y * t; z = o.z + d.z * t;
      if (y >= -0.5 && y <= A + Bc * z + Cc * z * z && z >= -0.5 && z <= 0.5) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(-1.0, 0.0, 0.0); }
      }
    }
    if (abs(d.y) > PAR) {
      let t = (-0.5 - o.y) / d.y;
      let x = o.x + d.x * t; let z = o.z + d.z * t;
      if (x >= -0.5 && x <= 0.5 && z >= -0.5 && z <= 0.5) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, -1.0, 0.0); }
      }
    }
    if (abs(d.z) > PAR) {
      var t = (-0.5 - o.z) / d.z;
      var x = o.x + d.x * t; var y = o.y + d.y * t;
      if (x >= -0.5 && x <= 0.5 && y >= -0.5 && y <= A + Bc * (-0.5) + Cc * 0.25) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, 0.0, -1.0); }
      }
      t = (0.5 - o.z) / d.z;
      x = o.x + d.x * t; y = o.y + d.y * t;
      if (x >= -0.5 && x <= 0.5 && y >= -0.5 && y <= A + Bc * 0.5 + Cc * 0.25) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, 0.0, 1.0); }
      }
    }
    // top quadric in z, extruded along x
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
          if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, il, nz * il); }
        }
      }
    } else {
      let disc = P * P - 4.0 * Q * R;
      if (disc >= 0.0) {
        let sq = sqrt(disc);
        for (var i = 0; i < 2; i = i + 1) {
          let t = select((-P + sq) / (2.0 * Q), (-P - sq) / (2.0 * Q), i == 0);
          let x = o.x + d.x * t; let z = o.z + d.z * t;
          if (x >= -0.5 && x <= 0.5 && z >= -0.5 && z <= 0.5 && (o.y + d.y * t) >= -0.5) {
            let nz = -(Bc + 2.0 * Cc * z);
            let il = 1.0 / length(vec2<f32>(1.0, nz));
            if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, il, nz * il); }
          }
        }
      }
    }
  }

  else if (kind == 1) {
    // cylinder r=1, y 0..1
    let a = d.x * d.x + d.z * d.z;
    if (a > PAR) {
      let b = 2.0 * (o.x * d.x + o.z * d.z);
      let c = o.x * o.x + o.z * o.z - 1.0;
      let disc = b * b - 4.0 * a * c;
      if (disc >= 0.0) {
        let sq = sqrt(disc);
        for (var i = 0; i < 2; i = i + 1) {
          let t = select((-b + sq) / (2.0 * a), (-b - sq) / (2.0 * a), i == 0);
          let y = o.y + d.y * t;
          if (y >= 0.0 && y <= 1.0) {
            if (t > EPS && t < best) { best = t; n = vec3<f32>(o.x + d.x * t, 0.0, o.z + d.z * t); }
          }
        }
      }
    }
    if (abs(d.y) > PAR) {
      var t = -o.y / d.y;
      var x = o.x + d.x * t; var z = o.z + d.z * t;
      if (x * x + z * z <= 1.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, -1.0, 0.0); }
      }
      t = (1.0 - o.y) / d.y;
      x = o.x + d.x * t; z = o.z + d.z * t;
      if (x * x + z * z <= 1.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, 1.0, 0.0); }
      }
    }
  }

  else if (kind == 2) {
    // coneCut base r=1 at y=0 -> top r=p0 at y=1 (radius = 1 + k*y, k = p0-1)
    let k = p0 - 1.0;
    let a = d.x * d.x + d.z * d.z - k * k * d.y * d.y;
    let b = 2.0 * (o.x * d.x + o.z * d.z) - 2.0 * k * d.y * (1.0 + k * o.y);
    let c = o.x * o.x + o.z * o.z - (1.0 + k * o.y) * (1.0 + k * o.y);
    if (abs(a) > PAR) {
      let disc = b * b - 4.0 * a * c;
      if (disc >= 0.0) {
        let sq = sqrt(disc);
        for (var i = 0; i < 2; i = i + 1) {
          let t = select((-b + sq) / (2.0 * a), (-b - sq) / (2.0 * a), i == 0);
          let y = o.y + d.y * t;
          if (y >= 0.0 && y <= 1.0) {
            let nx = o.x + d.x * t; let nz = o.z + d.z * t;
            let ny = -k * (1.0 + k * y);
            let il = 1.0 / length(vec3<f32>(nx, ny, nz));
            if (t > EPS && t < best) { best = t; n = vec3<f32>(nx * il, ny * il, nz * il); }
          }
        }
      }
    } else if (abs(b) > PAR) {
      let t = -c / b;
      let y = o.y + d.y * t;
      if (y >= 0.0 && y <= 1.0) {
        let nx = o.x + d.x * t; let nz = o.z + d.z * t;
        let ny = -k * (1.0 + k * y);
        let il = 1.0 / length(vec3<f32>(nx, ny, nz));
        if (t > EPS && t < best) { best = t; n = vec3<f32>(nx * il, ny * il, nz * il); }
      }
    }
    if (abs(d.y) > PAR) {
      var t = -o.y / d.y;
      var x = o.x + d.x * t; var z = o.z + d.z * t;
      if (x * x + z * z <= 1.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, -1.0, 0.0); }
      }
      if (p0 > 1e-6) {
        t = (1.0 - o.y) / d.y;
        x = o.x + d.x * t; z = o.z + d.z * t;
        if (x * x + z * z <= p0 * p0) {
          if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, 1.0, 0.0); }
        }
      }
    }
  }

  else if (kind == 3) {
    // sphere r=1
    let a = d.x * d.x + d.y * d.y + d.z * d.z;
    let b = 2.0 * (o.x * d.x + o.y * d.y + o.z * d.z);
    let c = o.x * o.x + o.y * o.y + o.z * o.z - 1.0;
    let disc = b * b - 4.0 * a * c;
    if (disc >= 0.0) {
      let sq = sqrt(disc);
      for (var i = 0; i < 2; i = i + 1) {
        let t = select((-b + sq) / (2.0 * a), (-b - sq) / (2.0 * a), i == 0);
        if (t > EPS && t < best) { best = t; n = o + d * t; }
      }
    }
  }

  else if (kind == 4) {
    // hemisphere r=1, dome up (+Y)
    let a = d.x * d.x + d.y * d.y + d.z * d.z;
    let b = 2.0 * (o.x * d.x + o.y * d.y + o.z * d.z);
    let c = o.x * o.x + o.y * o.y + o.z * o.z - 1.0;
    let disc = b * b - 4.0 * a * c;
    if (disc >= 0.0) {
      let sq = sqrt(disc);
      for (var i = 0; i < 2; i = i + 1) {
        let t = select((-b + sq) / (2.0 * a), (-b - sq) / (2.0 * a), i == 0);
        if (o.y + d.y * t >= 0.0) {
          if (t > EPS && t < best) { best = t; n = o + d * t; }
        }
      }
    }
    if (abs(d.y) > PAR) {
      let t = -o.y / d.y;
      let x = o.x + d.x * t; let z = o.z + d.z * t;
      if (x * x + z * z <= 1.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, -1.0, 0.0); }
      }
    }
  }

  else if (kind == 5) {
    // cutHemisphere: hollow bowl, shell ri..1 over y 0..yc + lip + base ring
    let ri = p0; let yc = p1;
    let a = d.x * d.x + d.y * d.y + d.z * d.z;
    let b = 2.0 * (o.x * d.x + o.y * d.y + o.z * d.z);
    var c = o.x * o.x + o.y * o.y + o.z * o.z - 1.0;
    var disc = b * b - 4.0 * a * c;
    if (disc >= 0.0) {
      let sq = sqrt(disc);
      for (var i = 0; i < 2; i = i + 1) {
        let t = select((-b + sq) / (2.0 * a), (-b - sq) / (2.0 * a), i == 0);
        let y = o.y + d.y * t;
        if (y >= 0.0 && y <= yc) {
          if (t > EPS && t < best) { best = t; n = vec3<f32>(o.x + d.x * t, y, o.z + d.z * t); }
        }
      }
    }
    c = o.x * o.x + o.y * o.y + o.z * o.z - ri * ri;
    disc = b * b - 4.0 * a * c;
    if (disc >= 0.0) {
      let sq = sqrt(disc);
      for (var i = 0; i < 2; i = i + 1) {
        let t = select((-b + sq) / (2.0 * a), (-b - sq) / (2.0 * a), i == 0);
        let y = o.y + d.y * t;
        if (y >= 0.0 && y <= yc) {
          if (t > EPS && t < best) { best = t; n = vec3<f32>(-(o.x + d.x * t), -y, -(o.z + d.z * t)); }
        }
      }
    }
    if (abs(d.y) > PAR) {
      var t = (yc - o.y) / d.y;
      var x = o.x + d.x * t; var z = o.z + d.z * t; var r2 = x * x + z * z;
      if (r2 >= ri * ri && r2 <= 1.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, 1.0, 0.0); }
      }
      t = -o.y / d.y;
      x = o.x + d.x * t; z = o.z + d.z * t; r2 = x * x + z * z;
      if (r2 >= ri * ri && r2 <= 1.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, -1.0, 0.0); }
      }
    }
  }

  else if (kind == 6) {
    // halfCylinder r=1, y 0..1, round side +Z, flat face z=0
    let a = d.x * d.x + d.z * d.z;
    if (a > PAR) {
      let b = 2.0 * (o.x * d.x + o.z * d.z);
      let c = o.x * o.x + o.z * o.z - 1.0;
      let disc = b * b - 4.0 * a * c;
      if (disc >= 0.0) {
        let sq = sqrt(disc);
        for (var i = 0; i < 2; i = i + 1) {
          let t = select((-b + sq) / (2.0 * a), (-b - sq) / (2.0 * a), i == 0);
          let y = o.y + d.y * t; let z = o.z + d.z * t;
          if (y >= 0.0 && y <= 1.0 && z >= 0.0) {
            if (t > EPS && t < best) { best = t; n = vec3<f32>(o.x + d.x * t, 0.0, z); }
          }
        }
      }
    }
    if (abs(d.z) > PAR) {
      let t = -o.z / d.z;
      let x = o.x + d.x * t; let y = o.y + d.y * t;
      if (x >= -1.0 && x <= 1.0 && y >= 0.0 && y <= 1.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, 0.0, -1.0); }
      }
    }
    if (abs(d.y) > PAR) {
      var t = -o.y / d.y;
      var x = o.x + d.x * t; var z = o.z + d.z * t;
      if (x * x + z * z <= 1.0 && z >= 0.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, -1.0, 0.0); }
      }
      t = (1.0 - o.y) / d.y;
      x = o.x + d.x * t; z = o.z + d.z * t;
      if (x * x + z * z <= 1.0 && z >= 0.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, 1.0, 0.0); }
      }
    }
  }

  else if (kind == 7) {
    // halfCylinderBox: halfCylinder + box tail to z=-dp
    let dp = p0;
    let a = d.x * d.x + d.z * d.z;
    if (a > PAR) {
      let b = 2.0 * (o.x * d.x + o.z * d.z);
      let c = o.x * o.x + o.z * o.z - 1.0;
      let disc = b * b - 4.0 * a * c;
      if (disc >= 0.0) {
        let sq = sqrt(disc);
        for (var i = 0; i < 2; i = i + 1) {
          let t = select((-b + sq) / (2.0 * a), (-b - sq) / (2.0 * a), i == 0);
          let y = o.y + d.y * t; let z = o.z + d.z * t;
          if (y >= 0.0 && y <= 1.0 && z >= 0.0) {
            if (t > EPS && t < best) { best = t; n = vec3<f32>(o.x + d.x * t, 0.0, z); }
          }
        }
      }
    }
    if (abs(d.z) > PAR) {
      let t = (-dp - o.z) / d.z;
      let x = o.x + d.x * t; let y = o.y + d.y * t;
      if (x >= -1.0 && x <= 1.0 && y >= 0.0 && y <= 1.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, 0.0, -1.0); }
      }
    }
    if (abs(d.x) > PAR) {
      var t = (1.0 - o.x) / d.x;
      var y = o.y + d.y * t; var z = o.z + d.z * t;
      if (y >= 0.0 && y <= 1.0 && z >= -dp && z <= 0.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(1.0, 0.0, 0.0); }
      }
      t = (-1.0 - o.x) / d.x;
      y = o.y + d.y * t; z = o.z + d.z * t;
      if (y >= 0.0 && y <= 1.0 && z >= -dp && z <= 0.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(-1.0, 0.0, 0.0); }
      }
    }
    if (abs(d.y) > PAR) {
      var t = -o.y / d.y;
      var x = o.x + d.x * t; var z = o.z + d.z * t;
      var inD = (x * x + z * z <= 1.0 && z >= 0.0) || (x >= -1.0 && x <= 1.0 && z >= -dp && z <= 0.0);
      if (inD) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, -1.0, 0.0); }
      }
      t = (1.0 - o.y) / d.y;
      x = o.x + d.x * t; z = o.z + d.z * t;
      inD = (x * x + z * z <= 1.0 && z >= 0.0) || (x >= -1.0 && x <= 1.0 && z >= -dp && z <= 0.0);
      if (inD) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, 1.0, 0.0); }
      }
    }
  }

  else if (kind == 8) {
    // quarterCylinder r=1, y 0..1, arc +X..+Z, corner origin
    let a = d.x * d.x + d.z * d.z;
    if (a > PAR) {
      let b = 2.0 * (o.x * d.x + o.z * d.z);
      let c = o.x * o.x + o.z * o.z - 1.0;
      let disc = b * b - 4.0 * a * c;
      if (disc >= 0.0) {
        let sq = sqrt(disc);
        for (var i = 0; i < 2; i = i + 1) {
          let t = select((-b + sq) / (2.0 * a), (-b - sq) / (2.0 * a), i == 0);
          let y = o.y + d.y * t; let x = o.x + d.x * t; let z = o.z + d.z * t;
          if (y >= 0.0 && y <= 1.0 && x >= 0.0 && z >= 0.0) {
            if (t > EPS && t < best) { best = t; n = vec3<f32>(x, 0.0, z); }
          }
        }
      }
    }
    if (abs(d.x) > PAR) {
      let t = -o.x / d.x;
      let y = o.y + d.y * t; let z = o.z + d.z * t;
      if (y >= 0.0 && y <= 1.0 && z >= 0.0 && z <= 1.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(-1.0, 0.0, 0.0); }
      }
    }
    if (abs(d.z) > PAR) {
      let t = -o.z / d.z;
      let y = o.y + d.y * t; let x = o.x + d.x * t;
      if (y >= 0.0 && y <= 1.0 && x >= 0.0 && x <= 1.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, 0.0, -1.0); }
      }
    }
    if (abs(d.y) > PAR) {
      var t = -o.y / d.y;
      var x = o.x + d.x * t; var z = o.z + d.z * t;
      if (x * x + z * z <= 1.0 && x >= 0.0 && z >= 0.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, -1.0, 0.0); }
      }
      t = (1.0 - o.y) / d.y;
      x = o.x + d.x * t; z = o.z + d.z * t;
      if (x * x + z * z <= 1.0 && x >= 0.0 && z >= 0.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, 1.0, 0.0); }
      }
    }
  }

  else if (kind == 9) {
    // gear: toothless annulus approximation (outer r=1, hole r=0.55)
    let ri = 0.55;
    let a = d.x * d.x + d.z * d.z;
    if (a > PAR) {
      let b = 2.0 * (o.x * d.x + o.z * d.z);
      var c = o.x * o.x + o.z * o.z - 1.0;
      var disc = b * b - 4.0 * a * c;
      if (disc >= 0.0) {
        let sq = sqrt(disc);
        for (var i = 0; i < 2; i = i + 1) {
          let t = select((-b + sq) / (2.0 * a), (-b - sq) / (2.0 * a), i == 0);
          let y = o.y + d.y * t;
          if (y >= 0.0 && y <= 1.0) {
            if (t > EPS && t < best) { best = t; n = vec3<f32>(o.x + d.x * t, 0.0, o.z + d.z * t); }
          }
        }
      }
      c = o.x * o.x + o.z * o.z - ri * ri;
      disc = b * b - 4.0 * a * c;
      if (disc >= 0.0) {
        let sq = sqrt(disc);
        for (var i = 0; i < 2; i = i + 1) {
          let t = select((-b + sq) / (2.0 * a), (-b - sq) / (2.0 * a), i == 0);
          let y = o.y + d.y * t;
          if (y >= 0.0 && y <= 1.0) {
            if (t > EPS && t < best) { best = t; n = vec3<f32>(-(o.x + d.x * t), 0.0, -(o.z + d.z * t)); }
          }
        }
      }
    }
    if (abs(d.y) > PAR) {
      var t = -o.y / d.y;
      var x = o.x + d.x * t; var z = o.z + d.z * t;
      var r2 = x * x + z * z;
      if (r2 >= ri * ri && r2 <= 1.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, -1.0, 0.0); }
      }
      t = (1.0 - o.y) / d.y;
      x = o.x + d.x * t; z = o.z + d.z * t;
      r2 = x * x + z * z;
      if (r2 >= ri * ri && r2 <= 1.0) {
        if (t > EPS && t < best) { best = t; n = vec3<f32>(0.0, 1.0, 0.0); }
      }
    }
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
  if (params.root >= 0) { stack[0] = params.root; sp = 1; }
  while (sp > 0) {
    sp = sp - 1;
    let node = stack[sp];
    let base = node * 8;
    let l = i32(bvh[base]);
    let r = i32(bvh[base + 1]);
    if (r < 0) {
      let i = l;
      let ib = i * 32;
      let kkind = i32(inst[ib]);
      let p0 = inst[ib + 1]; let p1 = inst[ib + 2]; let p2 = inst[ib + 3]; let p3 = inst[ib + 4];
      let lo = matMulVAt(ib + 5, o) + vec3<f32>(inst[ib + 23], inst[ib + 24], inst[ib + 25]);
      let ld = matMulVAt(ib + 5, d);
      let h = intersectShape(kkind, p0, p1, p2, p3, lo, ld);
      if (h.t < best) {
        best = h.t; kind = i;
        n = normalize(matMulVAt(ib + 14, h.n));
      }
    } else {
      let mnl = vec3<f32>(bvh[base + 2], bvh[base + 3], bvh[base + 4]);
      let mxl = vec3<f32>(bvh[base + 5], bvh[base + 6], bvh[base + 7]);
      let rb = r * 8;
      let mnr = vec3<f32>(bvh[rb + 2], bvh[rb + 3], bvh[rb + 4]);
      let mxr = vec3<f32>(bvh[rb + 5], bvh[rb + 6], bvh[rb + 7]);
      let tl = slabEntry(o, d, invD, mnl, mxl);
      let tr = slabEntry(o, d, invD, mnr, mxr);
      if (tl <= tr) {
        if (tr < best) { stack[sp] = r; sp = sp + 1; }
        if (tl < best) { stack[sp] = l; sp = sp + 1; }
      } else {
        if (tl < best) { stack[sp] = l; sp = sp + 1; }
        if (tr < best) { stack[sp] = r; sp = sp + 1; }
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
  if (params.root >= 0) { stack[0] = params.root; sp = 1; }
  while (sp > 0) {
    sp = sp - 1;
    let node = stack[sp];
    let base = node * 8;
    let l = i32(bvh[base]);
    let r = i32(bvh[base + 1]);
    if (r < 0) {
      let i = l;
      let ib = i * 32;
      let kkind = i32(inst[ib]);
      let p0 = inst[ib + 1]; let p1 = inst[ib + 2]; let p2 = inst[ib + 3]; let p3 = inst[ib + 4];
      let lo = matMulVAt(ib + 5, o) + vec3<f32>(inst[ib + 23], inst[ib + 24], inst[ib + 25]);
      let ld = matMulVAt(ib + 5, d);
      let h = intersectShape(kkind, p0, p1, p2, p3, lo, ld);
      if (h.t < INF) { return 0.0; }
    } else {
      let mnl = vec3<f32>(bvh[base + 2], bvh[base + 3], bvh[base + 4]);
      let mxl = vec3<f32>(bvh[base + 5], bvh[base + 6], bvh[base + 7]);
      let rb = r * 8;
      let mnr = vec3<f32>(bvh[rb + 2], bvh[rb + 3], bvh[rb + 4]);
      let mxr = vec3<f32>(bvh[rb + 5], bvh[rb + 6], bvh[rb + 7]);
      let tl = slabEntry(o, d, invD, mnl, mxl);
      let tr = slabEntry(o, d, invD, mnr, mxr);
      if (tl <= tr) {
        if (tr < INF) { stack[sp] = r; sp = sp + 1; }
        if (tl < INF) { stack[sp] = l; sp = sp + 1; }
      } else {
        if (tl < INF) { stack[sp] = l; sp = sp + 1; }
        if (tr < INF) { stack[sp] = r; sp = sp + 1; }
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
      let ib = tr.kind * 32;
      albedo = vec3<f32>(inst[ib + 26], inst[ib + 27], inst[ib + 28]);
      mtype = i32(inst[ib + 29]);
      mparam = inst[ib + 30];
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

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = i32(gid.x);
  let y = i32(gid.y);
  if (x >= params.width || y >= params.height) { return; }

  let u = (f32(x) + params.jx) / f32(params.width);
  let v = (f32(y) + params.jy) / f32(params.height);
  let sx = (2.0 * u - 1.0) * params.tanHalf * params.aspect;
  let sy = (1.0 - 2.0 * v) * params.tanHalf;
  let d = normalize(params.camFwd + params.camRight * sx + params.camUp * sy);
  let o = params.camOrigin;

  let tr = tracePrimary(o, d);
  let col = shadeHit(tr, o, d, x, y);

  let coord = vec2<i32>(x, y);
  let prev = textureLoad(accPrev, coord, 0);
  var outv = vec4<f32>(col, 1.0);
  if (params.reset > 0.5) {
    outv = vec4<f32>(col, 1.0);
  } else {
    outv = vec4<f32>(prev.rgb + col, prev.a + 1.0);
  }
  textureStore(accNext, coord, outv);
}
