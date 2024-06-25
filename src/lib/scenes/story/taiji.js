import * as THREE from "three";
import anime from "animejs";
import { Flow } from "$lib/three/modifiers/CurveModifier.js";
import { loadModelStatic } from "$lib/utils.js";
import VERTEX_SHADER from "$lib/scenes/shaders/basic.vert.glsl?raw";
import TAIJI_FRAGMENT_SHADER from "$lib/scenes/shaders/taiji.frag.glsl?raw";
import CLOUD_FRAGMENT_SHADER from "$lib/scenes/shaders/cloud.frag.glsl?raw";
import BAGUA_FRAGMENT_SHADER from "$lib/scenes/shaders/bagua.frag.glsl?raw";
import { controls } from "./scene";
let taiji;
let bagua;
let background;
let dragon = null;
let curve = null;
const clock = new THREE.Clock();
var time = 0;
let previousAutoRotation = false;
let isWaitingForResource = false;
let waitingScene = null;
let taijiEnterTimeline = null;
let taijiLeaveTimeline = null;

const DRAGON_RANDOM_PATH = false;
const DRAGON_SPEED_PERCENT_PER_FRAME = 0.1;
async function makeDragon() {
  let model = await loadModelStatic("dragon.glb");
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
        new THREE.Vector3(
          Math.random() * VAR_X + MIN_X,
          Math.random() * VAR_Y + MIN_Y,
          Math.random() * VAR_Z + MIN_Z
        )
      );
    }
  } else {
    const RADIUS = 34;
    const SAMPLE_COUNT = 60;
    const ELEVATION = 8;
    const ELEVATION_CYCLE = 5;
    const MOVING_CYCLE = 3;
    for (var i = 0; i < SAMPLE_COUNT; i++) {
      const theta = (i * Math.PI * 2 * MOVING_CYCLE) / SAMPLE_COUNT;
      const alpha = (i * Math.PI * 2 * ELEVATION_CYCLE) / SAMPLE_COUNT;
      const x = RADIUS * Math.cos(theta);
      const z = RADIUS * Math.sin(theta);
      const y = Math.sin(alpha) * ELEVATION;
      points.push(new THREE.Vector3(x, y, z));
    }
  }
  curve = new THREE.CatmullRomCurve3(points);
  curve.curveType = "centripetal";
  curve.closed = true;
  dragon = new Flow(model);
  dragon.updateCurve(0, curve);
  // dragon.object3D.scale.set(0.65, 0.65, 0.65);
  dragon.object3D.scale.set(7, 7, 7);
  dragon.speed = 0;
  if (isWaitingForResource) {
    animateDragon(waitingScene);
  }
}

function makeBackground() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      alpha: { value: 1.0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: CLOUD_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new THREE.PlaneGeometry(60, 60);
  const ret = new THREE.Mesh(geometry, material);
  ret.rotation.x = -Math.PI / 2;
  ret.position.y = -0.1;
  return ret;
}

function makeTaiji() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      alpha: { value: 1.0 },
      color1: { value: new THREE.Color(1, 1, 1) },
      color2: { value: new THREE.Color(0, 0, 0) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: TAIJI_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new THREE.PlaneGeometry(27, 27);
  const ret = new THREE.Mesh(geometry, material);
  ret.scale.x = ret.scale.y = 0;
  ret.rotation.x = -Math.PI / 2;
  return ret;
}

function makeBagua() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      alpha: { value: 1.0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: BAGUA_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new THREE.PlaneGeometry(90, 90);
  const ret = new THREE.Mesh(geometry, material);
  ret.scale.x = ret.scale.y = 30;
  ret.rotation.x = -Math.PI / 2;
  ret.position.y = -0.01;
  return ret;
}

