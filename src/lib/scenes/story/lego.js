import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  Mesh,
  MeshToonMaterial,
  Object3D,
  PointLight,
  RedFormat,
} from "three";
import { stagger, animate, utils, eases } from "animejs";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

let pieces = [];
let materials = [];
const POOL_SIZE = 20;
const GRADIENT_STEP = 5;
// objects
const cube = new Object3D();
const ring = new Object3D();
let ringParticles = [];
let cubePieces = [];
const LIGHT_INTENSITY = 10;
const pointLight = new PointLight(0xffffff, LIGHT_INTENSITY, 800, 0.25);

function makeLegoRing() {
  const PIECE_COUNT = 30;
  const ELEVATION = 5;
  ringParticles = [];
  ring.children = [];

  for (let i = 0; i < PIECE_COUNT; i++) {
    const node = new Mesh(
      getRandomPieceFromPool(),
      getRandomMaterialFromPool(),
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
  const RADIUS = 25;
  for (let particle of ringParticles) {
    const duration = Math.random() * 4000 + 20000;
    animate(particle, {
      rotation: particle.rotation + Math.PI * 2,
      duration,
      ease: eases.linear(),
      reversed: true,
      loop: true,
      onUpdate: (_) => {
        const x = Math.sin(particle.rotation) * RADIUS;
        const z = Math.cos(particle.rotation) * RADIUS;
        const y = particle.elevation;
        particle.node.position.set(x, y, z);
        particle.node.lookAt(0, 0, 0);
      },
    });
  }
}

function makeCenterPiece() {
  cube.children = [];
  const material = getRandomMaterialFromPool();
  const OFFSET = 5;
  const geometry = makeLegoPiece(2, 2, 1);
  const nodeA = new Mesh(geometry, material);
  nodeA.position.set(0, OFFSET, 0);
  nodeA.scale.set(8, 8, 8);
  const nodeB = new Mesh(geometry, material);
  nodeB.position.set(0, -OFFSET, 0);
  nodeB.scale.set(8, 8, 8);
  nodeB.rotation.set(Math.PI, 0, 0);
  cube.add(nodeA);
  cube.add(nodeB);

  const nodeC = new Mesh(geometry, material);
  nodeC.position.set(0, 0, -OFFSET);
  nodeC.scale.set(8, 8, 8);
  nodeC.rotation.set(-Math.PI / 2, 0, 0);
  const nodeD = new Mesh(geometry, material);
  nodeD.position.set(0, 0, OFFSET);
  nodeD.scale.set(8, 8, 8);
  nodeD.rotation.set(Math.PI / 2, 0, 0);
  cube.add(nodeC);
  cube.add(nodeD);

  const nodeE = new Mesh(geometry, material);
  nodeE.position.set(OFFSET, 0, 0);
  nodeE.scale.set(8, 8, 8);
  nodeE.rotation.set(0, 0, -Math.PI / 2);
  const nodeF = new Mesh(geometry, material);
  nodeF.position.set(-OFFSET, 0, 0);
  nodeF.scale.set(8, 8, 8);
  nodeF.rotation.set(0, 0, Math.PI / 2);
  cube.add(nodeE);
  cube.add(nodeF);
  cubePieces.push(nodeA, nodeB, nodeC, nodeD, nodeE, nodeF);
  cubePieces.forEach(e => {
    e.number = 1.0;
  });
}

function buildPiecePool() {
  pieces = [];
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
  const gradientMap = new DataTexture(
    gradients,
    gradients.length,
    1,
    RedFormat,
  );
  gradientMap.needsUpdate = true;

  materials = colors
    .map((v) => new Color(v))
    .map((color) => new MeshToonMaterial({ color, gradientMap, fog: true }));
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
  const ab = new BoxGeometry(width, depth, thickness);
  ab.translate(0, 0, -hh);
  const bc = new BoxGeometry(thickness, depth, height);
  bc.translate(hw, 0, 0);
  const cd = new BoxGeometry(width, depth, thickness);
  cd.translate(0, 0, hh);
  const da = new BoxGeometry(thickness, depth, height);
  da.translate(-hw, 0, 0);
  const plank = new BoxGeometry(width, thickness, height);
  plank.translate(0, depth / 2, 0);
  const pieces = [ab, bc, cd, da, plank];
  const BUTTON_RADIUS = 0.4;
  const BUTTON_HEIGHT = 0.3;
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const button = new CylinderGeometry(
        BUTTON_RADIUS,
        BUTTON_RADIUS,
        BUTTON_HEIGHT,
        24,
      );
      button.translate(
        i - (width - 1) / 2,
        BUTTON_HEIGHT * 2,
        j - (height - 1) / 2,
      );
      pieces.push(button);
    }
  }
  const geometry = mergeGeometries(pieces);
  return geometry;
}
function init() {
  buildPiecePool();
  makeLegoRing();
  makeCenterPiece();
  pointLight.position.set(0, 20, 0);
  // pointLight.add(new Mesh(new SphereGeometry(1, 16, 8), new MeshBasicMaterial({ color: 0xffffff })));
}

