"use client";
import * as THREE from "three";
import { GLTFLoader } from "../three/loaders/GLTFLoader.js";
import { OrbitControls } from "../three/controls/OrbitControls";
import Canvas3D from "./canvas3D";

let scene, camera, renderer, dragon;
let clock = new THREE.Clock();
var time = 0;
let curve, curveObject, dynamicLight, ambientLight;
const CANVAS_ID = "forest";
const USE_CAMERA_CONTROL = true;
const ASPECT_RATIO = 0.75;
const DRAW_PATH = false;
const USE_OBJ = false;
const ANIMATE_CURVE = false;

function setupCamera(w, h) {
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
  scene = new THREE.Scene();
  camera.position.set(0, 16, 20);
  camera.lookAt(scene.position);
  if (USE_CAMERA_CONTROL) {
    const isTouchDevice =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0;
    if (!isTouchDevice) {
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0, 0);
      controls.enablePan = false;
      controls.update();
    }
  }
}

function setupLightning() {
  ambientLight = new THREE.AmbientLight(0x003973);
  scene.add(ambientLight);
  dynamicLight = new THREE.PointLight(0xffffff);
  scene.add(dynamicLight);
}
function loadModel() {
  const loader = new GLTFLoader();
  loader.setPath("/assets/gltf/");
  loader.load("tileL.glb", function (gltf) {
    scene.add(gltf.scene);
  });
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
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  if (scene != null) {
    return;
  }
  setupCamera(w, h);
  setupLightning();
  loadModel();
  //
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

function animate() {
  time += clock.getDelta();
  renderer.render(scene, camera);
}

export default class ForestScene extends Canvas3D {
  constructor(props) {
    super(props);
    this.canvasID = CANVAS_ID;
    this.init = init;
    this.animate = animate;
  }
}