function setupObject() {
  // const axesHelper = new THREE.AxesHelper(5);
  // scene.add(axesHelper);
  taiji = makeTaiji();
  taijiEnterTimeline = anime.timeline({
    autoplay: false,
    duration: 2000,
    easing: "easeOutExpo",
    begin: () => {
      taiji.material.uniforms.alpha.value = 1;
    },
  });
  taiji.scale.setScalar(0.5);
  taiji.position.y = 120;
  taijiEnterTimeline
    .add(
      {
        targets: taiji.scale,
        x: 1,
        y: 1,
      },
      500
    )
    .add(
      {
        targets: taiji.rotation,
        z: Math.PI * 10,
      },
      0
    )
    .add(
      {
        targets: taiji.position,
        y: 0.1,
        duration: 1000,
      },
      0
    );
  taijiLeaveTimeline = anime.timeline({
    autoplay: false,
    duration: 2000,
    easing: "linear",
  });
  taiji.position.y = 0.1;
  taiji.scale.setScalar(1);
  taijiLeaveTimeline
    .add(
      {
        targets: taiji.scale,
        x: 4,
        y: 4,
      },
      0
    )
    .add(
      {
        targets: taiji.rotation,
        z: Math.PI * 2,
      },
      0
    )
    .add(
      {
        targets: taiji.material.uniforms.alpha,
        value: 0,
        easing: "easeOutExpo",
      },
      0
    );
  bagua = makeBagua();
  background = makeBackground();
}

function init() {
  setupObject();
  makeDragon();
}

function animateTaiji(scene) {
  scene.add(taiji);
  scene.add(bagua);
  scene.add(background);
  taijiLeaveTimeline.pause();
  taijiEnterTimeline.restart();
  anime.remove(bagua.scale);
  anime.remove(background.material.uniforms.alpha);
  anime({
    targets: bagua.scale,
    x: 1,
    y: 1,
    duration: 1000,
    easing: "easeOutExpo",
  });
  background.material.uniforms.alpha.value = 0.0;
  anime({
    targets: background.material.uniforms.alpha,
    value: 1,
    duration: 1000,
    easing: "linear",
  });
}

function animateDragon(scene) {
  if(!dragon || !dragon.object3D) {
    isWaitingForResource = true;
    waitingScene = scene;
    return;
  }
  isWaitingForResource = false;
  scene.add(dragon.object3D);
  anime.remove(dragon.object3D.scale);
  anime({
    targets: dragon.object3D.scale,
    x: 0.65,
    y: 0.65,
    z: 0.65,
    easing: "easeOutExpo",
    duration: 500,
  });
  anime.remove(dragon);
  anime({
    targets: dragon,
    speed: DRAGON_SPEED_PERCENT_PER_FRAME * 0.01,
    easing: "linear",
    duration: 1000,
  });
}
function enter(scene, camera, controls) {
  previousAutoRotation = controls.autoRotate;
  controls.autoRotate = false;
  animateTaiji(scene);
  animateDragon(scene);
}

function update() {
  time += clock.getDelta();
  if (background) {
    background.material.uniforms.time.value = time * 4;
  }
  if(dragon) {
    dragon.moveAlongCurve(dragon.speed);
  }
}

function leave(scene) {
  isWaitingForResource = false;
  controls.autoRotate = previousAutoRotation;
  taijiEnterTimeline.pause();
  taijiLeaveTimeline.restart();
  taijiLeaveTimeline.finished.then(() => {
    scene.remove(taiji);
  });
  anime({
    targets: bagua.scale,
    x: 10,
    y: 10,
    duration: 1000,
    easing: "easeInExpo",
    complete: () => {
      scene.remove(bagua);
    },
  });
  anime({
    targets: background.material.uniforms.alpha,
    value: 0,
    duration: 1000,
    easing: "linear",
    complete: () => {
      scene.remove(background);
    },
    update: () => {
      update();
    },
  });
  anime.remove(dragon.object3D.scale);
  anime({
    targets: dragon.object3D.scale,
    x: 7,
    y: 7,
    z: 7,
    easing: "easeInExpo",
    duration: 1000,
    complete: () => {
      scene.remove(dragon.object3D);
    },
  });
  anime.remove(dragon);
  anime({
    targets: dragon,
    speed: 0,
    easing: "easeInExpo",
    duration: 1000,
    update: () => {
      // when leave is called, the update function is no longer called
      // so we need to manually update the dragon position
      dragon.moveAlongCurve(dragon.speed);
    },
  });
}

export { init, enter, leave, update };
