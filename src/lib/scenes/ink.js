import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from "three";
import VERTEX_SHADER from "$lib/scenes/shaders/basic.vert.glsl?raw";
import INK_FRAGMENT_SHADER from "$lib/scenes/shaders/ink.frag.glsl?raw";

let scene, camera, renderer, mesh;

const uniforms = {
  iResolution: { value: new Vector2(1, 1) },
  uRadius:     { value: 0.6 },
  uAngleStart: { value: 0.2 },
  uSweepAmt:   { value: 0.92 },
  uLineWidth:  { value: 0.3 },
  uClockwise:  { value: 0.0 },
  uTaper:      { value: 2.5 },
  uWobble:     { value: 0.25 },
  uStrands:    { value: 1.0 },
  uInkFlow:    { value: 1.0 },
  uWidthEnd:   { value: 1.0 },
  uWidthOffset: { value: 0.5 },
  uWidthRange:  { value: 1.0 },
  uWidthAnchor: { value: 0.5 },
  uCartesian:  { value: 0.0 },
  uBrushColor: { value: [0.0, 0.0, 0.0, 0.9] },
  uBgColor:    { value: [1.0, 1.0, 0.875, 1.0] },
};

export function init(canvas) {
  scene = new Scene();
  camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  resize(canvas.clientWidth, canvas.clientHeight);

  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: INK_FRAGMENT_SHADER,
    transparent: false,
  });
  mesh = new Mesh(new PlaneGeometry(2, 2), material);
  scene.add(mesh);
}

export function resize(w, h) {
  if (!renderer) return;
  renderer.setSize(w, h, false);
  uniforms.iResolution.value.set(w * window.devicePixelRatio, h * window.devicePixelRatio);
}

export function render() {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
}

export function setRadius(v)     { uniforms.uRadius.value = v; }
export function setAngleStart(v) { uniforms.uAngleStart.value = v; }
export function setSweepAmt(v)   { uniforms.uSweepAmt.value = v; }
export function setLineWidth(v)  { uniforms.uLineWidth.value = v; }
export function setClockwise(b)  { uniforms.uClockwise.value = b ? 1.0 : 0.0; }
export function setTaper(v)      { uniforms.uTaper.value = v; }
export function setWobble(v)     { uniforms.uWobble.value = v; }
export function setStrands(v)    { uniforms.uStrands.value = v; }
export function setInkFlow(v)    { uniforms.uInkFlow.value = v; }
export function setWidthEnd(v)   { uniforms.uWidthEnd.value = v; }
export function setWidthOffset(v) { uniforms.uWidthOffset.value = v; }
export function setWidthRange(v)  { uniforms.uWidthRange.value = v; }
export function setWidthAnchor(v) { uniforms.uWidthAnchor.value = v; }
export function setCartesian(b)  { uniforms.uCartesian.value = b ? 1.0 : 0.0; }

export function destroy() {
  if (mesh) {
    mesh.geometry.dispose();
    mesh.material.dispose();
    scene.remove(mesh);
    mesh = null;
  }
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
}
