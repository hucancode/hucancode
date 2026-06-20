// Ground-plane grid. WGSL port of webgl/shaders/grid.{vert,frag}.glsl.
// Procedural major/minor lines with fog + camera-depth falloff + radial wipe.
// Premultiplied output.

struct Uni {
  uViewProj: mat4x4<f32>,
  uExt: f32,
  uZ: f32,
  uStep: f32,
  uMinorDiv: f32,
  uOpacity: f32,
  uReveal: f32,
  uRevealMinor: f32,
  uInkColor: vec3<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

const MINOR_DIM: f32 = 0.45;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vXY: vec2<f32>,
  @location(1) vDepth: f32,
};

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> VsOut {
  var C = array<vec2<f32>, 4>(vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0));
  let ext = u.uExt;
  let z = u.uZ;
  let c = C[vid];
  let world = vec3(c.x * ext, c.y * ext, z);
  let clip = u.uViewProj * vec4(world, 1.0);
  var o: VsOut;
  o.vXY = world.xy;
  o.vDepth = clip.w;
  o.pos = clip;
  return o;
}

fn lineCoverage(vXY: vec2<f32>, step: f32, halfCap: f32) -> f32 {
  let uv = vXY / step;
  let deriv = fwidth(uv) + 1e-5;
  let g = vec2(0.5) - abs(fract(uv) - 0.5);
  let pix = g / deriv;
  let lp = min(pix.x, pix.y);
  let density = max(deriv.x, deriv.y);
  let halfPx = clamp(halfCap / density, 0.0, halfCap * 0.2);
  let core = 1.0 - smoothstep(halfPx, halfPx + 1.0, lp);
  let fade = 1.0 - smoothstep(0.1, 1.2, density);
  return core * fade;
}

fn revealMask(reveal: f32, dist: f32, ext: f32) -> f32 {
  let r = reveal * ext;
  return 1.0 - smoothstep(r - 1.5, r, dist);
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let ext = u.uExt;
  let step = u.uStep;
  let minorDiv = u.uMinorDiv;
  let opacity = u.uOpacity;
  let reveal = u.uReveal;
  let revealMinor = u.uRevealMinor;
  let inkColor = u.uInkColor;

  let dist = length(in.vXY);

  let major = lineCoverage(in.vXY, step, 0.05) * revealMask(reveal, dist, ext);
  let minorStep = step / max(minorDiv, 1.0);
  let minor = lineCoverage(in.vXY, minorStep, 0.03) * MINOR_DIM * revealMask(revealMinor, dist, ext);

  let lines = max(major, minor);

  let fog = 1.0 - smoothstep(ext * 0.3, ext, dist);
  let camFade = 1.0 - smoothstep(0.0, 8.0, in.vDepth);

  let a = lines * fog * camFade * opacity;
  return vec4(inkColor * a, a);
}
