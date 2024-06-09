import * as THREE from "three";
import anime from "animejs";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeBufferGeometries } from "$lib/three/BufferGeometryUtils";

let scene, camera, renderer, controls;
let pieces = [];
let materials = [];
let animation = null;
let use_camera_control = true;
const CANVAS_ID = "lego-rubik";
const ASPECT_RATIO = 0.75;
const POOL_SIZE = 20;
const GRADIENT_STEP = 3;
const FACE_RIGHT = 0;
const FACE_LEFT = 1;
const FACE_TOP = 2;
const FACE_BOTTOM = 3;
const FACE_FRONT = 4;
const FACE_BACK = 5;
const CUBE_NUM_DEFAULT = 3;
let cubeNum = CUBE_NUM_DEFAULT;
const CUBE_MARGIN = 0.1;
const CUBE_SIZE = 10.0;


const rubikMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  fog: true,
});
function isInFace(x, y, z, face, depth) {
  return (
    (face == FACE_TOP && y >= cubeNum - depth) ||
    (face == FACE_BOTTOM && y < depth) ||
    (face == FACE_FRONT && z >= cubeNum - depth) ||
    (face == FACE_BACK && z < depth) ||
    (face == FACE_LEFT && x < depth) ||
    (face == FACE_RIGHT && x >= cubeNum - depth)
  );
}
function getColor(x, y, z, face) {
  const FACE_TO_COLOR = [
    0x40a02b, //right - green
    0x89b4fa, //left - purple
    0xf9e2af, //top - yellow
    0xf8fafc, //bottom - white
    0xef4444, //front - red
    0xfe640b, //back - orange
  ];
  const BLACK = 0x181825;

  if (isInFace(x, y, z, face, 1)) {
    return FACE_TO_COLOR[face];
  }
  return BLACK;
}

function getCurrentSize() {
  return cubeNum;
}

function makeSingleCube(x, y, z) {
  const piece = new THREE.BoxGeometry({
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    depth: CUBE_SIZE,
  }).toNonIndexed();
  const n = piece.getAttribute("position").count / 6;
  const buffer = [];
  const color = new THREE.Color();
  for (let i = 0; i < n; i++) {
    color.setHex(getColor(x, y, z, i));
    for (let j = 0; j < 6; j++) {
      buffer.push(color.r, color.g, color.b);
    }
  }
  piece.setAttribute("color", new THREE.Float32BufferAttribute(buffer, 3));
  return piece;
}

let cubes = null;
let pivot = null;

function makeRubik() {
  cubes = new Array(cubeNum);
  for (let x = 0; x < cubeNum; x++) {
    cubes[x] = new Array(cubeNum);
    for (let y = 0; y < cubeNum; y++) {
      cubes[x][y] = new Array(cubeNum);
    }
  }
  for (let x = 0; x < cubeNum; x++) {
    for (let y = 0; y < cubeNum; y++) {
      for (let z = 0; z < cubeNum; z++) {
        const geometry = makeSingleCube(x, y, z);
        const cube = new THREE.Mesh(geometry, rubikMaterial);
        cube.position.x = x * (1 + CUBE_MARGIN) * CUBE_SIZE;
        cube.position.y = y * (1 + CUBE_MARGIN) * CUBE_SIZE;
        cube.position.z = z * (1 + CUBE_MARGIN) * CUBE_SIZE;
        cubes[x][y][z] = cube;
        scene.add(cube);
        //addDebugArrow(cube);
      }
    }
  }
  pivot = new THREE.Object3D();
  const k = ((cubeNum - 1) / 2) * (1 + CUBE_MARGIN);
  pivot.position.x = k;
  pivot.position.y = k;
  pivot.position.z = k;
  scene.add(pivot);
  camera.lookAt(pivot.position);
  if (controls) {
    controls.target.set(k, k, k);
    controls.enableRotate = false;
    controls.autoRotate = false;
  }
  //addDebugArrow(pivot);
}

