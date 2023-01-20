export const TAIJI_VERTEX_SHADER = `
// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;
// attribute vec3 position;
// attribute vec2 uv;
varying vec2 vUV;
void main() {
    vUV = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
export const TAIJI_FRAGMENT_SHADER = `
#define BIG_CIRCLE_RADIUS 0.4
#define SMALL_CIRCLE_RADIUS 0.07
#define STROKE_WIDTH 0.015

uniform float alpha;
uniform vec3 color1;
uniform vec3 color2;
varying vec2 vUV;

void main() {
    float v = 0.0;
    vec2 center = vec2(0.5);
    vec2 centerTop = vec2(0.5, 0.5+BIG_CIRCLE_RADIUS/2.0);
    vec2 centerBottom = vec2(0.5, 0.5-BIG_CIRCLE_RADIUS/2.0);
    float bigCircle = 1.0-smoothstep(BIG_CIRCLE_RADIUS,BIG_CIRCLE_RADIUS +0.01, length(vUV-center));
    float rightHalf = smoothstep(0.5,0.51, vUV.x);
    float halfCircle = bigCircle*rightHalf;
    v += halfCircle;
    float topCircle = 1.0-smoothstep(BIG_CIRCLE_RADIUS/2.0,BIG_CIRCLE_RADIUS/2.0 + 0.01, length(vUV-centerTop));
    v += topCircle;
    float bottomCircle = smoothstep(BIG_CIRCLE_RADIUS/2.0,BIG_CIRCLE_RADIUS/2.0 + 0.01, length(vUV-centerBottom));
    v *= bottomCircle;
    float bottomDot = 1.0 - smoothstep(SMALL_CIRCLE_RADIUS,SMALL_CIRCLE_RADIUS+0.01, length(vUV-centerBottom));
    v += bottomDot;
    float topDot = smoothstep(SMALL_CIRCLE_RADIUS,SMALL_CIRCLE_RADIUS+0.01, length(vUV-centerTop));
    v *= topDot;
    v = clamp(v, 0.0, 1.0);
    float mask = 1.0-smoothstep(BIG_CIRCLE_RADIUS+STROKE_WIDTH,BIG_CIRCLE_RADIUS +STROKE_WIDTH+0.03, length(vUV-center));
    float a = mask * alpha;
    gl_FragColor = vec4(color1 * v + color2 * (1.0-v), a);
}
`;

export const BACKGROUND_VERTEX_SHADER = `
// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;
// attribute vec3 position;
// attribute vec2 uv;
varying vec2 vUV;
void main() {
    vUV = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
export const BACKGROUND_FRAGMENT_SHADER = `
uniform float time;
uniform float alpha;
varying vec2 vUV;

float random (in vec2 _st) {
    return fract(sin(dot(_st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}

// Based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float noise (in vec2 _st) {
    vec2 i = floor(_st);
    vec2 f = fract(_st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}

#define NUM_OCTAVES 5

float fbm ( in vec2 _st) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    // Rotate to reduce axial bias
    mat2 rot = mat2(cos(0.5), sin(0.5),
                    -sin(0.5), cos(0.50));
    for (int i = 0; i < NUM_OCTAVES; ++i) {
        v += a * noise(_st);
        _st = rot * _st * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 st = vUV*3.0;
    float d = length(st - vec2(1.5));
    float circle = 1.0-smoothstep(0.5,1.5, d);
    // st += st * abs(sin(time*0.1)*3.0);
    vec3 color = vec3(0.0);

    vec2 q = vec2(0.);
    q.x = fbm( st + 0.00*time);
    q.y = fbm( st + vec2(1.0));

    vec2 r = vec2(0.);
    r.x = fbm( st + 1.0*q + vec2(1.7,9.2)+ 0.15*time );
    r.y = fbm( st + 1.0*q + vec2(8.3,2.8)+ 0.126*time);

    float f = fbm(st+r);

    color = mix(vec3(0.101961,0.619608,0.666667),
                vec3(0.666667,0.666667,0.498039),
                clamp((f*f)*4.0,0.0,1.0));

    color = mix(color,
                vec3(0,0,0.164706),
                clamp(length(q),0.0,1.0));

    color = mix(color,
                vec3(0.666667,1,1),
                clamp(length(r.x),0.0,1.0));
    gl_FragColor = vec4((f*f*f+.6*f*f+.5*f)*color,circle);
}
`;
