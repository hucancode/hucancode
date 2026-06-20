// 3D dragon path-deform + dim Phong. WGSL twin of the inline GLSL VERT/FRAG in
// index.js. The straight mesh (x normalised to [0,1]) is bent onto the closed
// Catmull-Rom flight path by sampling two adjacent precomputed frame matrices
// (from the frames DATA TEXTURE, rgba32float, one column-major mat4 / row) and
// lerping. uViewProj is the engine-corrected camera matrix (clip z remapped on
// WebGPU; see device.correctViewProj).
//
// Uniform struct fields MUST match the `uniforms` list in index.js, in order.

struct Uni {
  uN: f32,
  uPathLen: f32,
  uBodyLen: f32,
  uHeadOffset: f32,
  uGirth: f32,
  uViewProj: mat4x4<f32>,
  uLightDir: vec3<f32>,
  uLightColor: vec3<f32>,
  uAmbient: vec3<f32>,
  uBaseColor: vec3<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;
@group(0) @binding(1) var uFrames: texture_2d<f32>;

fn fmod(x: f32, y: f32) -> f32 { return x - y * floor(x / y); }

fn fetchFrame(i: i32) -> mat4x4<f32> {
  return mat4x4<f32>(
    textureLoad(uFrames, vec2<i32>(0, i), 0),
    textureLoad(uFrames, vec2<i32>(1, i), 0),
    textureLoad(uFrames, vec2<i32>(2, i), 0),
    textureLoad(uFrames, vec2<i32>(3, i), 0));
}

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vN: vec3<f32>,
};

@vertex
fn vs(@location(0) position: vec3<f32>, @location(1) normal: vec3<f32>) -> VsOut {
  let N = u.uN;
  let uu = (position.x * u.uBodyLen + u.uHeadOffset) / u.uPathLen * N + N;
  let lo = i32(fmod(floor(uu), N));
  let hi = i32(fmod(ceil(uu), N));
  let k = fract(uu);
  let Mlo = fetchFrame(lo);
  let Mhi = fetchFrame(hi);
  let p = vec4(0.0, position.y * u.uGirth, position.z * u.uGirth, 1.0);
  let world = mix(Mlo * p, Mhi * p, k);

  var o: VsOut;
  o.pos = u.uViewProj * world;
  let nr = vec4(normal, 0.0);
  o.vN = normalize(mix((Mlo * nr).xyz, (Mhi * nr).xyz, k));
  return o;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let N = normalize(in.vN);
  let d = max(dot(N, normalize(u.uLightDir)), 0.0);
  let c = u.uBaseColor * (u.uAmbient + d * u.uLightColor);
  return vec4(c, 1.0);
}
