#version 300 es
precision highp float;
#define EPSILON 0.01
#define BIG_CIRCLE_RADIUS 0.4
#define SMOOTH(t, x) smoothstep(t - EPSILON*0.5, t + EPSILON*0.5, x)
#define WHITE_CIRCLE(r, o) smoothstep(r + EPSILON*0.5, r - EPSILON*0.5, length(uv - o))
#define BLACK_CIRCLE(r, o) smoothstep(r - EPSILON*0.5, r + EPSILON*0.5, length(uv - o))

uniform float alpha;
uniform vec3 color1;
uniform vec3 color2;
uniform float uStroke;
uniform float uDot;
in vec2 vUV;
out vec4 fragColor;

void main() {
    float v = 0.0;
    vec2 uv = vUV * 2.0 - 1.0;
    vec2 center = vec2(0.0);
    vec2 centerTop = center + vec2(0.0, BIG_CIRCLE_RADIUS);
    vec2 centerBottom = center + vec2(0.0, -BIG_CIRCLE_RADIUS);
    v += WHITE_CIRCLE(BIG_CIRCLE_RADIUS * 2.0, center) * SMOOTH(0.0, uv.x);
    v += WHITE_CIRCLE(BIG_CIRCLE_RADIUS, centerTop);
    v *= BLACK_CIRCLE(BIG_CIRCLE_RADIUS, centerBottom);
    v += WHITE_CIRCLE(uDot, centerBottom);
    v *= BLACK_CIRCLE(uDot, centerTop);
    v = clamp(v, 0.0, 1.0);
    float mask = WHITE_CIRCLE(BIG_CIRCLE_RADIUS * 2.0 + uStroke, center);
    fragColor = vec4(color1 * v + color2 * (1.0 - v), mask * alpha);
}
