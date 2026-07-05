#version 300 es
// instanced mech-dragon part: per-instance model matrix rows (vec4 = linear
// row + translation in w), inverse-transpose normal rows, and a color
in vec3 aPos;
in vec3 aNormal;
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
    dot(iM0.xyz, aPos) + iM0.w,
    dot(iM1.xyz, aPos) + iM1.w,
    dot(iM2.xyz, aPos) + iM2.w
  );
  vN = vec3(dot(iN0.xyz, aNormal), dot(iN1.xyz, aNormal), dot(iN2.xyz, aNormal));
  vW = wp;
  vC = iColor.rgb;
  vA = iColor.a;
  gl_Position = uViewProj * vec4(wp, 1.0);
}