function remakeRubik(n) {
  if (cubeNum == n) {
    return;
  }
  scene.clear();
  cubeNum = n;
  makeRubik();
}
function startMove(face, depth, magnitude) {
  for (let x = 0; x < cubeNum; x++) {
    for (let y = 0; y < cubeNum; y++) {
      for (let z = 0; z < cubeNum; z++) {
        if (!isInFace(x, y, z, face, depth)) {
          continue;
        }
        pivot.attach(cubes[x][y][z]);
      }
    }
  }
  let targetX = pivot.rotation.x;
  let targetY = pivot.rotation.y;
  let targetZ = pivot.rotation.z;
  if (face == FACE_LEFT || face == FACE_RIGHT) {
    targetX += (Math.PI / 2) * magnitude;
  } else if (face == FACE_TOP || face == FACE_BOTTOM) {
    targetY += (Math.PI / 2) * magnitude;
  } else if (face == FACE_FRONT || face == FACE_BACK) {
    targetZ += (Math.PI / 2) * magnitude;
  }
  const easingFunctions = [
    "easeInElastic",
    "easeOutElastic",
    "easeInOutElastic",
    "easeOutInElastic",
    "easeInQuad",
    "easeInCubic",
    "easeInQuart",
    "easeInQuint",
    "easeInSine",
    "easeInExpo",
    "easeInCirc",
    "easeInBack",
    "easeOutQuad",
    "easeOutCubic",
    "easeOutQuart",
    "easeOutQuint",
    "easeOutSine",
    "easeOutExpo",
    "easeOutCirc",
    "easeOutBack",
    "easeInBounce",
    "easeInOutQuad",
    "easeInOutCubic",
    "easeInOutQuart",
    "easeInOutQuint",
    "easeInOutSine",
    "easeInOutExpo",
    "easeInOutCirc",
    "easeInOutBack",
    "easeInOutBounce",
    "easeOutBounce",
    "easeOutInQuad",
    "easeOutInCubic",
    "easeOutInQuart",
    "easeOutInQuint",
    "easeOutInSine",
    "easeOutInExpo",
    "easeOutInCirc",
    "easeOutInBack",
    "easeOutInBounce",
  ];
  const easing =
    easingFunctions[Math.floor(Math.random() * easingFunctions.length)];
  anime({
    targets: pivot.rotation,
    x: targetX,
    y: targetY,
    z: targetZ,
    duration: 600 * Math.abs(magnitude),
    round: 100,
    delay: 200,
    easing: easing,
    complete: () => {
      cleanUpAfterMove();
      startMove(
        Math.floor(Math.random() * 5),
        Math.floor(Math.random() * cubeNum),
        Math.floor(Math.random() * 5) - 2
      );
    },
  });
}

function cleanUpAfterMove() {
  const clamp = function (n, l, r) {
    return Math.min(r, Math.max(l, n));
  };
  const posToIndex = function (n) {
    return clamp(Math.round(n / (1 + CUBE_MARGIN)), 0, cubeNum - 1);
  };
  const newCubes = cubes;
  for (let i = pivot.children.length - 1; i >= 0; i--) {
    const cube = pivot.children[i];
    const pos = new THREE.Vector3();
    scene.attach(cube);
    cube.getWorldPosition(pos);
    const x = posToIndex(pos.x);
    const y = posToIndex(pos.y);
    const z = posToIndex(pos.z);
    cube.position.x = x * (1 + CUBE_MARGIN);
    cube.position.y = y * (1 + CUBE_MARGIN);
    cube.position.z = z * (1 + CUBE_MARGIN);
    newCubes[x][y][z] = cube;
  }
  cubes = newCubes;
  pivot.rotation.x = pivot.rotation.y = pivot.rotation.z = 0;
}

export function setCameraControl(use) {
  use_camera_control = use;
  rebuildOrbitControl();
}

function makeLegoRing() {
  const PIECE_COUNT = 30;
  const ELEVATION = 5;
  const RADIUS = 25;
  const ring = new THREE.Object3D();
  for (let i = 0; i < PIECE_COUNT; i++) {
    const node = new THREE.Mesh(
      getRandomPieceFromPool(),
      getRandomMaterialFromPool()
    );
    const rotation = Math.random() * Math.PI * 2;
    const elevation = (Math.random() - 0.5) * ELEVATION;
    const duration = Math.random() * 4000 + 20000;
    ring.add(node);
    const particle = {
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
      update: (_) => {
        const x = Math.sin(particle.rotation) * RADIUS;
        const z = Math.cos(particle.rotation) * RADIUS;
        const y = particle.elevation;
        particle.node.position.set(x, y, z);
        particle.node.lookAt(0, 0, 0);
      },
    });
  }
  scene.add(ring);
}

