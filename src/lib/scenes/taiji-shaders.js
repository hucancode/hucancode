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
#define EPSILON 0.01
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
    vec2 centerTop = center + vec2(0.0, BIG_CIRCLE_RADIUS/2.0);
    vec2 centerBottom = center + vec2(0.0, -BIG_CIRCLE_RADIUS/2.0);
    float bigCircle = smoothstep(BIG_CIRCLE_RADIUS + EPSILON, BIG_CIRCLE_RADIUS, length(vUV-center));
    float rightHalf = smoothstep(0.5,0.51, vUV.x);
    float halfCircle = bigCircle*rightHalf;
    v += halfCircle;
    float topCircle = smoothstep(BIG_CIRCLE_RADIUS/2.0 + EPSILON, BIG_CIRCLE_RADIUS/2.0, length(vUV-centerTop));
    v += topCircle;
    float bottomCircle = smoothstep(BIG_CIRCLE_RADIUS/2.0,BIG_CIRCLE_RADIUS/2.0 + EPSILON, length(vUV-centerBottom));
    v *= bottomCircle;
    float bottomDot = smoothstep(SMALL_CIRCLE_RADIUS + EPSILON, SMALL_CIRCLE_RADIUS, length(vUV-centerBottom));
    v += bottomDot;
    float topDot = smoothstep(SMALL_CIRCLE_RADIUS,SMALL_CIRCLE_RADIUS + EPSILON, length(vUV-centerTop));
    v *= topDot;
    v = clamp(v, 0.0, 1.0);
    float mask = smoothstep(BIG_CIRCLE_RADIUS +STROKE_WIDTH+EPSILON, BIG_CIRCLE_RADIUS+STROKE_WIDTH, length(vUV-center));
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
    float circle = 1.0-smoothstep(0.3,1.5, d);
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

export const BAGUA_VERTEX_SHADER = `
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
export const BAGUA_FRAGMENT_SHADER = `
#define EPSILON 0.01
#define BAR_WIDTH 0.3
#define BAR_HEIGHT 0.07
#define BAR_MARGIN 0.02
#define CIRCLE_RADIUS 1.1
#define CUT_WIDTH 0.05
#define PI2 6.28318530718
#define PI 3.14159265359

uniform float time;
uniform float alpha;
varying vec2 vUV;

vec2 rotate2D(vec2 v, float angle) {
    v = mat2(cos(angle),-sin(angle),
            sin(angle),cos(angle)) * v;
    return v;
}

float bar(int x, vec2 uv) {
    float ret = smoothstep(-BAR_WIDTH*0.5, -BAR_WIDTH*0.5+EPSILON, uv.x);
    ret *= smoothstep(BAR_WIDTH*0.5+EPSILON, BAR_WIDTH*0.5, uv.x);
    ret *= smoothstep(-BAR_HEIGHT*0.5, -BAR_HEIGHT*0.5+EPSILON, uv.y);
    ret *= smoothstep(BAR_HEIGHT*0.5+EPSILON, BAR_HEIGHT*0.5, uv.y);
    if(x == 0) {
        ret *= smoothstep(-CUT_WIDTH*0.5+EPSILON, -CUT_WIDTH*0.5, uv.x) + 
            smoothstep(CUT_WIDTH*0.5, CUT_WIDTH*0.5+EPSILON, uv.x);
    }
    return ret;
}

float stem(int x, vec2 uv) {
    float ret = 0.0;
    for(int bit = 0;bit<3;bit++) {
        int k = (x>>bit)&1;
        vec2 offset = vec2(0.0, CIRCLE_RADIUS*0.5+float(bit)*(BAR_HEIGHT+BAR_MARGIN));
        ret += bar(k, uv + offset);
    }
    return ret;
}

float bagua(vec2 uv) {
    float ret = 0.0;
    for(int i = 0;i<8;i++) {
        ret += stem(i, rotate2D(uv, float(i)*PI2/8.0));
    }
    clamp(ret, 0.0, 1.0);
    return ret;
}

void main()
{
    vec2 uv = vUV*2.0 - vec2(1.0,1.0);
    // scale uv to fit the bagua
    uv *= CIRCLE_RADIUS+(BAR_HEIGHT+BAR_MARGIN)*6.0;
    float v = bagua(uv);
    gl_FragColor = vec4(v, v, v, alpha*v);
}`;
