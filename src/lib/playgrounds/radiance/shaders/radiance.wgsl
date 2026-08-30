// Radiance Cascades (2D) — compute the angular radiance field on a sparse
// multi-resolution probe grid, then upsample the finest cascade to pixels.
// A probe stores `raysBase * branching^level` directional samples. Each level
// traces rays through one ring of distances (intervalBase *
// [branching^(level-1), branching^level]) and merges with the coarser cascade.
//
// https://arxiv.org/abs/2408.14425

struct Params {
  sceneSize: vec2<f32>,
  cascadeIdx: f32,
  cascadeCnt: f32,
  raysBase: f32,
  branching: f32,
  intervalBase: f32,
  probeSpacing0: f32,
  stepsPerRay: f32,
  exposure: f32,
  probeOverlay: f32,
  pad0: f32,
};

const PI = 3.14159265359;

// Emission (rgb) is decoupled from occlusion (a): lights add radiance without
// blocking; occluders block without emitting. EMISSION_SCALE maps the stored
// 0..1 emission color into a radiance density (per unit length).
const EMISSION_SCALE = 0.04;

fn probeSpacing(idx: f32) -> f32 { return params.probeSpacing0 * pow(2.0, idx); }
fn rayCount(idx: f32) -> f32 { return params.raysBase * pow(params.branching, idx); }
fn intervalRange(idx: f32) -> vec2<f32> {
  let t0 = select(0.0, params.intervalBase * pow(params.branching, idx - 1.0), idx > 0.0);
  let t1 = params.intervalBase * pow(params.branching, idx);
  return vec2<f32>(t0, t1);
}

struct BilinearTaps { nx: array<i32,4>, ny: array<i32,4>, w: array<f32,4> };

// Shared by buildCascade (merging into the next coarser cascade) and fsMain
// (upsampling cascade0 to screen pixels): given a position in probe-space,
// return the 4 neighboring probe indices + their bilinear weights.
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
    radiance += transmittance * s.rgb * stepSize * EMISSION_SCALE;
    transmittance *= (1.0 - s.a);
    t += stepSize;
  }
  return vec4<f32>(radiance, transmittance);
}

// ---- cascade builder -----------------------------------------------------

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var sceneSampler: sampler;
@group(0) @binding(3) var cascadeIn: texture_2d<f32>;
@group(0) @binding(4) var cascadeOutTex: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn buildCascade(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = params.cascadeIdx;
  let spacing = probeSpacing(idx);
  let rays = u32(rayCount(idx));
  let dims = params.sceneSize;
  let probesX = u32(ceil(dims.x / spacing));
  let probesY = u32(ceil(dims.y / spacing));
  let px = gid.x / rays;
  let rayIdx = gid.x % rays;
  let py = gid.y;
  if (px >= probesX || py >= probesY) { return; }

  let probeCenter = (vec2<f32>(f32(px), f32(py)) + 0.5) * spacing;
  let range = intervalRange(idx);
  let angle = (f32(rayIdx) + 0.5) / f32(rays) * 2.0 * PI;
  let dir = vec2<f32>(cos(angle), sin(angle));

  var radiance = vec3<f32>(0.0);
  if (idx < params.cascadeCnt - 1.0) {
    // Bilinear fix (paper §2.5): trace the near interval toward the ray-start
    // position of each of the four child probes, merge with that child's own
    // sample, then average with the usual bilinear weights. Reprojecting the
    // near ray removes the parallax ringing of the basic merge.
    let nextSpacing = spacing * 2.0;
    let nextRays = rays * u32(params.branching);
    let nextProbesX = i32(ceil(dims.x / nextSpacing));
    let nextProbesY = i32(ceil(dims.y / nextSpacing));
    let childRaysPerParent = u32(params.branching);
    let childRayIdx = rayIdx * childRaysPerParent;

    let start = probeCenter + dir * range.x;
    let taps = bilinearProbeTaps(probeCenter / nextSpacing, nextProbesX, nextProbesY);
    for (var i = 0; i < 4; i = i + 1) {
      let childCenter = (vec2<f32>(f32(taps.nx[i]), f32(taps.ny[i])) + 0.5) * nextSpacing;
      let endPoint = childCenter + dir * range.y;
      let toTarget = endPoint - start;
      let dist = max(length(toTarget), 1e-4);
      let fixedDir = toTarget / dist;
      let hit = traceRay(start, fixedDir, 0.0, dist);

      var childAcc = vec3<f32>(0.0);
      for (var c: u32 = 0; c < childRaysPerParent; c = c + 1) {
        let sampleX = u32(taps.nx[i]) * nextRays + childRayIdx + c;
        childAcc += textureLoad(cascadeIn, vec2<i32>(i32(sampleX), taps.ny[i]), 0).rgb;
      }
      let merged = hit.rgb + hit.a * (childAcc / f32(childRaysPerParent));
      radiance += merged * taps.w[i]; // bilinear weights sum to 1
    }
  } else {
    // coarsest cascade: nothing to merge with; trace until it leaves the domain.
    let hit = traceRay(probeCenter, dir, range.x, range.y);
    radiance = hit.rgb;
  }

  let outX = px * rays + rayIdx;
  textureStore(cascadeOutTex, vec2<i32>(i32(outX), i32(py)), vec4<f32>(radiance, 1.0));
}

