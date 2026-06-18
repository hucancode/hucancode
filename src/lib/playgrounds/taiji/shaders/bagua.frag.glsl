#version 300 es
precision highp float;
#define PI 3.14159265359
#define PIX2 6.28318530718
#define EPSILON 0.01
#define BAR_HEIGHT 0.07
#define BAR_MARGIN 0.02
#define CIRCLE_RADIUS 1.1

#define RANGE(l,r,x) smoothstep(l, l + EPSILON, x) * smoothstep(r + EPSILON, r, x)
#define RANGE_INVERT(l,r,x) smoothstep(l, l + EPSILON, x) + smoothstep(r + EPSILON, r, x)

uniform float time;
uniform float alpha;
uniform float uBitCount; // bars per trigram -> 2^bitCount stems around the ring
in vec2 vUV;
out vec4 fragColor;

mat2 rotateMat(float angle) {
    return mat2(cos(angle), -sin(angle),
        sin(angle), cos(angle));
}

// bar = return a full bar for x = 1, a broken bar for x = 0
float bar(int x, vec2 uv, float barWidth) {
    float cut = barWidth * 0.1;
    float ret = RANGE(-barWidth * 0.5, barWidth * 0.5, uv.x) *
            RANGE(-BAR_HEIGHT * 0.5, BAR_HEIGHT * 0.5, uv.y);
    if (x == 0) {
        ret *= RANGE_INVERT(cut, -cut, uv.x);
    }
    return ret;
}

// stem = bar x bitCount
float stem(int x, vec2 uv, int bitCount, float barWidth) {
    int bit = int(0.5 - (uv.y + CIRCLE_RADIUS * 0.5) / (BAR_HEIGHT + BAR_MARGIN));
    if (bit < 0 || bit >= bitCount) {
        return 0.0;
    }
    int k = (x >> bit) & 1;
    vec2 offset = vec2(0.0, CIRCLE_RADIUS * 0.5 + float(bit) * (BAR_HEIGHT + BAR_MARGIN));
    return bar(k, uv + offset, barWidth);
}

// bagua = stem x (2^bitCount)
float bagua(vec2 uv, int bitCount, float barWidth) {
    int n = (1 << bitCount);
    float i = round(float(n) * (0.75 - atan(uv.y, uv.x) / PIX2));
    return stem(int(i), uv * rotateMat(i * PIX2 / float(n)), bitCount, barWidth);
}

void main() {
    int bitCount = int(uBitCount + 0.5);
    vec2 uv = vUV * 2.0 - 1.0;
    float barWidth = PI / float(1 << bitCount);
    // scale uv to fit the bagua
    uv *= CIRCLE_RADIUS + (BAR_HEIGHT + BAR_MARGIN) * float(bitCount * 2);
    float v = bagua(uv, bitCount, barWidth);
    fragColor = vec4(v, v, v, alpha * v);
}
