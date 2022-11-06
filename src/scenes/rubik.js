"use client";
import * as THREE from "three";
import anime from 'animejs';
import { OrbitControls } from "../three/controls/OrbitControls";
import Canvas3D from "./canvas3D";

let scene, camera, renderer, controls;
let clock = new THREE.Clock();
var time = 0;
const CANVAS_ID = "rubik";
const USE_CAMERA_CONTROL = true;
const ASPECT_RATIO = 0.75;
const FACE_RIGHT = 0;
const FACE_LEFT = 1;
const FACE_TOP = 2;
const FACE_BOTTOM = 3;
const FACE_FRONT = 4;
const FACE_BACK = 5;
const CUBE_NUM = 3;
const CUBE_MARGIN = 0.1;
let lastMove = -1;

function isInFace(x,y,z,face) {
  if((face == FACE_TOP && y == CUBE_NUM-1) ||
    (face == FACE_BOTTOM && y == 0) ||
    (face == FACE_FRONT && z == CUBE_NUM-1) ||
    (face == FACE_BACK && z == 0) ||
    (face == FACE_LEFT && x == 0) ||
    (face == FACE_RIGHT && x == CUBE_NUM-1)) {
    return true;
  }
  return false;
}
function getColor(x, y, z, face) {
  const FACE_TO_COLOR = [
    0x22c55e,//right - green
    0xa855f7,//left - purple
    0xfde047,//top - yellow
    0xf8fafc,//bottom - white
    0xef4444,//front - red
    0xea580c,//back - orange
  ];
  const BLACK = 0x000000;

  if(isInFace(x,y,z,face)) {
    return FACE_TO_COLOR[face];
  }
  return BLACK;
}

function makeSingleCube(x,y,z) {
  const piece = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const positionAttribute = piece.getAttribute('position');
  const colors = [];
  const color = new THREE.Color();
  color.setHex(0x000000);
  

  for (let i = 0; i < positionAttribute.count; i += 6) {
    const face = i/6;
    color.setHex(getColor(x,y,z,face));

    colors.push(color.r, color.g, color.b);
    colors.push(color.r, color.g, color.b);
    colors.push(color.r, color.g, color.b);

    colors.push(color.r, color.g, color.b);
    colors.push(color.r, color.g, color.b);
    colors.push(color.r, color.g, color.b);
  }
  piece.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return piece;
}

let cubes = null;
let pivot = null;

function makeRubik() {
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true
  });
  cubes = new Array(CUBE_NUM);
  for(let x = 0;x<CUBE_NUM;x++) {
    cubes[x] = new Array(CUBE_NUM);
    for(let y = 0;y<CUBE_NUM;y++) {
      cubes[x][y] = new Array(CUBE_NUM);
    }
  }
  for(let x = 0;x<CUBE_NUM;x++) {
    for(let y = 0;y<CUBE_NUM;y++) {
      for(let z = 0;z<CUBE_NUM;z++) {
        const geometry = makeSingleCube(x,y,z);
        const cube = new THREE.Mesh(geometry, material);
        cube.position.x = x*(1+CUBE_MARGIN);
        cube.position.y = y*(1+CUBE_MARGIN);
        cube.position.z = z*(1+CUBE_MARGIN);
        cubes[x][y][z] = cube;
        scene.add(cube);
        //addDebugArrow(cube);
      }
    }
  }
  pivot = new THREE.Object3D();
  pivot.position.x = (CUBE_NUM - 1)/2*(1+CUBE_MARGIN);
  pivot.position.y = (CUBE_NUM - 1)/2*(1+CUBE_MARGIN);
  pivot.position.z = (CUBE_NUM - 1)/2*(1+CUBE_MARGIN);
  scene.add(pivot);
  camera.lookAt(pivot.position);
  controls.target.set(pivot.position.x, pivot.position.y, pivot.position.z);
  //addDebugArrow(pivot);
}

