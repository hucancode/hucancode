import { Flow } from "three/addons/modifiers/CurveModifier.js";
import { loadModelStatic } from "$lib/utils.js";
import {
  AmbientLight,
  CatmullRomCurve3,
  Clock,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

let scene, camera, renderer, model;
let dragons = [];
let curves = [];
const clock = new Clock();
let time = 0;
let dynamicLight, ambientLight;
const CANVAS_ID = "dragon";
const ASPECT_RATIO = 0.75;

// Tunable, educational parameters. The playground page drives these.
const config = {
  preset: "random", // random | circle | figure8 | helix | wave
  points: 20, // control points sampled into the Catmull-Rom curve
  spread: 1, // overall scale of the path
  speed: 0.0008, // fraction of the curve advanced per frame
  showLights: true, // animated colored lights
};

function setConfig(patch) {
  Object.assign(config, patch);
}

function getCurrentDragonCount() {
  return dragons.length;
}

// Path presets: each returns an array of {x,y,z} control points. Random
// scatters points in a box (a different flight every time); the others trace
// recognisable analytic curves so the effect of the maths is visible.
function buildPath(preset, n, s) {
  const pts = [];
  if (preset === "circle") {
    const R = 70 * s;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push({ x: Math.cos(a) * R, y: Math.sin(a * 2) * 12 * s, z: Math.sin(a) * R });
    }
  } else if (preset === "figure8") {
    const R = 70 * s;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push({ x: Math.sin(a) * R, y: Math.sin(a * 3) * 16 * s, z: Math.sin(a * 2) * R * 0.5 });
    }
  } else if (preset === "helix") {
    const R = 55 * s;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 * 3;
      pts.push({ x: Math.cos(a) * R, y: (i / n - 0.5) * 120 * s, z: Math.sin(a) * R });
    }
  } else if (preset === "wave") {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push({ x: (i / n - 0.5) * 160 * s, y: Math.sin(a * 3) * 30 * s, z: Math.cos(a * 2) * 40 * s });
    }
  } else {
    // random
    const MIN_X = -40 * s, VAR_X = 80 * s;
    const MIN_Y = -40 * s, VAR_Y = 80 * s;
    const MIN_Z = -80 * s, VAR_Z = 160 * s;
    for (let i = 0; i < n; i++) {
      pts.push({
        x: Math.random() * VAR_X + MIN_X,
        y: Math.random() * VAR_Y + MIN_Y,
        z: Math.random() * VAR_Z + MIN_Z,
      });
    }
  }
  return pts;
}

async function buildScene() {
  scene = new Scene();
  model = await loadModelStatic("dragon.glb");
}
function setupCamera(w, h) {
  camera = new PerspectiveCamera(45, w / h, 1, 2000);
  camera.position.set(0, 20, 200);
  camera.lookAt(scene.position);
}

function setupLightning() {
  ambientLight = new AmbientLight(0x003973);
  scene.add(ambientLight);
  dynamicLight = new PointLight(0xffffff, 5, 0, 0.2);
  dynamicLight.add(
    new Mesh(
      new SphereGeometry(2, 16, 8),
      new MeshBasicMaterial({ color: 0xffffff }),
    ),
  );
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
  dragons = [];
  curves = [];
}

function makeDragon() {
  if (!model) {
    return;
  }
  const points = buildPath(config.preset, config.points, config.spread);
  let curve = new CatmullRomCurve3(
    points.map((e) => new Vector3(e.x, e.y, e.z)),
  );
  curve.curveType = "centripetal";
  curve.closed = true;
  let dragon = new Flow(model);
  dragon.updateCurve(0, curve);
  scene.add(dragon.object3D);
  dragons.push(dragon);
  curves.push(curve);
}

// Rebuild every dragon onto a freshly generated path (used when a knob that
// changes the curve shape moves, or the user hits "New path").
function regenerate() {
  const count = Math.max(1, dragons.length);
  clearDragon();
  for (let i = 0; i < count; i++) makeDragon();
}

async function init() {
  let canvas = document.getElementById(CANVAS_ID);
  let w = canvas.clientWidth;
  let h = canvas.clientHeight; //w * ASPECT_RATIO;
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
  let h = canvas.clientHeight; //w * ASPECT_RATIO;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function render() {
  time += clock.getDelta();
  for (let i = 0; i < dragons.length; i++) {
    // Remove redundant updateCurve call - curve doesn't change
    dragons[i].moveAlongCurve(config.speed);
  }
  if (dynamicLight && config.showLights) {
    // Cache trig calculations
    const t07 = time * 0.7;
    const t05 = time * 0.5;
    const t03 = time * 0.3;
    const t02 = time * 0.2;
    const t01 = time * 0.1;
    const t007 = time * 0.07;
    const t003 = time * 0.03;

    dynamicLight.position.x = Math.sin(t07) * 30 + 20;
    dynamicLight.position.y = Math.cos(t05) * 40;
    dynamicLight.position.z = Math.cos(t03) * 30 + 20;
    dynamicLight.color.r = (Math.sin(t03) + 1.0) * 0.5;
    dynamicLight.color.g = (Math.sin(t07) + 1.0) * 0.5;
    dynamicLight.color.b = (Math.sin(t02) + 1.0) * 0.5;

    if (ambientLight) {
      ambientLight.color.r = (Math.sin(t01) + 1.0) * 0.5;
      ambientLight.color.g = (Math.sin(t007) + 1.0) * 0.5;
      ambientLight.color.b = (Math.sin(t003) + 1.0) * 0.5;
    }
  }
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
  regenerate,
  setConfig,
  config,
};