// ---- final upsample / composite -----------------------------------------

@group(0) @binding(0) var<uniform> paramsF: Params;
@group(0) @binding(1) var sceneTexF: texture_2d<f32>;
@group(0) @binding(2) var sceneSamplerF: sampler;
@group(0) @binding(3) var cascade0Tex: texture_2d<f32>;

struct VOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };

@vertex
fn vsMain(@builtin(vertex_index) vi: u32) -> VOut {
  let positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
  );
  var out: VOut;
  let p = positions[vi];
  out.pos = vec4<f32>(p, 0.0, 1.0);
  out.uv = vec2<f32>(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return out;
}

// dot per probe, colored by cascade level — a visual read of the sparse grid
fn probeOverlayAt(pixel: vec2<f32>) -> vec3<f32> {
  var c = vec3<f32>(0.0);
  let levels = i32(paramsF.cascadeCnt);
  for (var i = 0; i < levels; i = i + 1) {
    let spacing = paramsF.probeSpacing0 * pow(2.0, f32(i));
    let center = (floor(pixel / spacing) + 0.5) * spacing;
    let d = length(pixel - center);
    let r = clamp(spacing * 0.14, 1.2, 8.0);
    if (d < r) {
      let hue = f32(i) / max(f32(levels - 1), 1.0);
      let col = 0.55 + 0.45 * cos(6.28318 * (hue + vec3<f32>(0.0, 0.33, 0.67)));
      c = mix(c, col, 1.0 - smoothstep(0.0, r, d));
    }
  }
  return c;
}

@fragment
fn fsMain(in: VOut) -> @location(0) vec4<f32> {
  let dims = paramsF.sceneSize;
  let pixel = in.uv * dims;
  let spacing = paramsF.probeSpacing0;
  let rays = u32(paramsF.raysBase);
  let probesX = i32(ceil(dims.x / spacing));
  let probesY = i32(ceil(dims.y / spacing));

  let taps = bilinearProbeTaps(pixel / spacing, probesX, probesY);
  var result = vec3<f32>(0.0);
  for (var i = 0; i < 4; i = i + 1) {
    var probeRadiance = vec3<f32>(0.0);
    for (var r: u32 = 0; r < rays; r = r + 1) {
      let sx = u32(taps.nx[i]) * rays + r;
      probeRadiance += textureLoad(cascade0Tex, vec2<i32>(i32(sx), taps.ny[i]), 0).rgb;
    }
    result += (probeRadiance / f32(rays)) * taps.w[i];
  }

  let sceneSample = textureSampleLevel(sceneTexF, sceneSamplerF, in.uv, 0.0);
  var finalColor = mix(result, sceneSample.rgb, sceneSample.a);

  if (paramsF.probeOverlay > 0.5) {
    let dots = probeOverlayAt(pixel);
    finalColor = mix(finalColor, dots, 0.85);
  }

  let exposed = finalColor * paramsF.exposure;
  let tonemapped = exposed / (exposed + vec3<f32>(1.0));
  return vec4<f32>(tonemapped, 1.0);
}

// ---- moving light blobs (instanced quads) --------------------------------

struct LightParams { dims: vec2<f32>, pad0: f32, pad1: f32 };

@group(0) @binding(0) var<uniform> lp: LightParams;
@group(0) @binding(1) var<storage, read> lightsBuf: array<vec4<f32>>;

struct LVOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>, @location(1) color: vec3<f32> };

@vertex
fn vsLight(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> LVOut {
  let base = iid * 2u;
  let posRadius = lightsBuf[base];
  let color = lightsBuf[base + 1u];
  let corner = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
  );
  let c = corner[vid];
  let world = posRadius.xy + c * posRadius.z;
  let ndc = vec2<f32>((world.x / lp.dims.x) * 2.0 - 1.0, 1.0 - (world.y / lp.dims.y) * 2.0);
  var o: LVOut;
  o.pos = vec4<f32>(ndc, 0.0, 1.0);
  o.uv = c;
  o.color = color.xyz;
  return o;
}

@fragment
fn fsLight(in: LVOut) -> @location(0) vec4<f32> {
  if (length(in.uv) > 1.0) { discard; }
  // bouncers are pure lights: they emit, they do not occlude (alpha 0).
  return vec4<f32>(in.color, 0.0);
}
