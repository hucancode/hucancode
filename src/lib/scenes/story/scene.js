import {
  AmbientLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let canvas;
export let renderer, scene, camera, controls;

export function init(element) {
  if (element == null) {
    return;
  }
  canvas = element;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer = new WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setAnimationLoop(render);
  if (scene != null) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    rebuildOrbitControl();
    return;
  }
  setupCamera(w, h);
  setupLights();
  window.addEventListener("resize", onWindowResize);
}

function setupLights() {
  const ambientLight = new AmbientLight(0x003973, 6);
  const hemiLight = new HemisphereLight(0x999999, 0x000000, 10);
  hemiLight.position.set(0, 30, 0);
  scene.add(ambientLight);
  scene.add(hemiLight);
}

function onWindowResize() {
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

function setupCamera(w, h) {
  scene = new Scene();
  scene.fog = new Fog(0x000000, 50, 100);
  camera = new PerspectiveCamera(45, w / h, 1, 2000);
  camera.position.set(40, 40, 40);
  camera.lookAt(0, 0, 0);
  rebuildOrbitControl();
}

function rebuildOrbitControl() {
  if (!renderer || !renderer.domElement || !camera) {
    return;
  }
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enablePan = false;
  controls.minDistance = 40;
  controls.maxDistance = 100;
  controls.maxPolarAngle = controls.minPolarAngle = Math.PI * 0.25;
  controls.autoRotate = true;
  controls.enableZoom = false;
}

export function destroy() {
  renderer.dispose();
}

function render() {
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  if (controls) {
    controls.update();
  }
}
