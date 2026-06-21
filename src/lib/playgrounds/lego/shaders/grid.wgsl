// Ground-plane grid on the XZ plane at height uY. Procedural major/minor lines
// with distance fog + camera-depth falloff. Premultiplied output.

struct Uni {
  uViewProj: mat4x4<f32>,
  uExt: f32,
  uY: f32,
  uStep: f32,
  uMinorDiv: f32,
  uOpacity: f32,
  uColor: vec3<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

const MINOR_DIM: f32 = 0.4;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vXZ: vec2<f32>,
  @location(1) vDepth: f32,
};

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> VsOut {
  var C = array<vec2<f32>, 4>(vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0));
  let c = C[vid];
  let world = vec3(c.x * u.uExt, u.uY, c.y * u.uExt);
  let clip = u.uViewProj * vec4(world, 1.0);
  var o: VsOut;
  o.vXZ = world.xz;
  o.vDepth = clip.w;
  o.pos = clip;
  return o;
}

fn lineCoverage(vXZ: vec2<f32>, step: f32, halfCap: f32) -> f32 {
  let uv = vXZ / step;
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

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let dist = length(in.vXZ);
  let major = lineCoverage(in.vXZ, u.uStep, 0.05);
  let minor = lineCoverage(in.vXZ, u.uStep / max(u.uMinorDiv, 1.0), 0.03) * MINOR_DIM;
  let lines = max(major, minor);

  let fog = 1.0 - smoothstep(u.uExt * 0.35, u.uExt, dist);

  let a = lines * fog * u.uOpacity;
  return vec4(u.uColor * a, a);
}
