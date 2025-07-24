---
title: How Did I Build The Rubik's Cube
excerpt: Building an interactive 3D Rubik's Cube with Three.js - from single cube to rotating puzzle
cover: /blog/post/how-did-i-build-the-rubiks-cube/top-view-little-kid-playing-with-rubics-cube-orange-desk.jpg
date: 2023-01-19
categories:
  - 3d
  - threejs
  - creative-coding
---

## The Challenge

Building a 3D Rubik's Cube that can rotate realistically is more complex than it seems. The cube has {% math %}4.3 \times 10^{19}{% /math %} possible combinations, making it one of the most fascinating puzzles ever created.

![cube art](/blog/post/how-did-i-build-the-rubiks-cube/3d-render-rainbow-coloured-cubes.jpg)

In this post, I'll show you how I built an interactive Rubik's Cube using Three.js, breaking down the process into simple steps.

## Step 1: Building a Single Cube

First, let's create one colorful cube. Each face needs its own color based on the Rubik's Cube color scheme.

![single cube](/blog/post/how-did-i-build-the-rubiks-cube/single-cube.png)

```js
// Create geometry and apply vertex colors
function makeSingleCube(x, y, z) {
  const geometry = new BoxGeometry().toNonIndexed();
  const faceCount = geometry.getAttribute("position").count / 6;
  const colors = [];
  
  // Color each face based on position
  for (let face = 0; face < faceCount; face++) {
    const color = new Color(getColor(x, y, z, face));
    // Each face has 6 vertices (2 triangles)
    for (let v = 0; v < 6; v++) {
      colors.push(color.r, color.g, color.b);
    }
  }
  
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}
```

The color scheme follows the standard Rubik's Cube:
- Right: Green
- Left: Blue  
- Top: Yellow
- Bottom: White
- Front: Red
- Back: Orange

{% rubik size="small" cubes=1 /%}

## Step 2: Assembling the 3×3×3 Cube

Now we'll create 27 cubes arranged in a 3×3×3 grid. The key is maintaining proper spacing and storing references for rotation.

```js
const CUBE_MARGIN = 0.1;  // Gap between cubes
const material = new MeshBasicMaterial({ vertexColors: true });

function makeRubik() {
  // Initialize 3D array to store cube references
  const cubes = Array(3).fill().map(() => 
    Array(3).fill().map(() => Array(3))
  );
  
  // Create and position each cube
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3; z++) {
        const geometry = makeSingleCube(x, y, z);
        const cube = new Mesh(geometry, material);
        
        // Position with gap
        cube.position.set(
          x * (1 + CUBE_MARGIN),
          y * (1 + CUBE_MARGIN),
          z * (1 + CUBE_MARGIN)
        );
        
        cubes[x][y][z] = cube;
        scene.add(cube);
      }
    }
  }
  
  return cubes;
}
```

{% rubik size="medium" cubes=3 /%}

## Step 3: The Rotation System

The trickiest part is implementing realistic rotations. A Rubik's Cube doesn't rotate individual pieces - entire layers move together.

{% mermaid %}
graph LR
    A[Select Layer] --> B[Group Cubes]
    B --> C[Rotate Group]
    C --> D[Ungroup]
    D --> E[Update Positions]
{% /mermaid %}

### The Rotation Algorithm

![rotation diagram](/blog/post/how-did-i-build-the-rubiks-cube/rotation.png)

Here's how the rotation works:

