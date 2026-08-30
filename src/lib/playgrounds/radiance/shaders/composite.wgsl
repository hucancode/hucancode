// Radiance Cascades (2D)
// https://arxiv.org/abs/2408.14425

struct Params {
  sceneSize: vec2<f32>,
  probeSpacing0: f32,
  raysBase: f32,
  cascadeCnt: f32,
  exposure: f32,
  probeOverlay: f32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var sceneSampler: sampler;
@group(0) @binding(3) var cascade0: texture_2d<f32>;
@group(0) @binding(4) var lightTex: texture_2d<f32>;
@group(0) @binding(5) var lightSampler: sampler;

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

// dot per probe, colored by cascade level — a visual read of the sparse grid
fn probeOverlayAt(pixel: vec2<f32>) -> vec3<f32> {
  var c = vec3<f32>(0.0);
  let levels = i32(params.cascadeCnt);
  for (var i = 0; i < levels; i = i + 1) {
    let spacing = params.probeSpacing0 * pow(2.0, f32(i));
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
fn fs(in: VOut) -> @location(0) vec4<f32> {
  let dims = params.sceneSize;
  let pixel = in.uv * dims;
  let spacing = params.probeSpacing0;
  let rays = u32(params.raysBase);
  let probesX = i32(ceil(dims.x / spacing));
  let probesY = i32(ceil(dims.y / spacing));

  let taps = bilinearProbeTaps(pixel / spacing, probesX, probesY);
  var result = vec3<f32>(0.0);
  for (var i = 0; i < 4; i = i + 1) {
    var probeRadiance = vec3<f32>(0.0);
    for (var r: u32 = 0; r < rays; r = r + 1) {
      let sx = u32(taps.nx[i]) * rays + r;
      probeRadiance += textureLoad(cascade0, vec2<i32>(i32(sx), taps.ny[i]), 0).rgb;
    }
    result += (probeRadiance / f32(rays)) * taps.w[i];
  }

  // Painted scene (emission rgb / occlusion a) plus the moving-light buffer.
  // Occluders (scene.a) render their own surface color and must not show the
  // light buffer, so embers are only added as sprites where there is no wall.
  let scene = textureSampleLevel(sceneTex, sceneSampler, in.uv, 0.0);
  let light = textureSampleLevel(lightTex, lightSampler, in.uv, 0.0);
  var finalColor = mix(result, scene.rgb, scene.a) + light.rgb * (1.0 - scene.a);

  if (params.probeOverlay > 0.5) {
    let dots = probeOverlayAt(pixel);
    finalColor = mix(finalColor, dots, 0.85);
  }

  let exposed = finalColor * params.exposure;
  let tonemapped = exposed / (exposed + vec3<f32>(1.0));
  return vec4<f32>(tonemapped, 1.0);
}
