import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadModel, wait } from "$lib/utils.js";
import {
  AnimationMixer,
  Clock,
  HemisphereLight,
  LoopOnce,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";

let camera, scene, renderer, animator, controls;
let model;
let cameraPositionNear;
let cameraPositionFar;
let isZoomingIn;
let isZoomingOut;
const clock = new Clock();
const CANVAS_ID = "warrior";
const USE_CAMERA_CONTROL = true;
const ASPECT_RATIO = 0.75;
const USE_GROUND = false;

function onWindowResize() {
  const canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    return;
  }
  canvas.style = "";
  const w = canvas.clientWidth;
  const h = canvas.clientHeight; //w * ASPECT_RATIO;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function setupCamera(w, h) {
  camera = new PerspectiveCamera(45, w / h, 0.001, 1000);
  cameraPositionNear = new Vector3(3.2, 3.9, 3.2);
  cameraPositionFar = new Vector3(4, 6, 4);
  isZoomingIn = false;
  isZoomingOut = false;
  camera.position.copy(cameraPositionFar);
  camera.lookAt(0, 1, 0);
  rebuildOrbitControl();
}

function rebuildOrbitControl() {
  if (!USE_CAMERA_CONTROL) {
    return;
  }
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.minDistance = 0.01; // the minimum distance the camera must have from center
  controls.maxDistance = 10; // the maximum distance the camera must have from center
  controls.maxPolarAngle = controls.minPolarAngle = Math.PI * 0.33;
  controls.enablePan = false;
  controls.update();
}

async function init() {
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
  addEventListener("resize", onWindowResize);
  if (scene != null) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    rebuildOrbitControl();
    return;
  }
  setupCamera(w, h);
  await buildScene();
  playIntro();
}

function destroy() {
  renderer.dispose();
}

async function buildScene() {
  scene = new Scene();

  const hemiLight = new HemisphereLight(0xffffff, 0x444444, 3);
  hemiLight.position.set(0, 2, 0);
  scene.add(hemiLight);

  const backLight = new PointLight(0xffffff, 50, 600);
  //backLight.add( new Mesh( new SphereGeometry( 15, 16, 8 ), new MeshBasicMaterial( { color: 0xff0040 } ) ) );
  backLight.position.set(0, 2.5, -0.7);
  scene.add(backLight);

  model = await loadModel("warrior.glb");
  animator = new AnimationMixer(model.scene);
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
  animation.setLoop(LoopOnce);
  animator.addEventListener("finished", returnToIdle);
  isZoomingOut = true;
}

async function playAction() {
  isZoomingOut = true;
  await wait(250);
  animator.stopAllAction();
  const ACTIONS = ["jump", "jump_lick"];
  const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  const animation = fadeToAction(action, 0.0);
  animation.clampWhenFinished = true;
  animation.setLoop(LoopOnce);
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
    model.animations.find((e) => e.name === name),
  );
  return animation.reset().fadeIn(duration).play();
}

export { CANVAS_ID, init, destroy, render, playAction };
