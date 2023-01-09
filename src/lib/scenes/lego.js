import * as THREE from "three";
import anime from "animejs";
import { OrbitControls } from "$lib/three/controls/OrbitControls";
import { mergeBufferGeometries } from "$lib/three/BufferGeometryUtils";

let scene, camera, renderer, controls;
let pieces = [];
let particles = [];
let materials = [];
let animation = null;
const CANVAS_ID = "lego";
const USE_CAMERA_CONTROL = true;
const ASPECT_RATIO = 0.75;
const POOL_SIZE = 20;

function makeLegoRing() {
  const PIECE_COUNT = 30;
  const ELEVATION = 5;
  const RADIUS = 25;
  let ring = new THREE.Object3D();
  for (let i = 0; i < PIECE_COUNT; i++) {
    let node = new THREE.Mesh(
      getRandomPieceFromPool(),
      getRandomMaterialFromPool()
    );
    let rotation = Math.random() * Math.PI * 2;
    let elevation = (Math.random() - 0.5) * ELEVATION;
    let duration = Math.random() * 2000 + 5000;
    ring.add(node);
    let particle = {
      node: node,
      elevation: elevation,
      rotation: rotation,
    };
    anime({
      targets: particle,
      rotation: rotation + Math.PI * 2,
      duration: duration,
      easing: "linear",
      direction: "reverse",
      loop: true,
      update: (anim) => {
        let x = Math.sin(particle.rotation) * RADIUS;
        let z = Math.cos(particle.rotation) * RADIUS;
        let y = particle.elevation;
        particle.node.position.set(x, y, z);
        particle.node.lookAt(0, 0, 0);
      },
    });
  }
  scene.add(ring);
}

function makeCenterPiece() {
  let material = getRandomMaterialFromPool();
  const OFFSET = 5;
  let cube = new THREE.Object3D();
  let geometry = makeLegoPiece(2, 2, 1);
  let nodeA = new THREE.Mesh(geometry, material);
  nodeA.position.set(0, OFFSET, 0);
  nodeA.scale.set(8, 8, 8);
  let nodeB = new THREE.Mesh(geometry, material);
  nodeB.position.set(0, -OFFSET, 0);
  nodeB.scale.set(8, 8, 8);
  nodeB.rotation.set(Math.PI, 0, 0);
  cube.add(nodeA);
  cube.add(nodeB);

  let nodeC = new THREE.Mesh(geometry, material);
  nodeC.position.set(0, 0, -OFFSET);
  nodeC.scale.set(8, 8, 8);
  nodeC.rotation.set(-Math.PI / 2, 0, 0);
  let nodeD = new THREE.Mesh(geometry, material);
  nodeD.position.set(0, 0, OFFSET);
  nodeD.scale.set(8, 8, 8);
  nodeD.rotation.set(Math.PI / 2, 0, 0);
  cube.add(nodeC);
  cube.add(nodeD);

  let nodeE = new THREE.Mesh(geometry, material);
  nodeE.position.set(OFFSET, 0, 0);
  nodeE.scale.set(8, 8, 8);
  nodeE.rotation.set(0, 0, -Math.PI / 2);
  let nodeF = new THREE.Mesh(geometry, material);
  nodeF.position.set(-OFFSET, 0, 0);
  nodeF.scale.set(8, 8, 8);
  nodeF.rotation.set(0, 0, Math.PI / 2);
  cube.add(nodeE);
  cube.add(nodeF);
  scene.add(cube);

  anime({
    targets: cube.rotation,
    x: Math.PI * 2,
    duration: 23000,
    easing: "easeOutInQuart",
    direction: "reverse",
    loop: true,
  });
  anime({
    targets: cube.rotation,
    y: Math.PI * 2,
    duration: 31000,
    easing: "easeOutInQuart",
    direction: "reverse",
    loop: true,
  });
  anime({
    targets: cube.rotation,
    z: Math.PI * 2,
    duration: 43000,
    easing: "easeOutInQuart",
    direction: "reverse",
    loop: true,
  });
  let nodes = [nodeA, nodeB, nodeC, nodeD, nodeE, nodeF];
  nodes.forEach((e) => (e.offsetScale = 1));
  animation = anime({
    targets: nodes,
    offsetScale: 3,
    duration: 500,
    delay: anime.stagger(60),
    direction: "alternate",
    autoplay: false,
    easing: "easeInOutElastic",
    update: () => {
      nodes.forEach((e) => {
        e.position.setLength(e.offsetScale * OFFSET);
      });
    },
  });
}

