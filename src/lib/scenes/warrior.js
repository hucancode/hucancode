import * as THREE from "three";
import anime from "animejs";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadModel, wait } from "$lib/utils.js";

let camera, scene, renderer, animator, controls;
let model;
const clock = new THREE.Clock();
const CANVAS_ID = "warrior";
let use_camera_control = true;
const ASPECT_RATIO = 0.75;
const USE_GROUND = false;

export function setCameraControl(use) {
  use_camera_control = use;
  rebuildOrbitControl();
}
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
  camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000);
  camera.position.set(1, 0, 1);
  rebuildOrbitControl();
}

function rebuildOrbitControl() {
  if (!use_camera_control) {
    return;
  }
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.minDistance = 0.1; // the minimum distance the camera must have from center
  controls.maxDistance = 10; // the maximum distance the camera must have from center
  controls.maxPolarAngle = controls.minPolarAngle = Math.PI * 0.33;
  controls.enablePan = false;
  controls.update();
}

export function animateCamera(t) {
  // rotate camera around camera target for an amount based on t
  if (camera) {
    let distance = 5 * t;
    if(camera.distance === undefined) {
      camera.distance = camera.position.length();
      camera.lookAt(0, (8-camera.distance)*0.4, 0);
    }
    anime({
      targets: camera,
      distance: distance,
      duration: 1000,
      update: () => {
        camera.position.setComponent(1, camera.distance*0.2);
        camera.lookAt(0, 1, 0);
        camera.position.setLength(camera.distance);
      },
    });
  }
}

async function init() {
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

  model = await loadModel("warrior.glb");
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
}

function playIntro() {
  const animation = fadeToAction("intro", 0.0);
  animation.clampWhenFinished = true;
  animation.setLoop(THREE.LoopOnce);
  animator.addEventListener("finished", returnToIdle);
}

async function playAction() {
  animator.stopAllAction();
  const ACTIONS = ["jump", "jump_lick"];
  const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  const animation = fadeToAction(action, 0.0);
  animation.clampWhenFinished = true;
  animation.setLoop(THREE.LoopOnce);
  animator.addEventListener("finished", returnToIdle);
  anime({
    targets: camera,
    easing: "easeOutExpo",
    distance: 10,
    duration: 500,
    update: () => {
      camera.position.setComponent(1, camera.distance*0.6);
      camera.lookAt(0, 1, 0);
      camera.position.setLength(camera.distance);
    },
  });
}

async function returnToIdle() {
  animator.removeEventListener("finished", returnToIdle);
  fadeToAction("idle", 0.25);
  anime({
    targets: camera,
    easing: "easeOutInElastic",
    distance: 5,
    duration: 3000,
    update: () => {
      return;
      camera.position.setComponent(1, camera.distance*0.6);
      camera.lookAt(0, 1, 0);
      camera.position.setLength(camera.distance);
    },
  });
}

function fadeToAction(name, duration) {
  const animation = animator.clipAction(
    model.animations.find((e) => e.name === name)
  );
  return animation.reset().fadeIn(duration).play();
}

export { CANVAS_ID, init, destroy, render, playAction };
