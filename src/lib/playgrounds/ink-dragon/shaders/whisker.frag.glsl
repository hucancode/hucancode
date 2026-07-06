#version 300 es
precision highp float;
uniform vec4 uBrushColor;

out vec4 fragColor;

void main() {
    fragColor = uBrushColor;
}