function scroll(r, scene, camera) {
  // rotate camera around camera target for an amount based on t
  if (camera) {
    let distance = 100 - 25 * t;
    if (camera.distance === undefined) {
      camera.distance = camera.position.length();
    }
    animate(camera, {
      distance: distance,
      duration: 1000,
      onUpdate: () => {
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
  utils.remove(cube.scale);
  utils.remove(ring.scale);
  scene.add(ring);
  scene.add(cube);
  cube.scale.set(0, 0, 0);
  const OFFSET = 5.0;
  animate(cube.scale, {
    y: 1,
    x: 1,
    z: 1,
    delay: 1000,
    duration: 1500,
    onComplete: () => {
      animate(cubePieces, {
        number: 3.0,
        duration: 500,
        delay: stagger(60),
        loop: 1,
        alternate: true,
        ease: eases.inOutElastic(),
        onUpdate: (anim) => {
          cubePieces.forEach(e => {
            e.position.setLength(e.number * OFFSET);
          });
        },
      });
    },
  });
  animate(cube.rotation, {
    x: Math.PI * 2,
    duration: 23000,
    ease: eases.outInQuart,
    direction: "reverse",
    loop: true,
  });
  animate(cube.rotation, {
    y: Math.PI * 2,
    duration: 31000,
    ease: eases.outInQuart,
    direction: "reverse",
    loop: true,
  });
  animate(cube.rotation, {
    z: Math.PI * 2,
    duration: 43000,
    ease: eases.outInQuart,
    direction: "reverse",
    loop: true,
  });
  animate(ring.scale, {
    x: 1,
    y: 1,
    z: 1,
    duration: 1000,
    ease: eases.inOutQuad,
  });
  utils.remove(pointLight);
  animate(pointLight, {
    intensity: LIGHT_INTENSITY,
    duration: 4000,
    onBegin: () => {
      scene.add(pointLight);
    },
  });
}

function update(scene) {}

function leave(scene) {
  // animate objects out of the scene
  utils.remove(cube.scale);
  utils.remove(ring.scale);
  animate(cube.scale, {
    y: 0,
    x: 0,
    z: 0,
    duration: 700,
    ease: eases.outExpo,
    onComplete: () => {
      utils.remove(cube.rotation);
      cube.removeFromParent();
    },
  });
  animate(ring.scale, {
    x: 10,
    y: 10,
    z: 10,
    delay: 300,
    duration: 1000,
    ease: eases.inOutQuad,
    onComplete: () => {
      ring.removeFromParent();
    },
  });
  utils.remove(pointLight);
  animate(pointLight, {
    intensity: 0,
    duration: 4000,
    onComplete: () => {
      scene.remove(pointLight);
    },
  });
}

function destroy() {
  pieces.forEach((e) => e.dispose());
  cubePieces.forEach((e) => e.geometry.dispose());
  materials.forEach((e) => e.dispose());
  cube.children = [];
  ring.children = [];
  cube.removeFromParent();
  ring.removeFromParent();
  ringParticles.forEach((e) => e.node.geometry.dispose());
  pieces = [];
  materials = [];
  cubePieces = [];
  ringParticles = [];
}

export { init, scroll, enter, leave, update, destroy };