```js
// Create pivot at cube center
const pivot = new Object3D();
const k = ((cubeNum - 1) / 2) * (1 + CUBE_MARGIN);
pivot.position.set(k, k, k);

function startMove(face, depth, magnitude) {
  // 1. Group cubes in the selected layer
  for (let x = 0; x < cubeNum; x++) {
    for (let y = 0; y < cubeNum; y++) {
      for (let z = 0; z < cubeNum; z++) {
        if (isInFace(x, y, z, face, depth)) {
          pivot.attach(cubes[x][y][z]);
        }
      }
    }
  }
  
  // 2. Calculate rotation target
  let target = { x: 0, y: 0, z: 0 };
  const angle = (Math.PI / 2) * magnitude;
  
  if (face === FACE_LEFT || face === FACE_RIGHT) {
    target.x = angle;
  } else if (face === FACE_TOP || face === FACE_BOTTOM) {
    target.y = angle;
  } else {
    target.z = angle;
  }
  
  // 3. Animate rotation
  animate({
    targets: pivot.rotation,
    ...target,
    duration: 600,
    easing: eases.linear,
    complete: cleanUpAfterMove
  });
}

function cleanUpAfterMove() {
  // 4. Ungroup and update positions
  const newCubes = Array.from(cubes);
  
  for (let i = pivot.children.length - 1; i >= 0; i--) {
    const cube = pivot.children[i];
    scene.attach(cube);
    
    // Get world position and snap to grid
    const pos = cube.getWorldPosition(new Vector3());
    const x = Math.round(pos.x / (1 + CUBE_MARGIN));
    const y = Math.round(pos.y / (1 + CUBE_MARGIN));
    const z = Math.round(pos.z / (1 + CUBE_MARGIN));
    
    // Update position and array reference
    cube.position.set(
      x * (1 + CUBE_MARGIN),
      y * (1 + CUBE_MARGIN),
      z * (1 + CUBE_MARGIN)
    );
    newCubes[x][y][z] = cube;
  }
  
  cubes = newCubes;
  pivot.rotation.set(0, 0, 0);
}
```

### See it in action

{% rubik size="large" cubes=3 rotating=true /%}

## Step 4: Adding Variations

Once the core mechanics work, you can experiment with different features:

### Different Cube Sizes

The same logic works for any NxNxN cube. Here's a 5x5x5 cube with playful easing animations:

{% rubik size="large" cubes=5 /%}

### Key Features Added

- **Auto-rotation**: Cubes rotate randomly when idle
- **Smooth animations**: Using anime.js for fluid movements
- **Dynamic easing**: Random easing functions for variety
- **Camera controls**: OrbitControls for user interaction

## Complete Implementation

{% accordion title="View full source code" %}

```js
import anime from "animejs";
import { BoxGeometry, Color, Float32BufferAttribute, Mesh, MeshBasicMaterial, 
         Object3D, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Constants
const FACE_RIGHT = 0, FACE_LEFT = 1, FACE_TOP = 2;
const FACE_BOTTOM = 3, FACE_FRONT = 4, FACE_BACK = 5;
const CUBE_MARGIN = 0.1;
const FACE_COLORS = [
  0x40a02b, // right - green
  0x89b4fa, // left - blue
  0xf9e2af, // top - yellow
  0xf8fafc, // bottom - white
  0xef4444, // front - red
  0xfe640b, // back - orange
];

let scene, camera, renderer, controls;
let cubes = [], pivot, cubeNum = 3;

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
        //addDebugArrow(cube);
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
  camera = new PerspectiveCamera(45, w / h, 1, 2000);
  scene = new Scene();
  camera.position.set(0, 0, 0);
  cameraTarget = new Vector3(0, 0, 0);
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
  startMove(
    Math.floor(Math.random() * 5),
    Math.floor(Math.random() * cubeNum),
    Math.floor(Math.random() * 5) - 2,
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
// function addDebugArrow(object) {
//   const dirZ = new Vector3(0, 0, 1);
//   const dirY = new Vector3(0, 1, 0);
//   const dirX = new Vector3(1, 0, 0);
//   const origin = Vector3.Zero; //object.position;
//   const length = 2;
//   const hex = 0x0077ff;
//   const zArrow = new ArrowHelper(dirZ, origin, length, hex);
//   object.add(zArrow);
//   const yArrow = new ArrowHelper(dirY, origin, length, hex);
//   object.add(yArrow);
//   const xArrow = new ArrowHelper(dirX, origin, length, hex);
//   object.add(xArrow);
// }

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
  startMove(
    Math.floor(Math.random() * 5),
    Math.floor(Math.random() * cubeNum),
    Math.floor(Math.random() * 5) - 2,
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

{% /accordion %}

## Learn more

[Here](https://github.com/hucancode/rubik) is a **Rust** implementation of this scene. It is a bit more complex than this one but the idea still remains.
See it live at here ([/rubik-rs](/rubik-rs))

{% video src="/blog/post/how-did-i-build-the-rubiks-cube/rubik-rust.webm" autoplay=true loop=true muted=true /%}
