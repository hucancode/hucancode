import { animate, utils, eases } from "animejs";
import { Flow } from "three/addons/modifiers/CurveModifier.js";
import { loadModelStatic } from "$lib/utils.js";
import VERTEX_SHADER from "$lib/scenes/shaders/basic.vert.glsl?raw";
import TAIJI_FRAGMENT_SHADER from "$lib/scenes/shaders/taiji.frag.glsl?raw";
import CLOUD_FRAGMENT_SHADER from "$lib/scenes/shaders/cloud.frag.glsl?raw";
import BAGUA_FRAGMENT_SHADER from "$lib/scenes/shaders/bagua.frag.glsl?raw";
// Note: controls import is only used when in story mode
import {
  CatmullRomCurve3,
  Clock,
  Color,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from "three";

let taiji;
let bagua;
let background;
let dragon = null;
let curve = null;
const clock = new Clock();
let time = 0;
let previousAutoRotation = false;
let isWaitingForResource = false;
let waitingScene = null;

const DRAGON_RANDOM_PATH = false;
const DRAGON_SPEED_PERCENT_PER_FRAME = 0.03;
async function makeDragon() {
  let model = await loadModelStatic("dragon-low.glb");
  dragon = new Flow(model);
  const points = [];
  if (DRAGON_RANDOM_PATH) {
    const MIN_X = -40;
    const VAR_X = 80;
    const MIN_Y = -5;
    const VAR_Y = 10;
    const MIN_Z = -40;
    const VAR_Z = 80;
    const SAMPLE_COUNT = 20;
    for (var i = 0; i < SAMPLE_COUNT; i++) {
      points.push(
        new Vector3(
          Math.random() * VAR_X + MIN_X,
          Math.random() * VAR_Y + MIN_Y,
          Math.random() * VAR_Z + MIN_Z,
        ),
      );
    }
  } else {
    const RADIUS = 34;
    const SAMPLE_COUNT = 60;
    const ELEVATION = 8;
    const ELEVATION_CYCLE = 11;
    const MOVING_CYCLE = 5;
    for (var i = 0; i < SAMPLE_COUNT; i++) {
      const theta = (i * Math.PI * 2 * MOVING_CYCLE) / SAMPLE_COUNT;
      const alpha = (i * Math.PI * 2 * ELEVATION_CYCLE) / SAMPLE_COUNT;
      const x = RADIUS * Math.cos(theta);
      const z = RADIUS * Math.sin(theta);
      const y = Math.sin(alpha) * ELEVATION;
      points.push(new Vector3(x, y, z));
    }
  }
  curve = new CatmullRomCurve3(points);
  curve.curveType = "centripetal";
  curve.closed = true;
  dragon = new Flow(model);
  dragon.updateCurve(0, curve);
  dragon.object3D.scale.set(7, 7, 7);
  dragon.speed = 0;
  if (isWaitingForResource) {
    animateDragon(waitingScene);
  }
}

function makeBackground() {
  const material = new ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      alpha: { value: 1.0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: CLOUD_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new PlaneGeometry(60, 60);
  const ret = new Mesh(geometry, material);
  ret.rotation.x = -Math.PI / 2;
  ret.position.y = -0.1;
  return ret;
}

function makeTaiji() {
  const material = new ShaderMaterial({
    uniforms: {
      alpha: { value: 1.0 },
      color1: { value: new Color(1, 1, 1) },
      color2: { value: new Color(0, 0, 0) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: TAIJI_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new PlaneGeometry(27, 27);
  const ret = new Mesh(geometry, material);
  ret.rotation.x = -Math.PI / 2;
  return ret;
}

function makeBagua() {
  const material = new ShaderMaterial({
    uniforms: {
      alpha: { value: 1.0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: BAGUA_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new PlaneGeometry(90, 90);
  const ret = new Mesh(geometry, material);
  ret.scale.x = ret.scale.y = 30;
  ret.rotation.x = -Math.PI / 2;
  ret.position.y = -0.01;
  return ret;
}

function setupObject() {
  bagua = makeBagua();
  background = makeBackground();
  taiji = makeTaiji();
}

function init() {
  makeDragon();
  setupObject();
}

function animateTaiji(scene) {
  scene.add(taiji);
  scene.add(bagua);
  scene.add(background);
  animate(background.material.uniforms.alpha, {
    value: { from: 0.1, to: 1 },
    duration: 1000,
    ease: eases.linear(),
  });
  animate(bagua.scale, {
    x: 1,
    y: 1,
    duration: 1000,
    ease: eases.outExpo,
  });
  animate(taiji.material.uniforms.alpha, {
    value: 1,
    ease: eases.outExpo,
  });
  animate(taiji.rotation, {
    z: { from: 0, to: Math.PI * 10 },
    delay: 500,
  });
  animate(taiji.position, {
    y: { from: 120, to: 0.01 },
    duration: 1000,
  });
  animate(taiji.scale, {
    x: { from: 0, to: 1 },
    y: { from: 0, to: 1 },
    delay: 500,
  });
}

function animateDragon(scene) {
  if (!dragon || !dragon.object3D) {
    isWaitingForResource = true;
    waitingScene = scene;
    return;
  }
  isWaitingForResource = false;
  scene.add(dragon.object3D);
  utils.remove(dragon.object3D.scale);
  animate(dragon.object3D.scale, {
    x: 0.65,
    y: 0.65,
    z: 0.65,
    ease: eases.outExpo,
    duration: 500,
  });
  utils.remove(dragon);
  animate(dragon, {
    speed: DRAGON_SPEED_PERCENT_PER_FRAME * 0.01,
    ease: eases.linear(),
    duration: 1000,
  });
}
function enter(scene, _camera, controls) {
  if (controls) {
    previousAutoRotation = controls.autoRotate;
    controls.autoRotate = false;
  }
  animateTaiji(scene);
  animateDragon(scene);
}

function update() {
  time += clock.getDelta();
  if (background) {
    background.material.uniforms.time.value = time * 4;
  }
  if (dragon) {
    dragon.moveAlongCurve(dragon.speed);
  }
}

function leave(scene, _camera, controls) {
  isWaitingForResource = false;
  // Restore controls if they were provided
  if (controls) {
    controls.autoRotate = previousAutoRotation;
  }
  animate(taiji.scale, {
    x: { from: 1, to: 4 },
    y: { from: 1, to: 4 },
    onComplete: () => {
      scene.remove(taiji);
    }
  });
  animate(taiji.rotation, {
    z: Math.PI * 2,
  });
  animate(taiji.material.uniforms.alpha, {
    value: 0,
    ease: eases.outExpo,
  });
  animate(bagua.scale, {
    x: 10,
    y: 10,
    duration: 1000,
    ease: eases.inExpo,
    onComplete: () => {
      scene.remove(bagua);
    },
  });
  animate(background.material.uniforms.alpha, {
    value: 0,
    duration: 1000,
    ease: eases.linear(),
    onComplete: () => {
      scene.remove(background);
    },
    onUpdate: () => {
      update();
    },
  });
  utils.remove(dragon.object3D.scale);
  animate(dragon.object3D.scale, {
    x: 7,
    y: 7,
    z: 7,
    ease: eases.inExpo,
    duration: 1000,
    onComplete: () => {
      scene.remove(dragon.object3D);
    },
  });
  utils.remove(dragon);
  animate(dragon, {
    speed: 0,
    ease: eases.inExpo,
    duration: 1000,
    onUpdate: () => {
      // when leave is called, the update function is no longer called
      // so we need to manually update the dragon position
      dragon.moveAlongCurve(dragon.speed);
    },
  });
}

function destroy() {
  // Clean up all animations
  if (background) {
    utils.remove(background.material.uniforms.alpha);
  }
  if (bagua) {
    utils.remove(bagua.scale);
  }
  if (taiji) {
    utils.remove(taiji.material.uniforms.alpha);
    utils.remove(taiji.rotation);
    utils.remove(taiji.position);
    utils.remove(taiji.scale);
  }
  if (dragon) {
    utils.remove(dragon.object3D.scale);
    utils.remove(dragon);
    dragon.object3D.removeFromParent();
  }
  // Dispose materials
  if (background && background.material) {
    background.material.dispose();
  }
  if (taiji && taiji.material) {
    taiji.material.dispose();
  }
  if (bagua && bagua.material) {
    bagua.material.dispose();
  }
  // Dispose geometries
  if (background && background.geometry) {
    background.geometry.dispose();
  }
  if (taiji && taiji.geometry) {
    taiji.geometry.dispose();
  }
  if (bagua && bagua.geometry) {
    bagua.geometry.dispose();
  }
}

export { init, enter, leave, update, destroy };
