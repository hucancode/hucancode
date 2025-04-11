import { animate, createTimeline } from "animejs";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import VERTEX_SHADER from "$lib/scenes/shaders/basic.vert.glsl?raw";
import TAIJI_FRAGMENT_SHADER from "$lib/scenes/shaders/taiji.frag.glsl?raw";
import CLOUD_FRAGMENT_SHADER from "$lib/scenes/shaders/cloud.frag.glsl?raw";
import BAGUA_FRAGMENT_SHADER from "$lib/scenes/shaders/bagua.frag.glsl?raw";
import {
  Clock,
  Color,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";

let scene, camera, renderer, controls;
let taiji;
let bagua;
let background;
const clock = new Clock();
var time = 0;

const CANVAS_ID = "taiji";
const USE_CAMERA_CONTROL = true;
const TAIJI_ROTATION_CIRCLE = 23000;
const BAGUA_ROTATION_CIRCLE = 43000;

function makeBackground() {
  const material = new ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      alpha: { value: 1.0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: CLOUD_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new PlaneGeometry(18, 18);
  const ret = new Mesh(geometry, material);
  ret.rotation.x = -Math.PI / 2;
  ret.position.y = -2;
  return ret;
}

function makeTaiji() {
  const material = new ShaderMaterial({
    uniforms: {
      alpha: { value: 1.0 },
      color1: { value: new Color(1, 1, 1) },
      color2: { value: new Color(0, 0, 0) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: TAIJI_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new PlaneGeometry(1, 1);
  const ret = new Mesh(geometry, material);
  ret.scale.x = ret.scale.y = 9;
  ret.rotation.x = -Math.PI / 2;
  return ret;
}

function makeBagua() {
  const material = new ShaderMaterial({
    uniforms: {
      alpha: { value: 1.0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: BAGUA_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new PlaneGeometry(35, 35);
  const ret = new Mesh(geometry, material);
  ret.scale.x = ret.scale.y = 1;
  ret.rotation.x = -Math.PI / 2;
  ret.position.y = -0.01;
  return ret;
}

function setupObject() {
  // const axesHelper = new AxesHelper(5);
  // scene.add(axesHelper);
  taiji = makeTaiji();
  taiji.material.uniforms.alpha.value = 0.9;
  scene.add(taiji);
  bagua = makeBagua();
  scene.add(bagua);
  background = makeBackground();
  scene.add(background);
  animate(taiji.rotation, {
    z: Math.PI * 2,
    duration: TAIJI_ROTATION_CIRCLE,
    easing: eases.linear(),
    loop: true,
  });
}

function setupCamera(w, h) {
  camera = new PerspectiveCamera(45, w / h, 1, 2000);
  scene = new Scene();
  camera.position.set(0, 16, 16);
  rebuildOrbitControl();
}

function rebuildOrbitControl() {
  if (!USE_CAMERA_CONTROL) {
    return;
  }
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  //controls.enablePan = false;
  controls.minDistance = 4; // the minimum distance the camera must have from center
  controls.maxDistance = 30; // the maximum distance the camera must have from center
  //controls.update();
  controls.maxPolarAngle = controls.minPolarAngle = Math.PI * 0.25;
  controls.enableRotate = true;
  controls.autoRotate = true;
}

function init() {
  const canvas = document.getElementById(CANVAS_ID);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight; //w * ASPECT_RATIO;
  renderer = new WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  if (scene != null) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    rebuildOrbitControl();
    return;
  }
  setupCamera(w, h);
  setupObject();
  window.addEventListener("resize", onWindowResize);
}

function destroy() {
  renderer.dispose();
}

function onWindowResize() {
  const canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    return;
  }
  canvas.style = "";
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function render() {
  time += clock.getDelta();
  if (background) {
    background.material.uniforms.time.value = time * 4;
  }
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  if (controls) {
    controls.update();
  }
}
function playAnimation() {
  const particle = makeTaiji();
  particle.scale.x = particle.scale.y = 6;
  particle.position.y = 10;
  // use HSL to guaranteed 2 colors has acceptable contrast
  particle.material.uniforms.color1.value.setHSL(
    Math.random(),
    Math.random(),
    Math.random() * 0.2 + 0.8,
  );
  particle.material.uniforms.color2.value.setHSL(
    Math.random(),
    Math.random(),
    Math.random() * 0.2,
  );
  const animation = createTimeline({
    duration: 1500,
    easing: eases.outExpo,
    onComplete: () => {
      particle.removeFromParent();
    },
  });
  animation
    .add(
      {
        targets: particle.rotation,
        z: Math.PI * 6,
      },
      0,
    )
    .add(
      {
        targets: particle.position,
        y: Math.random(), // avoid z-fighting
      },
      0,
    )
    .add(
      {
        targets: particle.scale,
        easing: eases.inOutQuad,
        x: 22,
        y: 22,
      },
      400,
    )
    .add(
      {
        targets: particle.material.uniforms.alpha,
        easing: eases.inOutQuad,
        value: 0,
      },
      100,
    );
  scene.add(particle);
  animation.play();
}

export { CANVAS_ID, init, destroy, render, playAnimation };
