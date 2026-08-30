// Radiance Cascades (2D)
// https://arxiv.org/abs/2408.14425

struct Params {
  sceneSize: vec2<f32>,
  spacing: f32,
  rays: f32,
  intervalLo: f32,
  intervalHi: f32,
  stepsPerRay: f32,
  branching: f32,
  hasCoarser: f32,
  bilinearFix: f32,
};

const PI = 3.14159265359;
// Emission (rgb) is decoupled from occlusion (a): lights add radiance without
// blocking; occluders block without emitting. EMISSION_SCALE maps the stored
// 0..1 emission color into a radiance density (per unit length).
const EMISSION_SCALE = 0.04;

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var sceneSampler: sampler;
@group(0) @binding(3) var lightTex: texture_2d<f32>;
@group(0) @binding(4) var lightSampler: sampler;
@group(0) @binding(5) var cascadeIn: texture_2d<f32>;

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
  var out: VOut;
  let p = positions[vi];
  out.pos = vec4<f32>(p, 0.0, 1.0);
  out.uv = vec2<f32>(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return out;
}

struct BilinearTaps { nx: array<i32,4>, ny: array<i32,4>, w: array<f32,4> };

fn bilinearProbeTaps(posInProbeUnits: vec2<f32>, probesX: i32, probesY: i32) -> BilinearTaps {
  let fp = posInProbeUnits - 0.5;
  let base = floor(fp);
  let frac = fp - base;
  var t: BilinearTaps;
  for (var i = 0; i < 4; i = i + 1) {
    let ox = i & 1; let oy = i >> 1;
    t.nx[i] = clamp(i32(base.x) + ox, 0, probesX - 1);
    t.ny[i] = clamp(i32(base.y) + oy, 0, probesY - 1);
    let wx = select(1.0 - frac.x, frac.x, ox == 1);
    let wy = select(1.0 - frac.y, frac.y, oy == 1);
    t.w[i] = wx * wy;
  }
  return t;
}

fn traceRay(origin: vec2<f32>, dir: vec2<f32>, t0: f32, t1: f32) -> vec4<f32> {
  var radiance = vec3<f32>(0.0);
  var transmittance = 1.0;
  // fixed step COUNT (not a fixed px size): keeps cost/ray constant even
  // though (t1-t0) grows every cascade level.
  let stepSize = max((t1 - t0) / params.stepsPerRay, 0.5);
  var t = t0;
  let dims = params.sceneSize;
  loop {
    if (t >= t1 || transmittance < 0.005) { break; }
    let p = origin + dir * t;
    if (p.x < 0.0 || p.y < 0.0 || p.x >= dims.x || p.y >= dims.y) { break; }
    let s = textureSampleLevel(sceneTex, sceneSampler, p / dims, 0.0);
    let l = textureSampleLevel(lightTex, lightSampler, p / dims, 0.0);
    radiance += transmittance * (s.rgb + l.rgb) * stepSize * EMISSION_SCALE;
    transmittance *= (1.0 - s.a);
    t += stepSize;
  }
  return vec4<f32>(radiance, transmittance);
}

@fragment
fn fs(in: VOut) -> @location(0) vec4<f32> {
  let dims = params.sceneSize;
  let spacing = params.spacing;
  let rays = u32(params.rays);
  let probesX = u32(ceil(dims.x / spacing));
  let probesY = u32(ceil(dims.y / spacing));
  let outW = probesX * rays;
  let pixel = in.uv * vec2<f32>(f32(outW), f32(probesY));
  let px = u32(floor(pixel.x)) / rays;
  let rayIdx = u32(floor(pixel.x)) % rays;
  let py = u32(floor(pixel.y));

  let probeCenter = (vec2<f32>(f32(px), f32(py)) + 0.5) * spacing;
  let angle = (f32(rayIdx) + 0.5) / f32(rays) * 2.0 * PI;
  let dir = vec2<f32>(cos(angle), sin(angle));

  var radiance = vec3<f32>(0.0);
  if (params.hasCoarser > 0.5) {
    // Coarser cascade geometry: probes are 2x apart with `branching`x the rays,
    // so this probe's ray cone covers `branching` child rays in cascade i+1.
    let nextSpacing = spacing * 2.0;
    let nextRays = rays * u32(params.branching);
    let nextProbesX = i32(ceil(dims.x / nextSpacing));
    let nextProbesY = i32(ceil(dims.y / nextSpacing));
    let childRaysPerParent = u32(params.branching);
    let childRayBase = rayIdx * childRaysPerParent;
    let taps = bilinearProbeTaps(probeCenter / nextSpacing, nextProbesX, nextProbesY);

    if (params.bilinearFix > 0.5) {
      // Bilinear fix (paper §2.5): trace the near interval toward the ray-start
      // position of each of the four coarser probes, merge with that probe's own
      // samples, then average with the usual bilinear weights. Costs 4x traces
      // but removes the parallax ringing of the basic method.
      let start = probeCenter + dir * params.intervalLo;
      for (var i = 0; i < 4; i = i + 1) {
        let childCenter = (vec2<f32>(f32(taps.nx[i]), f32(taps.ny[i])) + 0.5) * nextSpacing;
        let endPoint = childCenter + dir * params.intervalHi;
        let toTarget = endPoint - start;
        let dist = max(length(toTarget), 1e-4);
        let fixedDir = toTarget / dist;
        let hit = traceRay(start, fixedDir, 0.0, dist);

        var childAcc = vec3<f32>(0.0);
        for (var c: u32 = 0; c < childRaysPerParent; c = c + 1) {
          let sampleX = u32(taps.nx[i]) * nextRays + childRayBase + c;
          childAcc += textureLoad(cascadeIn, vec2<i32>(i32(sampleX), taps.ny[i]), 0).rgb;
        }
        radiance += (hit.rgb + hit.a * (childAcc / f32(childRaysPerParent))) * taps.w[i];
      }
    } else {
      // Basic method (paper §2.3): trace the near interval once in the ray
      // direction, then merge with the bilinearly interpolated coarser radiance
      // sampled in the same direction cone.
      let hit = traceRay(probeCenter, dir, params.intervalLo, params.intervalHi);
      var far = vec3<f32>(0.0);
      for (var i = 0; i < 4; i = i + 1) {
        var childAcc = vec3<f32>(0.0);
        for (var c: u32 = 0; c < childRaysPerParent; c = c + 1) {
          let sampleX = u32(taps.nx[i]) * nextRays + childRayBase + c;
          childAcc += textureLoad(cascadeIn, vec2<i32>(i32(sampleX), taps.ny[i]), 0).rgb;
        }
        far += (childAcc / f32(childRaysPerParent)) * taps.w[i];
      }
      radiance = hit.rgb + hit.a * far;
    }
  } else {
    // coarsest cascade: nothing to merge with; trace its interval (stopping at
    // the domain boundary) and stop.
    let hit = traceRay(probeCenter, dir, params.intervalLo, params.intervalHi);
    radiance = hit.rgb;
  }

  return vec4<f32>(radiance, 1.0);
}