function makeCenterPiece() {
  const material = getRandomMaterialFromPool();
  const OFFSET = 5;
  const cube = new THREE.Object3D();
  const geometry = makeLegoPiece(2, 2, 1);
  const nodeA = new THREE.Mesh(geometry, material);
  nodeA.position.set(0, OFFSET, 0);
  nodeA.scale.set(8, 8, 8);
  const nodeB = new THREE.Mesh(geometry, material);
  nodeB.position.set(0, -OFFSET, 0);
  nodeB.scale.set(8, 8, 8);
  nodeB.rotation.set(Math.PI, 0, 0);
  cube.add(nodeA);
  cube.add(nodeB);

  const nodeC = new THREE.Mesh(geometry, material);
  nodeC.position.set(0, 0, -OFFSET);
  nodeC.scale.set(8, 8, 8);
  nodeC.rotation.set(-Math.PI / 2, 0, 0);
  const nodeD = new THREE.Mesh(geometry, material);
  nodeD.position.set(0, 0, OFFSET);
  nodeD.scale.set(8, 8, 8);
  nodeD.rotation.set(Math.PI / 2, 0, 0);
  cube.add(nodeC);
  cube.add(nodeD);

  const nodeE = new THREE.Mesh(geometry, material);
  nodeE.position.set(OFFSET, 0, 0);
  nodeE.scale.set(8, 8, 8);
  nodeE.rotation.set(0, 0, -Math.PI / 2);
  const nodeF = new THREE.Mesh(geometry, material);
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
  const nodes = [nodeA, nodeB, nodeC, nodeD, nodeE, nodeF];
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
  const light = new THREE.AmbientLight(0x666666); // soft white light
  scene.add(light);
  const hemiLight = new THREE.HemisphereLight(0x999999, 0x000000, 1);
  hemiLight.position.set(0, 30, 0);
  scene.add(hemiLight);

  const backLight = new THREE.PointLight(0x5599ff, 1);
  // backLight.add( new THREE.Mesh( new THREE.SphereGeometry( 1, 1, 8 ), new THREE.MeshBasicMaterial( { color: 0xff0040 } ) ) );
  backLight.position.set(0, 20, 0);
  scene.add(backLight);

  // anime({
  //   targets: backLight.position,
  //   y: 15,
  //   duration: 3000,
  //   easing: "easeOutInCubic",
  //   direction: "alternate",
  //   loop: true,
  // });
}

function buildPiecePool() {
  for (let i = 0; i < POOL_SIZE; i++) {
    const w = Math.floor(Math.random() * 6) + 2;
    const h = Math.floor(Math.random() * 2) + 2;
    pieces.push(makeLegoPiece(w, h));
  }
  const colors = [
    0xfab387, //peach
    0x89b4fa, //blue
    0x89b4fa, //purple
    0xef4444, //red
    0xfe640b, //orange
  ];
  const gradients = new Uint8Array(GRADIENT_STEP);
  for (var i = 0; i < gradients.length; i++) {
    gradients[i] = (i / gradients.length) * 256;
  }
  const gradientMap = new THREE.DataTexture(
    gradients,
    gradients.length,
    1,
    THREE.RedFormat
  );
  gradientMap.needsUpdate = true;

  materials = colors
    .map((v) => new THREE.Color(v))
    .map(
      (color) => new THREE.MeshToonMaterial({ color, gradientMap, fog: true })
    );
}

function getRandomPieceFromPool() {
  const i = Math.floor(Math.random() * pieces.length);
  return pieces[i];
}
function getRandomMaterialFromPool() {
  const i = Math.floor(Math.random() * materials.length);
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
  const pieces = [ab, bc, cd, da, plank];
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
  scene.fog = new THREE.Fog(0x000000, 50, 100);
  camera.position.set(40, 40, 40);
  camera.lookAt(0, 0, 0);
  rebuildOrbitControl();
}

function rebuildOrbitControl() {
  if (!use_camera_control) {
    controls = null;
    return;
  }
  if (!renderer || !renderer.domElement || !camera) {
    return;
  }
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  //controls.enablePan = false;
  controls.minDistance = 40; // the minimum distance the camera must have from center
  controls.maxDistance = 100; // the maximum distance the camera must have from center
  //controls.update();
  controls.maxPolarAngle = controls.minPolarAngle = Math.PI * 0.25;
  //controls.enableRotate = true;
  // controls.autoRotate = true;
}

export function animateCamera(t) {
  // rotate camera around camera target for an amount based on t
  if (camera) {
    let distance = 100 - 25 * t;
    if(camera.distance === undefined) {
      camera.distance = camera.position.length();
    }
    anime({
      targets: camera,
      distance: distance,
      duration: 1000,
      update: () => {
        camera.position.setLength(camera.distance);
        camera.lookAt(0, 0, 0);
      },
      onComplete: () => {
        if(t >= 0.9) {
          controls.enableRotate = true;
          controls.autoRotate = true;
        }
      }
    });
  }
}

function init() {
  const canvas = document.getElementById(CANVAS_ID);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight; //w * ASPECT_RATIO;
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
  buildPiecePool();
  makeLegoRing();
  makeCenterPiece();
  setupLight();
  makeRubik();
  startMove(
    Math.floor(Math.random() * 5),
    Math.floor(Math.random() * cubeNum),
    Math.floor(Math.random() * 5) - 2
  );
  window.addEventListener("resize", onWindowResize);
}

function destroy() {
  renderer.dispose();
}

function onWindowResize() {
  const canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    return;
  }
  canvas.style = "";
  const w = canvas.clientWidth;
  const h = canvas.clientHeight; //w * ASPECT_RATIO;
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
  animation.restart();
}

export { CANVAS_ID, init, destroy, render, playAnimation };
