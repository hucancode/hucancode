import {
  BoxGeometry,
  Clock,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { animate, eases } from "animejs";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let scene, camera, renderer, controls;
const clock = new Clock();
const material = new MeshBasicMaterial({
  vertexColors: true,
});
var time = 0;
const CANVAS_ID = "rubik3r";
const USE_CAMERA_CONTROL = true;
const ASPECT_RATIO = 0.75;
const FACE_RIGHT = 0;
const FACE_LEFT = 1;
const FACE_TOP = 2;
const FACE_BOTTOM = 3;
const FACE_FRONT = 4;
const FACE_BACK = 5;
const CUBE_NUM_DEFAULT = 3;
let cubeNum = CUBE_NUM_DEFAULT;
const CUBE_MARGIN = 0.1;
let move = 0;
let isInIntro = false;

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
  const piece = new BoxGeometry().toNonIndexed();
  const n = piece.getAttribute("position").count / 6;
  const buffer = [];
  const color = new Color();
  for (let i = 0; i < n; i++) {
    color.setHex(getColor(x, y, z, i));
    for (let j = 0; j < 6; j++) {
      buffer.push(color.r, color.g, color.b);
    }
  }
  piece.setAttribute("color", new Float32BufferAttribute(buffer, 3));
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
        const cube = new Mesh(geometry, material);
        cube.position.x = x * (1 + CUBE_MARGIN);
        cube.position.y = y * (1 + CUBE_MARGIN);
        cube.position.z = z * (1 + CUBE_MARGIN);
        cubes[x][y][z] = cube;
        scene.add(cube);
      }
    }
  }
  pivot = new Object3D();
  const k = ((cubeNum - 1) / 2) * (1 + CUBE_MARGIN);
  pivot.position.x = k;
  pivot.position.y = k;
  pivot.position.z = k;
  scene.add(pivot);
  camera.lookAt(pivot.position);
  controls.target.set(k, k, k);
  camera.position.set(0, 2 + cubeNum * 2, 5 + cubeNum * 2);
  isInIntro = true;
}

function remakeRubik(n) {
  scene.clear();
  cubeNum = n;
  makeRubik();
}

function setupCamera(w, h) {
  camera = new PerspectiveCamera(45, w / h, 1, 2000);
  scene = new Scene();
  camera.position.set(0, 0, 0);
  rebuildOrbitControl();
}

function rebuildOrbitControl() {
  if (!USE_CAMERA_CONTROL) {
    return;
  }
  controls = new OrbitControls(camera, renderer.domElement);
  const k = ((cubeNum - 1) / 2) * (1 + CUBE_MARGIN);
  controls.target.set(k, k, k);
  //controls.enablePan = false;
  controls.minDistance = 4; // the minimum distance the camera must have from center
  controls.maxDistance = 30; // the maximum distance the camera must have from center
  //controls.update();
  controls.enableRotate = true;
  controls.autoRotate = true;
}

function init() {
  const canvas = document.getElementById(CANVAS_ID);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight; //w * ASPECT_RATIO;
  renderer = new WebGLRenderer({
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
  makeRubik();
  startMove(0, 1, 1);
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

function startMove(face, depth, magnitude) {
  move++; // Increment to prevent concurrent animations
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
  animate(pivot.rotation, {
    x: targetX,
    y: targetY,
    z: targetZ,
    easing: eases.linear(),
    duration: 600 * Math.abs(magnitude),
    round: 100,
    delay: 200,
    onComplete: cleanUpAfterMove,
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
    const pos = new Vector3();
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
  move = 0; // Reset to allow next animation
}

function render() {
  time += clock.getDelta();
  
  // Automatic rotation
  if (move === 0 && Math.random() < 0.02) {
    const faces = [FACE_RIGHT, FACE_LEFT, FACE_TOP, FACE_BOTTOM, FACE_FRONT, FACE_BACK];
    const face = faces[Math.floor(Math.random() * faces.length)];
    const depth = Math.floor(Math.random() * cubeNum) + 1;
    const magnitude = Math.random() < 0.5 ? 1 : -1;
    startMove(face, depth, magnitude);
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  if (controls) {
    controls.update();
  }
}

export { CANVAS_ID, init, destroy, render, getCurrentSize, remakeRubik };
