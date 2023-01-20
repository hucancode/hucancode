import * as THREE from "three";
import anime from "animejs";
import { OrbitControls } from "$lib/three/controls/OrbitControls";
import { mergeBufferGeometries } from "$lib/three/BufferGeometryUtils";

var time = 0;
let clock = new THREE.Clock();
let blackMaterial, whiteMaterial;
let scene, camera, renderer, controls;
let taiji;
let bagua;
const CANVAS_ID = "taiji";
const USE_CAMERA_CONTROL = true;

function makeTaiji() {
  const semiCircle = new THREE.CircleGeometry(2, 32, 0, Math.PI);
  const fullCircle = new THREE.CircleGeometry(1, 32);
  const blackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  taiji = new THREE.Object3D();
  const baseA = new THREE.Mesh(semiCircle, blackMaterial);
  const baseB = new THREE.Mesh(semiCircle, whiteMaterial);
  const yin = new THREE.Mesh(fullCircle, blackMaterial);
  const yang = new THREE.Mesh(fullCircle, whiteMaterial);
  const yinMini = new THREE.Mesh(fullCircle, blackMaterial);
  const yangMini = new THREE.Mesh(fullCircle, whiteMaterial);
  baseB.rotation.z = Math.PI;
  yin.position.z = 0.01;
  yin.position.x = 1;
  yang.position.z = 0.01;
  yang.position.x = -1;
  yinMini.scale.x = yinMini.scale.y = 0.3;
  yinMini.position.z = 0.01;
  yangMini.position.z = 0.01;
  yangMini.scale.x = yangMini.scale.y = 0.3;
  yin.add(yangMini);
  yang.add(yinMini);
  taiji.add(baseA);
  taiji.add(baseB);
  taiji.add(yin);
  taiji.add(yang);
  taiji.rotation.x = -Math.PI / 2;
  scene.add(taiji);
  // const axesHelper = new THREE.AxesHelper( 5 );
  // scene.add( axesHelper );
}

function makeBagua() {
  const HEIGHT = 5;
  const MARGIN = 0.1;
  const bar31 = new THREE.PlaneGeometry(3, 1);
  const bar11 = new THREE.PlaneGeometry(1, 1);
  const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  bagua = new THREE.Object3D();
  for (let i = 0; i < 8; i++) {
    const figure = new THREE.Object3D();
    for (let bit = 0; bit < 3; bit++) {
      const v = (i >> bit) & 1;
      if (v == 1) {
        const mesh = new THREE.Mesh(bar31, whiteMaterial);
        mesh.position.y = bit * (1 + MARGIN) + HEIGHT;
        figure.add(mesh);
      } else {
        const meshA = new THREE.Mesh(bar11, whiteMaterial);
        const meshB = new THREE.Mesh(bar11, whiteMaterial);
        meshB.position.y = meshA.position.y = bit * 1.1 + 5;
        meshA.position.x = -1;
        meshB.position.x = 1;
        figure.add(meshA);
        figure.add(meshB);
      }
    }
    figure.rotation.z = (i * Math.PI * 2) / 8;
    bagua.add(figure);
  }
  bagua.rotation.x = -Math.PI / 2;
  scene.add(bagua);
}
function setupLight() {
  const light = new THREE.AmbientLight(0x666666); // soft white light
  scene.add(light);
  const hemiLight = new THREE.HemisphereLight(0x999999, 0x000000, 1);
  hemiLight.position.set(0, 0, 10);
  scene.add(hemiLight);

  const backLight = new THREE.PointLight(0x5599ff, 1);
  // backLight.add( new THREE.Mesh( new THREE.SphereGeometry( 1, 1, 8 ), new THREE.MeshBasicMaterial( { color: 0xff0040 } ) ) );
  backLight.position.set(0, 0, 10);
  scene.add(backLight);

  anime({
    targets: backLight.position,
    y: 15,
    duration: 3000,
    easing: "easeOutInCubic",
    direction: "alternate",
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
    controls.autoRotate = true;
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
  setupLight();
  makeTaiji();
  makeBagua();
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
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  if (controls) {
    controls.update();
  }
  if (taiji) {
    taiji.rotation.z = (time * 10) % (Math.PI * 2);
  }
}

export { CANVAS_ID, init, destroy, render };
