import { Flow } from "three/addons/modifiers/CurveModifier.js";
import { loadModelStatic } from "$lib/utils.js";
import {
  AmbientLight,
  BufferGeometry,
  CatmullRomCurve3,
  Clock,
  Line,
  LineBasicMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";

let scene, camera, renderer, model;
let dragons = [];
let curves = [];
let curveLines = [];
const clock = new Clock();
let time = 0;
let dynamicLight, ambientLight;
const CANVAS_ID = "dragon-curved";
const ASPECT_RATIO = 0.75;

function getCurrentDragonCount() {
  return dragons.length;
}

async function buildScene() {
  scene = new Scene();
  model = await loadModelStatic("dragon.glb");
}

function setupCamera(w, h) {
  camera = new PerspectiveCamera(45, w / h, 1, 2000);
  camera.position.set(0, 20, 140);
  camera.lookAt(scene.position);
}

function setupLightning() {
  ambientLight = new AmbientLight(0x003973);
  scene.add(ambientLight);
  dynamicLight = new PointLight(0xffffff, 10, 0, 0.2);
  scene.add(dynamicLight);
}

function clearDragon() {
  dragons.forEach((dragon) => {
    scene.remove(dragon.object3D);
    // Dispose geometries and materials
    dragon.object3D.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  });
  curveLines.forEach((line) => {
    scene.remove(line);
    if (line.geometry) {
      line.geometry.dispose();
    }
    if (line.material) {
      line.material.dispose();
    }
  });
  dragons = [];
  curves = [];
  curveLines = [];
}

function makeDragon() {
  if (!model) {
    return;
  }

  // Create a circle
  const radius = 40;
  const points = [];
  const numPoints = 8;
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    points.push(new Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0
    ));
  }

  let curve = new CatmullRomCurve3(points);
  curve.curveType = "centripetal";
  curve.closed = true;

  let dragon = new Flow(model);
  dragon.updateCurve(0, curve);

  scene.add(dragon.object3D);
  dragons.push(dragon);
  curves.push(curve);

  // Add curve visualization
  const curvePoints = curve.getPoints(50);
  const geometry = new BufferGeometry().setFromPoints(curvePoints);
  const material = new LineBasicMaterial({ color: 0x00ff88, linewidth: 2 });
  const curveObject = new Line(geometry, material);
  scene.add(curveObject);
  curveLines.push(curveObject);
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
  if (scene != null) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return;
  }
  await buildScene();
  setupCamera(w, h);
  setupLightning();
  makeDragon();
}

function destroy() {
  clearDragon();
  if (renderer) {
    renderer.renderLists.dispose();
    renderer.dispose();
  }
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
  time += clock.getDelta();

  // Rotate camera around the dragon
  const radius = 140;
  const speed = 0.5;
  const timeSpeed = time * speed;
  camera.position.x = Math.cos(timeSpeed) * radius;
  camera.position.z = Math.sin(timeSpeed) * radius;
  camera.position.y = 20;
  camera.lookAt(scene.position);
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

export {
  CANVAS_ID,
  init,
  destroy,
  render,
  getCurrentDragonCount,
  clearDragon,
  makeDragon,
};
