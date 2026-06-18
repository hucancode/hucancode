#version 300 es
precision highp float;

// Solid paper colour + uniform paper-grain noise. Sits behind ink strokes
// so the strokes can render with straight alpha blending instead of an
// 'over' composite inside the stroke shader.

uniform float uAspect;
uniform vec4  uBgColor;

in vec2 vUV;

out vec4 fragColor;

float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
    vec2 world = vec2((vUV.x * 2.0 - 1.0) * uAspect, vUV.y * 2.0 - 1.0);
    float g = (rand(world) - 0.5) * 0.08 * uBgColor.a;
    vec3 c = clamp(uBgColor.rgb + g, 0.0, 1.0);
    fragColor = vec4(c, uBgColor.a);
}
