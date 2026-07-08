// 3D dragon path-deform + dim Phong.
// The straight mesh aligned along +X is bent onto the path by sampling two
// adjacent precomputed frame matrices (from the frames DATA TEXTURE) and lerping.

struct Uni {
  uViewProj: mat4x4<f32>,
  uN: f32,
  uPathLen: f32,
  uBodyLen: f32,
  uHeadOffset: f32,
  uGirth: f32,
  uOpacity: f32,
  uLightBoost: f32,
  uAlbedo: vec3<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;
@group(0) @binding(1) var framesTex: texture_2d<f32>;

const LIGHT_DIR: vec3<f32> = vec3<f32>(0.40, 0.70, 0.58);
const LIGHT_COL: vec3<f32> = vec3<f32>(1.0, 0.97, 0.90);
const AMBIENT: f32 = 0.14;
const SPEC_POW: f32 = 24.0;
const SPEC_INT: f32 = 0.4;

fn fmod(x: f32, y: f32) -> f32 { return x - y * floor(x / y); }

fn fetchFrame(i: i32) -> mat4x4<f32> {
  return mat4x4<f32>(
    textureLoad(framesTex, vec2<i32>(0, i), 0),
    textureLoad(framesTex, vec2<i32>(1, i), 0),
    textureLoad(framesTex, vec2<i32>(2, i), 0),
    textureLoad(framesTex, vec2<i32>(3, i), 0));
}

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vNormal: vec3<f32>,
};

@vertex
fn vs(@location(0) aPos: vec3<f32>, @location(1) aNormal: vec3<f32>) -> VsOut {
  let N = u.uN;
  let pathLen = u.uPathLen;
  let bodyLen = u.uBodyLen;
  let headOffset = u.uHeadOffset;
  let girth = u.uGirth;

  let uu = (aPos.x * bodyLen + headOffset) / pathLen * N + N;
  let lo = i32(fmod(floor(uu), N));
  let hi = i32(fmod(ceil(uu), N));
  let k = fract(uu);
  let Mlo = fetchFrame(lo);
  let Mhi = fetchFrame(hi);
  let p = vec4(0.0, aPos.y * girth, aPos.z * girth, 1.0);
  let world = mix(Mlo * p, Mhi * p, k);

  var o: VsOut;
  o.pos = u.uViewProj * world;
  let nrm = vec4(aNormal, 0.0);
  o.vNormal = normalize(mix((Mlo * nrm).xyz, (Mhi * nrm).xyz, k));
  return o;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let opacity = u.uOpacity;
  let lightBoost = u.uLightBoost;
  let albedo = u.uAlbedo;

  let N = normalize(in.vNormal);
  let L = normalize(LIGHT_DIR);
  let V = vec3(0.0, 0.0, 1.0);

  let diff = abs(dot(N, L));
  let H = normalize(L + V);
  let spec = pow(max(dot(N, H), 0.0), SPEC_POW) * SPEC_INT;
  let color = (albedo * (AMBIENT + diff) * LIGHT_COL + spec * LIGHT_COL) * lightBoost;

  return vec4(color, opacity);
}