function setupLight() {
  const light = new THREE.AmbientLight(0xcccccc); // soft white light
  scene.add(light);
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  hemiLight.position.set(0, 30, 0);
  // scene.add(hemiLight);

  const backLight = new THREE.PointLight(0xffffff, 1);
  // backLight.add( new THREE.Mesh( new THREE.SphereGeometry( 1, 1, 8 ), new THREE.MeshBasicMaterial( { color: 0xff0040 } ) ) );
  backLight.position.set(0, 30, 0);
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

function buildPiecePool() {
  for (let i = 0; i < POOL_SIZE; i++) {
    let w = Math.floor(Math.random() * 6) + 2;
    let h = Math.floor(Math.random() * 2) + 2;
    pieces.push(makeLegoPiece(w, h));
  }
  const colors = [
    0xfab387, //peach
    0x89b4fa, //blue
    0x89b4fa, //purple
    0xef4444, //red
    0xfe640b, //orange
  ];

  materials = colors
    .map((v) => new THREE.Color(v))
    .map((color) => new THREE.MeshStandardMaterial({ color: color }));
}

function getRandomPieceFromPool() {
  let i = Math.floor(Math.random() * pieces.length);
  return pieces[i];
}
function getRandomMaterialFromPool() {
  let i = Math.floor(Math.random() * materials.length);
  return materials[i];
}

function makeLegoPiece(width, height, depth = 1, thickness = 0.2) {
  const hh = (height - thickness) / 2;
  const hw = (width - thickness) / 2;
  const ab = new THREE.BoxGeometry(width, depth, thickness);
  ab.translate(0, 0, -hh);
  const bc = new THREE.BoxGeometry(thickness, depth, height);
  bc.translate(hw, 0, 0);
  const cd = new THREE.BoxGeometry(width, depth, thickness);
  cd.translate(0, 0, hh);
  const da = new THREE.BoxGeometry(thickness, depth, height);
  da.translate(-hw, 0, 0);
  const plank = new THREE.BoxGeometry(width, thickness, height);
  plank.translate(0, depth / 2, 0);
  let pieces = [ab, bc, cd, da, plank];
  const BUTTON_RADIUS = 0.4;
  const BUTTON_HEIGHT = 0.3;
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const button = new THREE.CylinderGeometry(
        BUTTON_RADIUS,
        BUTTON_RADIUS,
        BUTTON_HEIGHT,
        24
      );
      button.translate(
        i - (width - 1) / 2,
        BUTTON_HEIGHT * 2,
        j - (height - 1) / 2
      );
      pieces.push(button);
    }
  }
  const geometry = mergeBufferGeometries(pieces);
  return geometry;
}

function setupCamera(w, h) {
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
  scene = new THREE.Scene();
  camera.position.set(40, 40, 40);
  rebuildOrbitControl();
}

function rebuildOrbitControl() {
  if (USE_CAMERA_CONTROL) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    //controls.enablePan = false;
    controls.minDistance = 40; // the minimum distance the camera must have from center
    controls.maxDistance = 100; // the maximum distance the camera must have from center
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
    rebuildOrbitControl();
    return;
  }
  setupCamera(w, h);
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);
  buildPiecePool();
  makeLegoRing();
  makeCenterPiece();
  setupLight();
  window.addEventListener("resize", onWindowResize);
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
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  if (controls) {
    controls.update();
  }
}

function playAnimation() {
  animation.play();
  console.log("play", animation);
}

export { CANVAS_ID, init, render, playAnimation };