function setupCamera(w, h) {
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
  scene = new THREE.Scene();
  camera.position.set(0, 5, 8);
  camera.lookAt(scene.position);
  if (USE_CAMERA_CONTROL) {
      controls = new OrbitControls(camera, renderer.domElement);
      //controls.enablePan = false;
      controls.maxPolarAngle =  Math.PI/2; // prevent the camera from going under the ground
      controls.minDistance = 4; // the minimum distance the camera must have from center
      controls.maxDistance = 10; // the maximum distance the camera must have from center
      controls.zoomSpeed = 0.3; // control the zoomIn and zoomOut speed
      controls.rotateSpeed = 0.3; // control the rotate speed
      //controls.update();
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
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  if (scene != null) {
    return;
  }
  setupCamera(w, h);
  makeRubik();
  startMove(Math.floor(Math.random()*5), Math.floor(Math.random()*5)-2);
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
function addDebugArrow(object) {
  const dirZ = new THREE.Vector3(0, 0, 1 );
  const dirY = new THREE.Vector3(0, 1, 0 );
  const dirX = new THREE.Vector3(1, 0, 0 );
  const origin = THREE.Vector3.Zero;//object.position;
  const length = 2;
  const hex = 0x0077ff;
  const zArrow = new THREE.ArrowHelper( dirZ, origin, length, hex );
  object.add( zArrow );
  const yArrow = new THREE.ArrowHelper( dirY, origin, length, hex );
  object.add( yArrow );
  const xArrow = new THREE.ArrowHelper( dirX, origin, length, hex );
  object.add( xArrow );
}

function startMove(face, magnitude) {
  for(let x = 0;x<CUBE_NUM;x++) {
    for(let y = 0;y<CUBE_NUM;y++) {
      for(let z = 0;z<CUBE_NUM;z++) {
        if(!isInFace(x,y,z,face)) {
          continue;
        }
        pivot.attach(cubes[x][y][z]);
      }
    }
  }
  let targetX = pivot.rotation.x;
  let targetY = pivot.rotation.y;
  let targetZ = pivot.rotation.z;
  if(face == FACE_LEFT || face == FACE_RIGHT) {
    targetX += Math.PI/2*magnitude;
  } else if(face == FACE_TOP || face == FACE_BOTTOM) {
    targetY += Math.PI/2*magnitude;
  } else if(face == FACE_FRONT || face == FACE_BACK) {
    targetZ += Math.PI/2*magnitude;
  }
  anime({
    targets: pivot.rotation,
    x: targetX,
    y: targetY,
    z: targetZ,
    duration: 600*Math.abs(magnitude),
    round: 100,
    delay: 200,
    easing: 'easeOutElastic',
    complete: cleanUpAfterMove
  });
  lastMove = face;
}

function cleanUpAfterMove() {
  const clamp = function(n, l, r) {
    return Math.min(r, Math.max(l, n));
  };
  const posToIndex = function(n) {
    return clamp(Math.round(n/(1+CUBE_MARGIN)), 0, CUBE_NUM-1);
  };
  let newCubes = cubes;
  for(let i = pivot.children.length - 1;i>=0;i--) {
    const cube = pivot.children[i];
    const pos = new THREE.Vector3();
    scene.attach(cube);
    cube.getWorldPosition(pos);
    const x = posToIndex(pos.x);
    const y = posToIndex(pos.y);
    const z = posToIndex(pos.z);
    newCubes[x][y][z] = cube;
  }
  cubes = newCubes;
  pivot.rotation.x = pivot.rotation.y = pivot.rotation.z = 0;
  startMove(Math.floor(Math.random() * 5), Math.floor(Math.random()*5) - 2);
}

function animate() {
  time += clock.getDelta();
  if(renderer != null) {
    renderer.render(scene, camera);
  }
  if(controls != null) {
    controls.update();
  }
}

export default class RubikScene extends Canvas3D {
  constructor(props) {
    super(props);
    this.canvasID = CANVAS_ID;
    this.init = init;
    this.animate = animate;
  }
}

