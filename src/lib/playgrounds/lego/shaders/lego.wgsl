// Fields MUST match the `uniforms` list order in index.js.
struct Uni {
  uViewProj: mat4x4<f32>,
  uModel: mat4x4<f32>,
  uColor: vec3<f32>,
  uLightPos: vec3<f32>,
  uViewPos: vec3<f32>,
};
@group(0) @binding(0) var<uniform> u: Uni;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vN: vec3<f32>,
  @location(1) vW: vec3<f32>,
};

@vertex
fn vs(@location(0) position: vec3<f32>, @location(1) normal: vec3<f32>) -> VsOut {
  var o: VsOut;
  let world = u.uModel * vec4(position, 1.0);
  o.vN = (u.uModel * vec4(normal, 0.0)).xyz;
  o.vW = world.xyz;
  o.pos = u.uViewProj * world;
  return o;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let N = normalize(in.vN);
  let L = normalize(u.uLightPos - in.vW);
  let V = normalize(u.uViewPos - in.vW);
  let H = normalize(L + V);
  let diff = max(dot(N, L), 0.0);
  let spec = pow(max(dot(N, H), 0.0), 24.0) * 0.2;   // gentle highlight
  let col = u.uColor * (0.35 + 0.65 * diff) + vec3(spec);
  return vec4(col, 1.0);
}
