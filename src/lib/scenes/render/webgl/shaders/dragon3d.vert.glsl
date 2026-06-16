#version 300 es
precision highp float;

// 3D dragon path-deform vertex shader. Raw-WebGL2 port of
// flying-dragon/src/material/shader_dragon.wgsl (vs_main). The straight mesh is
// aligned along +X (x normalised to [0, bodyLen] in path units). x picks a
// position along the path; two adjacent precomputed frame matrices are sampled
// and interpolated; y,z carry the body cross-section.

in vec3 aPos;
in vec3 aNormal;

out vec3 vNormal; // world-space normal (for Phong)

uniform sampler2D uFrames; // RGBA32F, width=4 (mat4 columns), height=N
uniform float uN;          // frame count
uniform float uPathLen;    // total path arc length (path units)
uniform float uBodyLen;    // mesh length in path units (x is normalised [0,1])
uniform float uHeadOffset; // head position along path (path units), animated
uniform float uGirth;      // cross-section scale
uniform mat4  uViewProj;

mat4 fetchFrame(int i) {
    return mat4(
        texelFetch(uFrames, ivec2(0, i), 0),
        texelFetch(uFrames, ivec2(1, i), 0),
        texelFetch(uFrames, ivec2(2, i), 0),
        texelFetch(uFrames, ivec2(3, i), 0)
    );
}

void main() {
    float N = uN;
    float u = (aPos.x * uBodyLen + uHeadOffset) / uPathLen * N + N;
    int lo = int(mod(floor(u), N));
    int hi = int(mod(ceil(u),  N));
    float k = fract(u);
    mat4 Mlo = fetchFrame(lo);
    mat4 Mhi = fetchFrame(hi);
    vec4 p = vec4(0.0, aPos.yz * uGirth, 1.0);
    vec4 world = mix(Mlo * p, Mhi * p, k);
    gl_Position = uViewProj * world;

    // rotate the mesh normal by each frame's orthonormal basis, interpolate
    vec4 nrm = vec4(aNormal, 0.0);
    vNormal = normalize(mix((Mlo * nrm).xyz, (Mhi * nrm).xyz, k));
}
