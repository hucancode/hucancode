---
title: How Did I Build The Rubik Cube
excerpt: Detailed break down on how I built the rubik cube with ThreeJS
cover: /blog/post/how-did-i-build-the-rubiks-cube/top-view-little-kid-playing-with-rubics-cube-orange-desk.jpg
date: 2023-01-19
categories:
  - 3d
  - threejs
  - creative-coding
---

<script>
  import Rubik from '$lib/components/rubik.svelte';
  import Rubik1 from '$lib/components/rubik-breakdown-1.svelte';
  import Rubik3 from '$lib/components/rubik-breakdown-3.svelte';
  import Rubik3R from '$lib/components/rubik-breakdown-3r.svelte';
</script>

## Concept & Idea

The Rubik's Cube is a 3-D combination puzzle that has been around since 1974. One of it's interesting property is that there are so many combinations. Somebody has done the math and apparently it is indeed alot

$$
8! \times 3^7 \times \frac{12!}{2} \times 2^{11} \approx 4.3 \times 10^{19}
$$

The Rubik's Cube is not only interesting, it is also beautiful aesthetically. Let's take a look at some art people have done with cubes

<img class="w-full sm:w-1/2 mx-auto" alt="cube" src="how-did-i-build-the-rubiks-cube/3d-render-rainbow-coloured-cubes.jpg" />

Today I will use `ThreeJS` to build a Rubik's Cube. Our Cube would be able to rotate like a real cube. We will not cover manual rotation here because a good controller would be very tricky to get right. We will also not cover Cube solving because I am not too smart, I just want to look at the Cube not solving them.

## Breakdown

### Build single cube

![cube](how-did-i-build-the-rubiks-cube/single-cube.png)

We need to consider 2 things

1. The cube geometry
2. The cube's color data

Thank to `ThreeJS` we can make a cube geometry easily with

```js
const piece = new THREE.BoxGeometry();
```

Then we need to give color to each face

```js
const vertices = piece.getAttribute("position").count;
const faces = vertices / 6;
const buffer = [];
const color = new THREE.Color();
for (let f = 0; f < faces; i++) {
  color.setHex(getColor(x, y, z, f));
  for (let j = 0; j < 6; j++) {
    buffer.push(color.r, color.g, color.b);
  }
}
piece.setAttribute("color", new THREE.Float32BufferAttribute(buffer, 3));
```

If you have experience with OpenGL or something similar before, this code will looks obvious to your eyes. But if you don't, here is a brief explaination about what the code done:

- Get the number of $faces$ by taking $vertices \div 6$. Because 3 $vertices$ make up a $triangle$, 2 $triangle$ make up a $face$
- For each face, calculate color based on that face, push the result to the buffer. Notice that we have to push 6 times for 6 vertices
- Send the color buffer back to vertices data

Here is our completed cube

<div class="rubik">
    <Rubik1 />
</div>

### Add more cubes (build 3x3 cubes)

When you have done making a single cube, it's trivial to build more cubes. Just throw a loop and check out your new creation!
Some small details to look out for:

- Remember to a little gap between cubes
- Avoid wasting resource by reusing material

```js
for (let x = 0; x < cubeNum; x++) {
  for (let y = 0; y < cubeNum; y++) {
    for (let z = 0; z < cubeNum; z++) {
      const geometry = makeSingleCube(x, y, z);
      const cube = new THREE.Mesh(geometry, material);
      cube.position.x = x * (1 + CUBE_MARGIN);
      cube.position.y = y * (1 + CUBE_MARGIN);
      cube.position.z = z * (1 + CUBE_MARGIN);
      cubes[x][y][z] = cube;
      scene.add(cube);
    }
  }
}
```

Here is the finished 3x3 Cube

<div class="rubik">
    <Rubik3 />
  </div>

### Rotate the cube

Here is the tricky part, obviously the cubes do not rotate one by one. There has to be a parent-child relation here. At first I was confused but later I figured it out.

