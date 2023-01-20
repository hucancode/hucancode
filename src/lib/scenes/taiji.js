import * as THREE from "three";
import anime from "animejs";
import { OrbitControls } from "$lib/three/controls/OrbitControls";
import { mergeBufferGeometries } from "$lib/three/BufferGeometryUtils";
import {
  TAIJI_VERTEX_SHADER,
  TAIJI_FRAGMENT_SHADER,
  BACKGROUND_VERTEX_SHADER,
  BACKGROUND_FRAGMENT_SHADER,
} from "./taiji-shaders";

let scene, camera, renderer, controls;
let taiji;
let bagua;
let background;
let clock = new THREE.Clock();
var time = 0;

const CANVAS_ID = "taiji";
const USE_CAMERA_CONTROL = true;
const TAIJI_ROTATION_CIRCLE = 23000;
const BAGUA_ROTATION_CIRCLE = 43000;

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
  const geometry = new THREE.PlaneGeometry(16, 16);
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
    vertexShader: TAIJI_VERTEX_SHADER,
    fragmentShader: TAIJI_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const ret = new THREE.Mesh(geometry, material);
  ret.scale.x = ret.scale.y = 9;
  ret.rotation.x = -Math.PI / 2;
  return ret;
}

function makeBagua() {
  const HEIGHT = 5;
  const MARGIN = 0.2;
  const STROKE_WIDTH = 0.05;
  const bar31 = new THREE.PlaneGeometry(3, 1);
  const bar11 = new THREE.PlaneGeometry(1, 1);
  const blackMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const root = new THREE.Object3D();
  for (let i = 0; i < 8; i++) {
    const figure = new THREE.Object3D();
    for (let bit = 0; bit < 3; bit++) {
      const v = (i >> bit) & 1;
      if (v == 1) {
        const base = new THREE.Mesh(bar31, blackMaterial);
        const mesh = new THREE.Mesh(bar31, whiteMaterial);
        mesh.position.y = bit * (1 + MARGIN) + HEIGHT;
        mesh.add(base);
        base.position.z = -0.01;
        base.scale.x = (3 + STROKE_WIDTH * 2) / 3;
        base.scale.y = (1 + STROKE_WIDTH * 2) / 1;
        figure.add(mesh);
      } else {
        const baseA = new THREE.Mesh(bar11, blackMaterial);
        const baseB = new THREE.Mesh(bar11, blackMaterial);
        baseB.position.z = baseA.position.z = -0.01;
        baseB.scale.x =
          baseB.scale.y =
          baseA.scale.x =
          baseA.scale.y =
            (1 + STROKE_WIDTH * 2) / 1;
        const meshA = new THREE.Mesh(bar11, whiteMaterial);
        const meshB = new THREE.Mesh(bar11, whiteMaterial);
        meshA.add(baseA);
        meshB.add(baseB);
        meshB.position.y = meshA.position.y = bit * (1 + MARGIN) + HEIGHT;
        meshA.position.x = -1;
        meshB.position.x = 1;
        figure.add(meshA);
        figure.add(meshB);
      }
    }
    figure.rotation.z = (i * Math.PI * 2) / 8;
    root.add(figure);
  }
  root.rotation.x = -Math.PI / 2;
  root.position.y = -0.2;
  return root;
}

function setupObject() {
  // const axesHelper = new THREE.AxesHelper(5);
  // scene.add(axesHelper);
  taiji = makeTaiji();
  taiji.material.uniforms.alpha.value = 0.9;
  scene.add(taiji);
  bagua = makeBagua();
  scene.add(bagua);
  background = makeBackground();
  scene.add(background);
  anime({
    targets: taiji.rotation,
    z: Math.PI * 2,
    duration: TAIJI_ROTATION_CIRCLE,
    easing: "linear",
    loop: true,
  });
  anime({
    targets: bagua.rotation,
    z: Math.PI * 2,
    duration: BAGUA_ROTATION_CIRCLE,
    easing: "linear",
    direction: "reverse",
    loop: true,
  });
}

function setupCamera(w, h) {
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
  scene = new THREE.Scene();
  camera.position.set(0, 16, 16);
  rebuildOrbitControl();
}

function rebuildOrbitControl() {
  if (USE_CAMERA_CONTROL) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
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
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    rebuildOrbitControl();
    return;
  }
  setupCamera(w, h);
  setupObject();
  window.addEventListener("resize", onWindowResize);
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
  time += clock.getDelta();
  if (background) {
    background.material.uniforms.time.value = time * 4;
  }
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  if (controls) {
    controls.update();
  }
}
function playAnimation() {
  let particle = makeTaiji();
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
  let animation = anime.timeline({
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
        y: 0.2,
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
      400
    );
  scene.add(particle);
  animation.play();
}

export { CANVAS_ID, init, destroy, render, playAnimation };
