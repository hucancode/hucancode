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
let dragon;
let curve;
let curveLine;
const clock = new Clock();
let time = 0;
let dynamicLight, ambientLight;
const CANVAS_ID = "dragon-figure8";
const ASPECT_RATIO = 0.75;
let currentOffset = 0;

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
  if (dragon) {
    scene.remove(dragon.object3D);
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
    dragon = null;
  }
  if (curveLine) {
    scene.remove(curveLine);
    if (curveLine.geometry) {
      curveLine.geometry.dispose();
    }
    if (curveLine.material) {
      curveLine.material.dispose();
    }
    curveLine = null;
  }
}

function makeDragon() {
  if (!model) {
    return;
  }

  // Create a figure-8 curve (lemniscate)
  const radius = 40;
  const points = [];
  const numPoints = 64;

  for (let i = 0; i < numPoints; i++) {
    const t = (i / numPoints) * Math.PI * 2;
    // Lemniscate parametric equations
    const x = radius * Math.cos(t);
    const y = radius * Math.sin(2 * t) / 2;
    const z = 0;
    points.push(new Vector3(x, y, z));
  }

  curve = new CatmullRomCurve3(points);
  curve.curveType = "centripetal";
  curve.closed = true;

  dragon = new Flow(model);
  dragon.updateCurve(0, curve);

  scene.add(dragon.object3D);

  // Add curve visualization
  const curvePoints = curve.getPoints(100);
  const geometry = new BufferGeometry().setFromPoints(curvePoints);
  const material = new LineBasicMaterial({ color: 0x00ff88, linewidth: 2 });
  curveLine = new Line(geometry, material);
  scene.add(curveLine);
}

function setOffset(offset) {
  if (!dragon) return;

  // Calculate delta from current position
  let delta = offset - currentOffset;

  // Handle wrapping for closed curves
  if (delta > 0.5) {
    delta -= 1;
  } else if (delta < -0.5) {
    delta += 1;
  }

  // Move the dragon
  dragon.moveAlongCurve(delta);
  currentOffset = offset;
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
  if (!camera || !scene || !renderer) {
    return;
  }

  time += clock.getDelta();

  // Rotate camera around the dragon
  const radius = 140;
  const speed = 0.5;
  const timeSpeed = time * speed;
  camera.position.x = Math.cos(timeSpeed) * radius;
  camera.position.z = Math.sin(timeSpeed) * radius;
  camera.position.y = 20;
  camera.lookAt(scene.position);

  renderer.render(scene, camera);
}

export {
  CANVAS_ID,
  init,
  destroy,
  render,
  setOffset,
};
