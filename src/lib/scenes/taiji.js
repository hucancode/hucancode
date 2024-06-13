import * as THREE from "three";
import anime from "animejs";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import {
  TAIJI_VERTEX_SHADER,
  TAIJI_FRAGMENT_SHADER,
  BACKGROUND_VERTEX_SHADER,
  BACKGROUND_FRAGMENT_SHADER,
  BAGUA_VERTEX_SHADER,
  BAGUA_FRAGMENT_SHADER,
} from "./taiji-shaders";

let scene, camera, renderer, controls;
let taiji;
let bagua;
let background;
const clock = new THREE.Clock();
var time = 0;

const CANVAS_ID = "taiji";
let use_camera_control = true;
const TAIJI_ROTATION_CIRCLE = 23000;
const BAGUA_ROTATION_CIRCLE = 43000;

export function setCameraControl(use) {
  use_camera_control = use;
  rebuildOrbitControl();
}

function makeBackground() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
    },
    vertexShader: BACKGROUND_VERTEX_SHADER,
    fragmentShader: BACKGROUND_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new THREE.PlaneGeometry(18, 18);
  const ret = new THREE.Mesh(geometry, material);
  ret.rotation.x = -Math.PI / 2;
  ret.position.y = -2;
  return ret;
}

function makeTaiji() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      alpha: { value: 1.0 },
      color1: { value: new THREE.Color(1, 1, 1) },
      color2: { value: new THREE.Color(0, 0, 0) },
    },
    vertexShader: TAIJI_VERTEX_SHADER,
    fragmentShader: TAIJI_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const ret = new THREE.Mesh(geometry, material);
  ret.scale.x = ret.scale.y = 9;
  ret.rotation.x = -Math.PI / 2;
  return ret;
}

function makeBagua() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      alpha: { value: 1.0 },
    },
    vertexShader: BAGUA_VERTEX_SHADER,
    fragmentShader: BAGUA_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new THREE.PlaneGeometry(35, 35);
  const ret = new THREE.Mesh(geometry, material);
  ret.scale.x = ret.scale.y = 1;
  ret.rotation.x = -Math.PI / 2;
  ret.position.y = -0.01;
  return ret;
}

function setupObject() {
  // const axesHelper = new THREE.AxesHelper(5);
  // scene.add(axesHelper);
  taiji = makeTaiji();
  taiji.material.uniforms.alpha.value = 0.9;
  scene.add(taiji);
  bagua = makeBagua();
  scene.add(bagua);
  background = makeBackground();
  scene.add(background);
  anime({
    targets: taiji.rotation,
    z: Math.PI * 2,
    duration: TAIJI_ROTATION_CIRCLE,
    easing: "linear",
    loop: true,
  });
}

function setupCamera(w, h) {
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
  scene = new THREE.Scene();
  camera.position.set(0, 16, 16);
  rebuildOrbitControl();
}

function rebuildOrbitControl() {
  if (!use_camera_control) {
    controls = null;
    return;
  }
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  //controls.enablePan = false;
  controls.minDistance = 10; // the minimum distance the camera must have from center
  controls.maxDistance = 100; // the maximum distance the camera must have from center
  //controls.update();
  controls.maxPolarAngle = controls.minPolarAngle = Math.PI * 0.25;
}

export function animateCamera(t) {
  // rotate camera around camera target for an amount based on t
  if (camera) {
    let distance = 25 * t + 2;
    if (camera.distance === undefined) {
      camera.distance = camera.position.length();
    }
    anime({
      targets: camera,
      distance: distance,
      duration: 1000,
      update: () => {
        camera.position.setLength(camera.distance);
        camera.lookAt(0, 0, 0);
      },
      onComplete: () => {
        if (t >= 0.9) {
          controls.enableRotate = true;
          controls.autoRotate = true;
        }
      },
    });
  }
}
function init() {
  const canvas = document.getElementById(CANVAS_ID);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight; //w * ASPECT_RATIO;
  renderer = new THREE.WebGLRenderer({
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
    Math.random() * 0.2 + 0.8
  );
  particle.material.uniforms.color2.value.setHSL(
    Math.random(),
    Math.random(),
    Math.random() * 0.2
  );
  const animation = anime.timeline({
    duration: 1500,
    easing: "easeOutExpo",
    complete: () => {
      particle.removeFromParent();
    },
  });
  animation
    .add(
      {
        targets: particle.rotation,
        z: Math.PI * 6,
      },
      0
    )
    .add(
      {
        targets: particle.position,
        y: Math.random(), // avoid z-fighting
      },
      0
    )
    .add(
      {
        targets: particle.scale,
        easing: "easeInOutQuad",
        x: 22,
        y: 22,
      },
      400
    )
    .add(
      {
        targets: particle.material.uniforms.alpha,
        easing: "easeInOutQuad",
        value: 0,
      },
      100
    );
  scene.add(particle);
  animation.play();
}

export { CANVAS_ID, init, destroy, render, playAnimation };