My approach is based on some observation:

- Rotations has to be done in group
- We need to group relevant pieces together each time we rotate
- After we done rotating, ungroup them
- Rotation pivot stay the same at the center of the Cube

![cube](how-did-i-build-the-rubiks-cube/rotation.png)

Group & rotate function

```js
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
  anime({
    targets: pivot.rotation,
    x: targetX,
    y: targetY,
    z: targetZ,
    easing: "linear",
    duration: 600 * Math.abs(magnitude),
    round: 100,
    delay: 200,
    complete: cleanUpAfterMove,
  });
}
```

Ungroup function

```js
function cleanUpAfterMove() {
  const clamp = function (n, l, r) {
    return Math.min(r, Math.max(l, n));
  };
  const posToIndex = function (n) {
    return clamp(Math.round(n / (1 + CUBE_MARGIN)), 0, cubeNum - 1);
  };
  let newCubes = cubes;
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
```

The result will looks somewhere like this

<div class="rubik">
    <Rubik3R />
</div>

### And finally let's add some variations

At this point, it's up to your creativity to add more interesting features.
I would like to add more dimension, then add some goofy easing curve to spice up the rotation.

<div class="rubik">
    <Rubik size={5} />
</div>

## Code

Check out this [page](/rubik) and the code below

<details>

<summary>Full implementation</summary>

```js
import * as THREE from "three";
import anime from "animejs";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let scene, camera, renderer, controls;
const clock = new THREE.Clock();
const material = new THREE.MeshBasicMaterial({
  vertexColors: true,
});
let cameraTarget;
let isInIntro = false;
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
const CUBE_NUM_DEFAULT = 3;
let cubeNum = CUBE_NUM_DEFAULT;
const CUBE_MARGIN = 0.1;

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
        const cube = new THREE.Mesh(geometry, material);
        cube.position.x = x * (1 + CUBE_MARGIN);
        cube.position.y = y * (1 + CUBE_MARGIN);
        cube.position.z = z * (1 + CUBE_MARGIN);
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
  controls.target.set(k, k, k);
  controls.enableRotate = false;
  controls.autoRotate = false;
  cameraTarget.set(0, 2 + cubeNum * 2, 5 + cubeNum * 2);
  isInIntro = true;
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

function setupCamera(w, h) {
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
  scene = new THREE.Scene();
  camera.position.set(0, 0, 0);
  cameraTarget = new THREE.Vector3(0, 0, 0);
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
function addDebugArrow(object) {
  const dirZ = new THREE.Vector3(0, 0, 1);
  const dirY = new THREE.Vector3(0, 1, 0);
  const dirX = new THREE.Vector3(1, 0, 0);
  const origin = THREE.Vector3.Zero; //object.position;
  const length = 2;
  const hex = 0x0077ff;
  const zArrow = new THREE.ArrowHelper(dirZ, origin, length, hex);
  object.add(zArrow);
  const yArrow = new THREE.ArrowHelper(dirY, origin, length, hex);
  object.add(yArrow);
  const xArrow = new THREE.ArrowHelper(dirX, origin, length, hex);
  object.add(xArrow);
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
    complete: cleanUpAfterMove,
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
  startMove(
    Math.floor(Math.random() * 5),
    Math.floor(Math.random() * cubeNum),
    Math.floor(Math.random() * 5) - 2
  );
}

function render() {
  time += clock.getDelta();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  if (controls) {
    controls.update();
  }
  if (isInIntro && camera) {
    camera.position.lerp(cameraTarget, 0.1);
    if (camera.position.distanceTo(cameraTarget) < 0.01) {
      isInIntro = false;
      controls.enableRotate = true;
      controls.autoRotate = true;
    }
  }
}

export { CANVAS_ID, init, destroy, render, getCurrentSize, remakeRubik };
```

</details>

<style>
  .rubik {
    aspect-ratio: 1/1;
    max-width: 400px;
    width: 80%;
    margin: 0 auto;
  }
</style>
