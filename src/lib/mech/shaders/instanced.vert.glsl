#version 300 es
// instanced procedural part: per-instance model matrix rows (vec4 = linear
// row + translation in w), inverse-transpose normal rows, and a color
in vec3 position;
in vec3 normal;
in vec4 iM0;
in vec4 iM1;
in vec4 iM2;
in vec4 iN0;
in vec4 iN1;
in vec4 iN2;
in vec4 iColor;
uniform mat4 uViewProj;
out vec3 vN;
out vec3 vW;
out vec3 vC;
out float vA;
void main() {
  vec3 wp = vec3(
    dot(iM0.xyz, position) + iM0.w,
    dot(iM1.xyz, position) + iM1.w,
    dot(iM2.xyz, position) + iM2.w
  );
  vN = vec3(dot(iN0.xyz, normal), dot(iN1.xyz, normal), dot(iN2.xyz, normal));
  vW = wp;
  vC = iColor.rgb;
  vA = iColor.a;
  gl_Position = uViewProj * vec4(wp, 1.0);
}
