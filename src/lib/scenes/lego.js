import * as THREE from "three";
import anime from "animejs";
import { OrbitControls } from "$lib/three/controls/OrbitControls";
import { mergeBufferGeometries } from "$lib/three/BufferGeometryUtils";

let scene, camera, renderer, controls;
let clock = new THREE.Clock();
let plank;
const material = new THREE.MeshNormalMaterial();
var time = 0;
const CANVAS_ID = "lego";
const USE_CAMERA_CONTROL = true;
const ASPECT_RATIO = 0.75;

function makePlank(width, height, depth, thickness) {
    const hh = (height-thickness)/2;
    const hw = (width-thickness)/2;
    const ab = new THREE.BoxGeometry(width, thickness, depth);
    ab.translate(0, hh, 0);
    const bc = new THREE.BoxGeometry(thickness, height, depth);
    bc.translate(hw, 0, 0);
    const cd = new THREE.BoxGeometry(width, thickness, depth);
    cd.translate(0, -hh, 0);
    const da = new THREE.BoxGeometry(thickness, height, depth);
    da.translate(-hw, 0, 0);
    const cap = new THREE.BoxGeometry(width, height, thickness);
    cap.translate(0,0, depth/2);
    const geometry = mergeBufferGeometries([ab, bc, cd, da, cap]);
    plank = new THREE.Mesh(geometry, material);
    scene.add(plank);
}

function setupCamera(w, h) {
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
  scene = new THREE.Scene();
  camera.position.set(10, 10, 10);
  rebuildOrbitControl();
}

function rebuildOrbitControl() {
  if (USE_CAMERA_CONTROL) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(1, 1, 1);
    //controls.enablePan = false;
    controls.minDistance = 4; // the minimum distance the camera must have from center
    controls.maxDistance = 30; // the maximum distance the camera must have from center
    //controls.update();
    controls.enableRotate = true;
    // controls.autoRotate = true;
  }
}

function init() {
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
  if (scene != null) {
    rebuildOrbitControl();
    return;
  }
  setupCamera(w, h);
  makePlank(6, 6, 2, 1);
  window.addEventListener("resize", onWindowResize);
}

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

function render() {
  time += clock.getDelta();
  if (renderer && scene && camera) {
    //camera.position.set(Math.sin(time)*4, Math.cos(time)*4, Math.sin(time)*4)
    //camera.lookAt(plank);
    renderer.render(scene, camera);
  }
  if (controls) {
    controls.update();
  }
}

export { CANVAS_ID, init, render };
