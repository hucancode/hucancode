import anime from "animejs";
import {
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from "three";

const rubik = new Object3D();
const pivot = new Object3D();
let cubes = [];
const material = new MeshBasicMaterial({
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

function makeRubik() {
  for (let y = 0; y < cubeNum; y++) {
    for (let x = 0; x < cubeNum; x++) {
      for (let z = 0; z < cubeNum; z++) {
        const geometry = makeSingleCube(x, y, z);
        const cube = new Mesh(geometry, material);
        cube.position.set(x, y, z).multiplyScalar(1 + CUBE_MARGIN);
        rubik.add(cube);
        cubes.push(cube);
        //addDebugArrow(cube);
      }
    }
  }
  const k = ((cubeNum - 1) / 2) * (1 + CUBE_MARGIN);
  rubik.scale.setScalar(RUBIK_SIZE);
  rubik.position.setScalar(-k * RUBIK_SIZE);
  //addDebugArrow(pivot);
}

function rearrangeRubik(offsetX=0, offsetY=0, offsetZ=0) {
  transferCubes();
  var i = 0;
  for (let y = 0; y < cubeNum; y++) {
    for (let x = 0; x < cubeNum; x++) {
      for (let z = 0; z < cubeNum; z++) {
        const cube = cubes[i];
        cube.position
          .set(x + offsetX, y + offsetY, z + offsetZ)
          .multiplyScalar(1 + CUBE_MARGIN);
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
  const targets = cubes.map((e) => e.position);
  anime.remove(targets);
  rearrangeRubik(-5, -20);
  scene.add(rubik);
  scene.add(pivot);
  anime({
    targets,
    y: {
      value: (e, i) => {
        let y = Math.floor(i / cubeNum / cubeNum);
        return y * (1 + CUBE_MARGIN);
      },
      easing: "easeOutElastic",
    },
    x: {
      value: (e, i) => {
        let x = Math.floor(i / cubeNum) % cubeNum;
        return x * (1 + CUBE_MARGIN);
      },
      easing: "easeOutSine",
    },
    delay: anime.stagger(20),
    duration: 1000,
    complete: () => {
      startMoveRandom();
    },
  });
}

function update() {}

function scroll() {}

function leave(scene) {
  transferCubes();
  let targets = cubes.map((e) => e.position);
  anime.remove(pivot.rotation);
  anime.remove(targets);
  anime({
    targets,
    y: {
      value: (e, i) => {
        let y = Math.floor(i / cubeNum / cubeNum);
        return y * (1 + CUBE_MARGIN) - 20;
      },
      easing: "easeInElastic",
    },
    x: {
      value: (e, i) => {
        let x = Math.floor(i / cubeNum) % cubeNum;
        return x * (1 + CUBE_MARGIN) - 5;
      },
      easing: "easeInSine",
    },
    duration: 500,
    delay: anime.stagger(20),
    complete: () => {
      scene.remove(rubik);
      scene.remove(pivot);
    },
  });
}

function startMoveRandom() {
  const face = Math.floor(Math.random() * 5);
  const depth = Math.floor(Math.random() * (cubeNum - 1)) + 1;
  const magnitude =
    (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 2) + 1);
  startMove(face, depth, magnitude);
}

function startMove(face, depth, magnitude) {
  for (var i = rubik.children.length - 1; i >= 0; i--) {
    let cube = rubik.children[i];
    let p = new Vector3();
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
      startMoveRandom();
    },
  });
}

function destroy() {
  cubes.forEach((e) => e.geometry.dispose());
  cubes = [];
  rubik.children = [];
  pivot.children = [];
  rubik.removeFromParent();
  pivot.removeFromParent();
}

export { init, scroll, enter, leave, update, destroy };
