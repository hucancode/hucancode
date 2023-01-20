import * as THREE from "three";
import anime from "animejs";
import { OrbitControls } from "$lib/three/controls/OrbitControls";
import { mergeBufferGeometries } from "$lib/three/BufferGeometryUtils";

var time = 0;
let clock = new THREE.Clock();
let scene, camera, renderer, controls;
let taiji;
let taijiParticle;
let bagua;
let dropAnimation;
const CANVAS_ID = "taiji";
const USE_CAMERA_CONTROL = true;
const TAIJI_ROTATION_CIRCLE = 5000;
const BAGUA_ROTATION_CIRCLE = 13000;

function makeTaiji() {
  const semiCircle = new THREE.CircleGeometry(2, 32, 0, Math.PI);
  const fullCircle = new THREE.CircleGeometry(1, 32);
  const blackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const root = new THREE.Object3D();
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
  root.add(baseA);
  root.add(baseB);
  root.add(yin);
  root.add(yang);
  root.rotation.x = -Math.PI / 2;
  root.scale.x = root.scale.y = Math.PI / 2;
  return root;
}

function makeBagua() {
  const HEIGHT = 5;
  const MARGIN = 0.1;
  const STROKE_WIDTH = 0.1;
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
  return root;
}

function setupObject() {
  // const axesHelper = new THREE.AxesHelper(5);
  // scene.add(axesHelper);
  taiji = makeTaiji();
  anime({
    targets: taiji.rotation,
    z: Math.PI * 2,
    duration: TAIJI_ROTATION_CIRCLE,
    easing: "linear",
    direction: "reverse",
    loop: true,
  });
  scene.add(taiji);
  taijiParticle = makeTaiji();
  taijiParticle.opacity = 1;
  for (let child of taijiParticle.children) {
    child.material.transparent = true;
  }
  taijiParticle.position.y = 10;
  dropAnimation = anime.timeline({
    duration: 1000,
    easing: "easeOutExpo",
    complete: (anim) => {
      console.log("complete");
      taijiParticle.scale.x = taijiParticle.scale.y = 1;
      taijiParticle.position.y = 10;
      taijiParticle.opacity = 1;
    },
  });
  dropAnimation
    .add({
      targets: taijiParticle.rotation,
      z: Math.PI * 4,
    })
    .add(
      {
        targets: taijiParticle.position,
        y: 0.1,
      },
      0
    )
    .add(
      {
        targets: taijiParticle.scale,
        easing: "easeInOutQuad",
        x: 4,
        y: 4,
      },
      0
    )
    .add(
      {
        targets: taijiParticle,
        easing: "easeInOutQuad",
        opacity: 0,
        update: (anim) => {
          for (let child of taijiParticle.children) {
            child.material.opacity = taijiParticle.opacity;
          }
        },
      },
      200
    );
  scene.add(taijiParticle);
  bagua = makeBagua();
  scene.add(bagua);
  anime({
    targets: bagua.rotation,
    z: -Math.PI * 2,
    duration: BAGUA_ROTATION_CIRCLE,
    easing: "linear",
    direction: "reverse",
    loop: true,
  });
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
  setupLight();
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
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  if (controls) {
    controls.update();
  }
}
function playAnimation() {
  dropAnimation.play();
}

export { CANVAS_ID, init, destroy, render, playAnimation };
