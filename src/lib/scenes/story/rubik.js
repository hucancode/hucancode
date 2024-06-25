import * as THREE from "three";
import anime from "animejs";

const rubik = new THREE.Object3D();
const pivot = new THREE.Object3D();
const cubes = [];
const material = new THREE.MeshBasicMaterial({
  vertexColors: true,
  fog: true,
});
const FACE_RIGHT = 0;
const FACE_LEFT = 1;
const FACE_TOP = 2;
const FACE_BOTTOM = 3;
const FACE_FRONT = 4;
const FACE_BACK = 5;
const RUBIK_SIZE = 8;
const CUBE_NUM_DEFAULT = 3;
const CUBE_MARGIN = 0.1;
const EASING_FUNCTIONS = [
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
let cubeNum = CUBE_NUM_DEFAULT;

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

function makeSingleCube(x, y, z) {
  const piece = new THREE.BoxGeometry().toNonIndexed();
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

function makeRubik() {
  for (let x = 0; x < cubeNum; x++) {
    for (let y = 0; y < cubeNum; y++) {
      for (let z = 0; z < cubeNum; z++) {
        const geometry = makeSingleCube(x, y, z);
        const cube = new THREE.Mesh(geometry, material);
        rubik.add(cube);
        cubes.push(cube);
        //addDebugArrow(cube);
      }
    }
  }
  const k = ((cubeNum - 1) / 2) * (1 + CUBE_MARGIN);
  rubik.scale.setScalar(RUBIK_SIZE);
  rubik.position.setScalar(-k * RUBIK_SIZE);
  rubik.position.setComponent(1, rubik.position.y + 100);
  //addDebugArrow(pivot);
}

function rearrangeRubik() {
  transferCubes();
  var i = 0;
  for (let x = 0; x < cubeNum; x++) {
    for (let y = 0; y < cubeNum; y++) {
      for (let z = 0; z < cubeNum; z++) {
        const cube = cubes[i];
        cube.position.set(x, y, z).multiplyScalar(1 + CUBE_MARGIN);
        cube.rotation.set(0, 0, 0);
        i++;
      }
    }
  }
}

function transferCubes() {
  anime.remove(pivot.rotation);
  for (var i = pivot.children.length - 1; i >= 0; i--) {
    rubik.attach(pivot.children[i]);
  }
  pivot.rotation.set(0, 0, 0);
}

function init() {
  makeRubik();
}

function enter(scene) {
  anime.remove(rubik.position);
  rearrangeRubik();
  scene.add(rubik);
  scene.add(pivot);
  const k = ((cubeNum - 1) / 2) * (1 + CUBE_MARGIN);
  anime({
    targets: rubik.position,
    y: -k * RUBIK_SIZE,
    easing: "easeOutElastic",
    duration: 2000,
    complete: () => {
      startMove(
        Math.floor(Math.random() * 5),
        Math.floor(Math.random() * cubeNum),
        Math.floor(Math.random() * 5) - 2
      );
    },
  });
}

function update() {}

function scroll() {}

function leave(scene) {
  transferCubes();
  anime.remove(pivot.rotation);
  anime.remove(rubik.position);
  let y = rubik.position.y + 100;
  anime({
    targets: rubik.position,
    y,
    duration: 500,
    easing: "easeInOutQuad",
    complete: () => {
      scene.remove(rubik);
      scene.remove(pivot);
    },
  });
}

function startMove(face, depth, magnitude) {
  for (var i = rubik.children.length - 1; i >= 0; i--) {
    let cube = rubik.children[i];
    let p = new THREE.Vector3();
    cube.getWorldPosition(p);
    p.sub(rubik.position)
      .divide(rubik.scale)
      .divideScalar(1 + CUBE_MARGIN)
      .round();
    if (isInFace(p.x, p.y, p.z, face, depth)) {
      pivot.attach(cube);
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
  const easing =
    EASING_FUNCTIONS[Math.floor(Math.random() * EASING_FUNCTIONS.length)];
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
      transferCubes();
      startMove(
        Math.floor(Math.random() * 5),
        Math.floor(Math.random() * cubeNum),
        Math.floor(Math.random() * 5) - 2
      );
    },
  });
}

export { init, scroll, enter, leave, update };
