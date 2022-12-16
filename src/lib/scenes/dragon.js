import * as THREE from "three";
import { Flow } from "../three/modifiers/CurveModifier.js";
import { OBJLoader } from "../three/loaders/OBJLoader.js";
import { GLTFLoader } from "../three/loaders/GLTFLoader.js";

let scene, camera, renderer, model;
let dragons = [];
let curves = [];
let clock = new THREE.Clock();
var time = 0;
let dynamicLight, ambientLight;
const CANVAS_ID = "dragon";
const ASPECT_RATIO = 0.75;

function setupCamera(w, h) {
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
  scene = new THREE.Scene();
  camera.position.set(0, 20, 200);
  camera.lookAt(scene.position);
}

function setupLightning() {
  ambientLight = new THREE.AmbientLight(0x003973);
  scene.add(ambientLight);
  dynamicLight = new THREE.PointLight(0xffffff);
  dynamicLight.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
  );
  scene.add(dynamicLight);
}

function loadModel(url) {
  const loader = new GLTFLoader();
  loader.setPath("/assets/gltf/");
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve(gltf.scene), null, reject);
  });
}

function clearDragon() {
  dragons.forEach((dragon) => scene.remove(dragon.object3D));
  dragons = [];
  curves = [];
}

function makeDragon() {
  if (!model) {
    return;
  }
  const MIN_X = -40;
  const VAR_X = 80;
  const MIN_Y = -40;
  const VAR_Y = 80;
  const MIN_Z = -80;
  const VAR_Z = 160;
  const points = Array.from({ length: 20 }, (_) => {
    return {
      x: Math.random() * VAR_X + MIN_X,
      y: Math.random() * VAR_Y + MIN_Y,
      z: Math.random() * VAR_Z + MIN_Z,
    };
  });
  let curve = new THREE.CatmullRomCurve3(
    points.map((e) => new THREE.Vector3(e.x, e.y, e.z))
  );
  curve.curveType = "centripetal";
  curve.closed = true;
  let dragon = new Flow(model);
  dragon.updateCurve(0, curve);
  scene.add(dragon.object3D);
  dragons.push(dragon);
  curves.push(curve);
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
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  if (scene != null) {
    return;
  }
  setupCamera(w, h);
  setupLightning();
  model = await loadModel("dragon.glb");
  makeDragon();
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
  for (let i = 0; i < dragons.length; i++) {
    dragons[i].updateCurve(0, curves[i]);
    dragons[i].moveAlongCurve(0.002);
  }
  if (dynamicLight) {
    dynamicLight.position.x = Math.sin(time * 0.7) * 30 + 20;
    dynamicLight.position.y = Math.cos(time * 0.5) * 40;
    dynamicLight.position.z = Math.cos(time * 0.3) * 30 + 20;
    dynamicLight.color.r = (Math.sin(time * 0.3) + 1.0) * 0.5;
    dynamicLight.color.g = (Math.sin(time * 0.7) + 1.0) * 0.5;
    dynamicLight.color.b = (Math.sin(time * 0.2) + 1.0) * 0.5;
  }
  if (ambientLight) {
    ambientLight.color.r = (Math.sin(time * 0.1) + 1.0) * 0.5;
    ambientLight.color.g = (Math.sin(time * 0.07) + 1.0) * 0.5;
    ambientLight.color.b = (Math.sin(time * 0.03) + 1.0) * 0.5;
  }
  renderer.render(scene, camera);
}

export { CANVAS_ID, init, render, clearDragon, makeDragon };
