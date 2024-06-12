import * as THREE from "three";
import anime from "animejs";
import { Flow } from "$lib/three/modifiers/CurveModifier.js";
import { loadModelStatic } from "$lib/utils.js";

import {
  TAIJI_VERTEX_SHADER,
  TAIJI_FRAGMENT_SHADER,
  BACKGROUND_VERTEX_SHADER,
  BACKGROUND_FRAGMENT_SHADER,
  BAGUA_VERTEX_SHADER,
  BAGUA_FRAGMENT_SHADER,
} from "./taiji-shaders";

let taiji;
let bagua;
let background;
let dragon = null;
let curve = null;
let ambientLight = null;
let dynamicLight = null;
const clock = new THREE.Clock();
var time = 0;

const TAIJI_ROTATION_CIRCLE = 23000;
const BAGUA_ROTATION_CIRCLE = 43000;
const DRAGON_RANDOM_PATH = false;
const DRAGON_SPEED_PERCENT_PER_FRAME = 0.6;
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
    const RADIUS = 30;
    const SAMPLE_COUNT = 20;
    const ELEVATION = 8;
    for (var i = 0; i < SAMPLE_COUNT; i++) {
      const theta = (i * Math.PI * 2) / SAMPLE_COUNT;
      const x = RADIUS * Math.cos(theta);
      const z = RADIUS * Math.sin(theta);
      const y = Math.sin(theta * 2) * ELEVATION;
      points.push(new THREE.Vector3(x, y, z));
    }
  }
  curve = new THREE.CatmullRomCurve3(points);
  curve.curveType = "centripetal";
  curve.closed = true;
  dragon = new Flow(model);
  dragon.updateCurve(0, curve);
  dragon.object3D.scale.set(0.65, 0.65, 0.65);
  ambientLight = new THREE.AmbientLight(0x003973);
  dynamicLight = new THREE.PointLight(0xffffff);
  dynamicLight.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
  );
}

function makeBackground() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
    },
    vertexShader: BACKGROUND_VERTEX_SHADER,
    fragmentShader: BACKGROUND_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new THREE.PlaneGeometry(18, 18);
  const ret = new THREE.Mesh(geometry, material);
  ret.rotation.x = -Math.PI / 2;
  ret.position.y = -2;
  return ret;
}

function makeTaiji() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      alpha: { value: 1.0 },
      color1: { value: new THREE.Color(1, 1, 1) },
      color2: { value: new THREE.Color(0, 0, 0) },
    },
    vertexShader: TAIJI_VERTEX_SHADER,
    fragmentShader: TAIJI_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new THREE.PlaneGeometry(20, 20);
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
    vertexShader: BAGUA_VERTEX_SHADER,
    fragmentShader: BAGUA_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new THREE.PlaneGeometry(65, 65);
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
  taiji.material.uniforms.alpha.value = 0.9;
  bagua = makeBagua();
  background = makeBackground();
}

setupObject();

function enter(scene) {
  scene.add(taiji);
  scene.add(bagua);
  scene.add(background);
  scene.add(ambientLight);
  scene.add(dynamicLight);
  anime.remove(taiji.scale);
  anime.remove(bagua.scale);
  anime.remove(background.material.uniforms.alpha);
  anime({
    targets: taiji.scale,
    x: 1,
    y: 1,
    duration: 1000,
    easing: "easeOutExpo",
  });
  anime({
    targets: bagua.scale,
    x: 1,
    y: 1,
    duration: 1000,
    easing: "easeOutExpo",
  });
  anime({
    targets: background.material.uniforms.alpha,
    value: 1,
    duration: 1000,
    easing: "easeOutExpo",
  });
  anime.remove(taiji.rotation);
  anime({
    targets: taiji.rotation,
    z: Math.PI * 2,
    duration: TAIJI_ROTATION_CIRCLE,
    easing: "linear",
    loop: true,
  });
  scene.add(dragon.object3D);
}

function update() {
  time += clock.getDelta();
  if (background) {
    background.material.uniforms.time.value = time * 4;
  }
  dragon.moveAlongCurve(DRAGON_SPEED_PERCENT_PER_FRAME * 0.01);
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
}

function leave(scene) {
  anime({
    targets: taiji.scale,
    x: 0,
    y: 0,
    duration: 1000,
    easing: "easeOutExpo",
    complete: () => {
      scene.remove(taiji);
    },
  });
  anime({
    targets: bagua.scale,
    x: 30,
    y: 30,
    duration: 1000,
    easing: "easeOutExpo",
    complete: () => {
      scene.remove(bagua);
    },
  });
  anime({
    targets: background.material.uniforms.alpha,
    value: 0,
    duration: 1000,
    easing: "easeOutExpo",
    complete: () => {
      scene.remove(background);
    },
  });
  scene.remove(ambientLight);
  scene.remove(dynamicLight);
  scene.remove(dragon.object3D);
}

function playAnimation() {
  const particle = makeTaiji();
  particle.scale.x = particle.scale.y = 6;
  particle.position.y = 10;
  // use HSL to guaranteed 2 colors has acceptable contrast
  particle.material.uniforms.color1.value.setHSL(
    Math.random(),
    Math.random(),
    Math.random() * 0.2 + 0.8
  );
  particle.material.uniforms.color2.value.setHSL(
    Math.random(),
    Math.random(),
    Math.random() * 0.2
  );
  const animation = anime.timeline({
    duration: 1500,
    easing: "easeOutExpo",
    complete: () => {
      particle.removeFromParent();
    },
  });
  animation
    .add(
      {
        targets: particle.rotation,
        z: Math.PI * 6,
      },
      0
    )
    .add(
      {
        targets: particle.position,
        y: Math.random(), // avoid z-fighting
      },
      0
    )
    .add(
      {
        targets: particle.scale,
        easing: "easeInOutQuad",
        x: 22,
        y: 22,
      },
      400
    )
    .add(
      {
        targets: particle.material.uniforms.alpha,
        easing: "easeInOutQuad",
        value: 0,
      },
      100
    );
  scene.add(particle);
  animation.play();
}

export { makeDragon, enter, leave, update, playAnimation };
