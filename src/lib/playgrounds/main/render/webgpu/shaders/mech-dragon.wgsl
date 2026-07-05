// Instanced mech-dragon part shading. Geometry is a shared UNIT MESH; each
// instance carries its model matrix rows (3x vec4: linear row + translation in
// w), normal matrix rows (inverse-transpose, so non-uniform scale and
// mirroring shade correctly) and a color.
// Fields MUST match the `uniforms` list order in programs.js.
struct Uni {
  uViewProj: mat4x4<f32>,
  uLightPos: vec3<f32>,
  uViewPos: vec3<f32>,
  uOpacity: f32,
};
@group(0) @binding(0) var<uniform> u: Uni;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) vN: vec3<f32>,
  @location(1) vW: vec3<f32>,
  @location(2) vC: vec3<f32>,
  @location(3) vA: f32,
};

@vertex
fn vs(
  @location(0) aPos: vec3<f32>, @location(1) aNormal: vec3<f32>,
  @location(2) iM0: vec4<f32>, @location(3) iM1: vec4<f32>, @location(4) iM2: vec4<f32>,
  @location(5) iN0: vec4<f32>, @location(6) iN1: vec4<f32>, @location(7) iN2: vec4<f32>,
  @location(8) iColor: vec4<f32>,
) -> VsOut {
  var o: VsOut;
  let wp = vec3(
    dot(iM0.xyz, aPos) + iM0.w,
    dot(iM1.xyz, aPos) + iM1.w,
    dot(iM2.xyz, aPos) + iM2.w,
  );
  o.vN = vec3(dot(iN0.xyz, aNormal), dot(iN1.xyz, aNormal), dot(iN2.xyz, aNormal));
  o.vW = wp;
  o.vC = iColor.rgb;
  o.vA = iColor.a;
  o.pos = u.uViewProj * vec4(wp, 1.0);
  return o;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4<f32> {
  let N = normalize(in.vN);
  let L = normalize(u.uLightPos - in.vW);
  let V = normalize(u.uViewPos - in.vW);
  let H = normalize(L + V);
  let diff = max(dot(N, L), 0.0);
  let spec = pow(max(dot(N, H), 0.0), 32.0) * 0.25;
  let col = in.vC * (0.32 + 0.68 * diff) + vec3(spec);
  return vec4(col, u.uOpacity * in.vA);
}
