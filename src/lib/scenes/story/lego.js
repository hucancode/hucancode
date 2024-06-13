import * as THREE from "three";
import anime from "animejs";
import { mergeBufferGeometries } from "$lib/three/BufferGeometryUtils";

let pieces = [];
let materials = [];
let animation = null;
const POOL_SIZE = 20;
const GRADIENT_STEP = 3;
// objects
const cube = new THREE.Object3D();
const ring = new THREE.Object3D();
const ringParticles = [];
const cubePieces = [];
// lights
const light = new THREE.AmbientLight(0x666666); // soft white light
const hemiLight = new THREE.HemisphereLight(0x999999, 0x000000, 1);
const backLight = new THREE.PointLight(0x5599ff, 1);

function makeLegoRing() {
  const PIECE_COUNT = 30;
  const ELEVATION = 5;
  for (let i = 0; i < PIECE_COUNT; i++) {
    const node = new THREE.Mesh(
      getRandomPieceFromPool(),
      getRandomMaterialFromPool()
    );
    const rotation = Math.random() * Math.PI * 2;
    const elevation = (Math.random() - 0.5) * ELEVATION;
    ring.add(node);
    const particle = {
      node,
      elevation,
      rotation,
    };
    ringParticles.push(particle);
  }
  ring.scale.set(5, 5, 5);
}

function makeCenterPiece() {
  const material = getRandomMaterialFromPool();
  const OFFSET = 5;
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
  cubePieces.push(nodeA, nodeB, nodeC, nodeD, nodeE, nodeF);
  cubePieces.forEach((e) => (e.offsetScale = 1));
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
async function init() {
  buildPiecePool();
  makeLegoRing();
  makeCenterPiece();
}

function playAnimation() {
  animation.restart();
}

function scroll(r, scene, camera) {
  // rotate camera around camera target for an amount based on t
  if (camera) {
    let distance = 100 - 25 * t;
    if (camera.distance === undefined) {
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
        if (t >= 0.9) {
          controls.enableRotate = true;
          controls.autoRotate = true;
        }
      },
    });
  }
}

function enter(scene) {
  // animate objects into the scene
  anime.remove(cube.scale);
  anime.remove(ring.scale);
  scene.add(ring);
  scene.add(cube);
  cube.scale.set(0, 0, 0);
  anime({
    targets: cube.scale,
    y: 1,
    x: 1,
    z: 1,
    duration: 1500,
    complete: () => {
      animation = anime({
        targets: cubePieces,
        offsetScale: 3,
        duration: 500,
        delay: anime.stagger(60),
        direction: "alternate",
        autoplay: false,
        easing: "easeInOutElastic",
        update: () => {
          cubePieces.forEach((e) => {
            e.position.setLength(e.offsetScale * OFFSET);
          });
        },
      });
    },
  });
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
  anime({
    targets: ring.scale,
    x: 1,
    y: 1,
    z: 1,
    duration: 1000,
    easing: "easeInOutQuad",
  });
  const RADIUS = 25;
  for (let particle of ringParticles) {
    const duration = Math.random() * 4000 + 20000;
    anime({
      targets: particle,
      rotation: particle.rotation + Math.PI * 2,
      duration,
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
  // animate light into the scene
  anime.remove(hemiLight.position);
  anime.remove(backLight.position);
  anime.remove(light.position);
  scene.add(backLight);
  scene.add(hemiLight);
  scene.add(light);
  anime({
    targets: hemiLight.position,
    y: 30,
    duration: 500,
  });
  anime({
    targets: backLight.position,
    y: 20,
    delay: 100,
    duration: 600,
  });
  anime({
    targets: light.position,
    y: 0,
    delay: 300,
    duration: 800,
  });
}

function update(scene) {}

function leave(scene) {
  // animate objects out of the scene
  anime.remove(cube.scale);
  anime.remove(ring.scale);
  anime({
    targets: cube.scale,
    y: 0,
    x: 0,
    z: 0,
    duration: 700,
    easing: "easeInOutSine",
    complete: () => {
      anime.remove(cube.rotation);
      cube.removeFromParent();
    },
  });
  anime({
    targets: ring.scale,
    x: 5,
    y: 5,
    z: 5,
    delay: 300,
    duration: 1000,
    easing: "easeInOutQuad",
    complete: () => {
      ring.removeFromParent();
    },
  });
  // animate light out of the scene
  anime.remove(hemiLight.position);
  anime.remove(backLight.position);
  anime.remove(light.position);
  anime({
    targets: hemiLight.position,
    y: 200,
    duration: 500,
    complete: () => {
      hemiLight.removeFromParent();
    },
  });
  anime({
    targets: backLight.position,
    y: -200,
    delay: 300,
    duration: 500,
    complete: () => {
      backLight.removeFromParent();
    },
  });
  anime({
    targets: light.position,
    y: 100,
    delay: 400,
    duration: 600,
    complete: () => {
      light.removeFromParent();
    },
  });
}

export { init, scroll, enter, leave, update, playAnimation };
