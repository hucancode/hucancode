import { loadModelStatic } from "$lib/utils.js";
import {
  AmbientLight,
  PerspectiveCamera,
  PointLight,
  Scene,
  WebGLRenderer,
} from "three";

let scene, camera, renderer, model;
let dynamicLight, ambientLight;
const CANVAS_ID = "dragon-static";
const ASPECT_RATIO = 0.75;

async function buildScene() {
  scene = new Scene();
  model = await loadModelStatic("dragon.glb");
}

function setupCamera(w, h) {
  camera = new PerspectiveCamera(45, w / h, 1, 2000);
  camera.position.set(-100, 0, 150);
  camera.lookAt(scene.position);
}

function setupLightning() {
  ambientLight = new AmbientLight(0x003973, 60);
  scene.add(ambientLight);
  dynamicLight = new PointLight(0xffffff, 110, 0, 0.2);
  scene.add(dynamicLight);
}

function makeDragon() {
  if (!model) {
    return;
  }

  // Just add the static model without any transformation
  const dragonModel = model.clone();
  // Flip the dragon upside down
  dragonModel.scale.y = -1;
  // Apply orange color to the model
  dragonModel.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      child.material.color.setHex(0xff6600);
    }
  });
  scene.add(dragonModel);
}

async function init() {
  let canvas = document.getElementById(CANVAS_ID);
  let w = canvas.clientWidth;
  let h = canvas.clientHeight;
  renderer = new WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  addEventListener("resize", onWindowResize);

  await buildScene();
  setupCamera(w, h);
  setupLightning();
  makeDragon();
}

function destroy() {
  renderer.dispose();
}

function onWindowResize() {
  let canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    return;
  }
  canvas.style = "";
  let w = canvas.clientWidth;
  let h = canvas.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function render() {
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

export {
  CANVAS_ID,
  init,
  destroy,
  render,
};
