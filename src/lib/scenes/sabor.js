import * as THREE from "three";
import { GLTFLoader } from "$lib/three/loaders/GLTFLoader.js";
import { OrbitControls } from "$lib/three/controls/OrbitControls";
import { loadModel, wait } from "$lib/utils.js";

let camera, scene, renderer, animator, controls;
let model;
let cameraPositionNear;
let cameraPositionFar;
let isZoomingIn;
let isZoomingOut;
const clock = new THREE.Clock();
const CANVAS_ID = "sabor";
const USE_CAMERA_CONTROL = true;
const ASPECT_RATIO = 0.75;
const USE_GROUND = false;

function onWindowResize() {
  let canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    return;
  }
  canvas.style = "";
  let w = canvas.clientWidth;
  let h = canvas.clientHeight; //w * ASPECT_RATIO;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
function setupCamera(w, h) {
  camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000);
  cameraPositionNear = new THREE.Vector3(2.5, 3, 2.5);
  cameraPositionFar = new THREE.Vector3(4, 6, 4);
  isZoomingIn = false;
  isZoomingOut = false;
  camera.position.copy(cameraPositionFar);
  camera.lookAt(0, 1, 0);
  if (USE_CAMERA_CONTROL) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.minDistance = 2; // the minimum distance the camera must have from center
    controls.maxDistance = 10; // the maximum distance the camera must have from center
    controls.enableRotateY = false;
    controls.enablePan = false;
    const isTouchDevice =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0;
    if (isTouchDevice) {
      controls.enable = false;
    }
  }
}
async function init() {
  let canvas = document.getElementById(CANVAS_ID);
  let w = canvas.clientWidth;
  let h = canvas.clientHeight; //w * ASPECT_RATIO;
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  addEventListener("resize", onWindowResize);
  if (scene != null) {
    return;
  }
  await buildScene();
  setupCamera(w, h);
  playIntro();
}

async function buildScene() {
  scene = new THREE.Scene();

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  hemiLight.position.set(0, 2, 0);
  hemiLight.intensity = 2;
  scene.add(hemiLight);

  const backLight = new THREE.PointLight(0xffffff, 1, 600);
  //backLight.add( new THREE.Mesh( new THREE.SphereGeometry( 15, 16, 8 ), new THREE.MeshBasicMaterial( { color: 0xff0040 } ) ) );
  backLight.position.set(0, 2.5, -0.7);
  scene.add(backLight);

  // ground
  if (USE_GROUND) {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2, 50, 0, Math.PI * 2),
      new THREE.MeshPhongMaterial({ color: 0x11111f, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.material.opacity = 0.4;
    ground.material.transparent = true;
    scene.add(ground);
  }

  model = await loadModel("sabor.glb");
  animator = new THREE.AnimationMixer(model.scene);
  model.scene.position.z = 0.5;
  scene.add(model.scene);
}

function render() {
  const delta = clock.getDelta();
  if (animator) {
    animator.update(delta);
  }
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  if (controls) {
    controls.update();
  }
  if (isZoomingOut) {
    camera.position.lerp(cameraPositionFar, 0.1);
    if (camera.position.distanceTo(cameraPositionFar) < 0.001) {
      isZoomingOut = false;
    }
  } else if (isZoomingIn) {
    camera.position.lerp(cameraPositionNear, 0.1);
    if (camera.position.distanceTo(cameraPositionNear) < 0.001) {
      isZoomingIn = false;
    }
  }
}

function playIntro() {
  const animation = fadeToAction("intro", 0.0);
  animation.clampWhenFinished = true;
  animation.setLoop(THREE.LoopOnce);
  animator.addEventListener("finished", returnToIdle);
  isZoomingOut = true;
}

async function playAction() {
  isZoomingOut = true;
  await wait(250);
  animator.stopAllAction();
  const actions = ["jump", "jump_lick"];
  let action = actions[Math.floor(Math.random() * actions.length)];
  const animation = fadeToAction(action, 0.0);
  animation.clampWhenFinished = true;
  animation.setLoop(THREE.LoopOnce);
  animator.addEventListener("finished", returnToIdle);
}

async function returnToIdle() {
  animator.removeEventListener("finished", returnToIdle);
  fadeToAction("idle", 0.25);
  isZoomingOut = false;
  isZoomingIn = true;
  await wait(500);
  isZoomingIn = false;
}

function fadeToAction(name, duration) {
  const animation = animator.clipAction(
    model.animations.find((e) => e.name === name)
  );
  return animation.reset().fadeIn(duration).play();
}

export { CANVAS_ID, init, render, playAction };
