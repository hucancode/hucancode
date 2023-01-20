import * as THREE from "three";
import anime from "animejs";
import { OrbitControls } from "$lib/three/controls/OrbitControls";
import { mergeBufferGeometries } from "$lib/three/BufferGeometryUtils";

var time = 0;
let clock = new THREE.Clock();
let scene, camera, renderer, controls;
let taiji;
let taijiParticle;
let bagua;
let dropAnimation;
const CANVAS_ID = "taiji";
const USE_CAMERA_CONTROL = true;
const TAIJI_ROTATION_CIRCLE = 5000;
const BAGUA_ROTATION_CIRCLE = 13000;
const TAIJI_VERTEX_SHADER = `
// uniform mat4 modelViewMatrix;
// uniform mat4 projectionMatrix;
// attribute vec3 position;
// attribute vec2 uv;
varying vec2 vUV;
void main() {
    vUV = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const TAIJI_FRAGMENT_SHADER = `
#define BIG_CIRCLE_RADIUS 0.45
#define SMALL_CIRCLE_RADIUS 0.1
#define STROKE_WIDTH 0.01

uniform float alpha;
varying vec2 vUV;
void main() {
    float v = 0.0;
    vec2 center = vec2(0.5);
    vec2 centerTop = vec2(0.5, 0.5+BIG_CIRCLE_RADIUS/2.0);
    vec2 centerBottom = vec2(0.5, 0.5-BIG_CIRCLE_RADIUS/2.0);
    float bigCircle = 1.0-smoothstep(BIG_CIRCLE_RADIUS,BIG_CIRCLE_RADIUS +0.01, length(vUV-center));
    float rightHalf = smoothstep(0.5,0.51, vUV.x);
    float halfCircle = bigCircle*rightHalf;
    v += halfCircle;
    float topCircle = 1.0-smoothstep(BIG_CIRCLE_RADIUS/2.0,BIG_CIRCLE_RADIUS/2.0 + 0.01, length(vUV-centerTop));
    v += topCircle;
    float bottomCircle = smoothstep(BIG_CIRCLE_RADIUS/2.0,BIG_CIRCLE_RADIUS/2.0 + 0.01, length(vUV-centerBottom));
    v *= bottomCircle;
    float bottomDot = 1.0 - smoothstep(SMALL_CIRCLE_RADIUS,SMALL_CIRCLE_RADIUS+0.01, length(vUV-centerBottom));
    v += bottomDot;
    float topDot = smoothstep(SMALL_CIRCLE_RADIUS,SMALL_CIRCLE_RADIUS+0.01, length(vUV-centerTop));
    v *= topDot;
    vec3 col = vec3(v);
    float a = bigCircle * alpha;
    gl_FragColor = vec4(col, a);
}
`;
function makeTaiji() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      alpha: { value: 1.0 },
    },
    vertexShader: TAIJI_VERTEX_SHADER,
    fragmentShader: TAIJI_FRAGMENT_SHADER,
  });
  material.clipping = true;
  material.transparent = true;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const ret = new THREE.Mesh(geometry, material);
  ret.scale.x = ret.scale.y = 7;
  ret.rotation.x = -Math.PI / 2;
  return ret;
}

function makeBagua() {
  const HEIGHT = 5;
  const MARGIN = 0.1;
  const STROKE_WIDTH = 0.1;
  const bar31 = new THREE.PlaneGeometry(3, 1);
  const bar11 = new THREE.PlaneGeometry(1, 1);
  const blackMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const root = new THREE.Object3D();
  for (let i = 0; i < 8; i++) {
    const figure = new THREE.Object3D();
    for (let bit = 0; bit < 3; bit++) {
      const v = (i >> bit) & 1;
      if (v == 1) {
        const base = new THREE.Mesh(bar31, blackMaterial);
        const mesh = new THREE.Mesh(bar31, whiteMaterial);
        mesh.position.y = bit * (1 + MARGIN) + HEIGHT;
        mesh.add(base);
        base.position.z = -0.01;
        base.scale.x = (3 + STROKE_WIDTH * 2) / 3;
        base.scale.y = (1 + STROKE_WIDTH * 2) / 1;
        figure.add(mesh);
      } else {
        const baseA = new THREE.Mesh(bar11, blackMaterial);
        const baseB = new THREE.Mesh(bar11, blackMaterial);
        baseB.position.z = baseA.position.z = -0.01;
        baseB.scale.x =
          baseB.scale.y =
          baseA.scale.x =
          baseA.scale.y =
            (1 + STROKE_WIDTH * 2) / 1;
        const meshA = new THREE.Mesh(bar11, whiteMaterial);
        const meshB = new THREE.Mesh(bar11, whiteMaterial);
        meshA.add(baseA);
        meshB.add(baseB);
        meshB.position.y = meshA.position.y = bit * (1 + MARGIN) + HEIGHT;
        meshA.position.x = -1;
        meshB.position.x = 1;
        figure.add(meshA);
        figure.add(meshB);
      }
    }
    figure.rotation.z = (i * Math.PI * 2) / 8;
    root.add(figure);
  }
  root.rotation.x = -Math.PI / 2;
  return root;
}

function setupObject() {
  // const axesHelper = new THREE.AxesHelper(5);
  // scene.add(axesHelper);
  taiji = makeTaiji();
  anime({
    targets: taiji.rotation,
    z: Math.PI * 2,
    duration: TAIJI_ROTATION_CIRCLE,
    easing: "linear",
    direction: "reverse",
    loop: true,
  });
  scene.add(taiji);
  taijiParticle = makeTaiji();
  taijiParticle.opacity = 1;
  for (let child of taijiParticle.children) {
    child.material.transparent = true;
  }
  taijiParticle.position.y = 10;
  dropAnimation = anime.timeline({
    duration: 1000,
    easing: "easeOutExpo",
  });
  dropAnimation
    .add({
      targets: taijiParticle.rotation,
      z: Math.PI * 4,
    })
    .add(
      {
        targets: taijiParticle.position,
        y: 0.2,
      },
      0
    )
    .add(
      {
        targets: taijiParticle.scale,
        easing: "easeInOutQuad",
        x: 20,
        y: 20,
      },
      0
    )
    .add(
      {
        targets: taijiParticle.material.uniforms.alpha,
        easing: "easeInOutQuad",
        value: 0,
        update: (anim) => {
          taijiParticle.material.uniformsNeedUpdate = true;
        },
      },
      200
    );
  scene.add(taijiParticle);
  bagua = makeBagua();
  scene.add(bagua);
  anime({
    targets: bagua.rotation,
    z: -Math.PI * 2,
    duration: BAGUA_ROTATION_CIRCLE,
    easing: "linear",
    direction: "reverse",
    loop: true,
  });
}
function setupLight() {
  const light = new THREE.AmbientLight(0x666666); // soft white light
  scene.add(light);
  const hemiLight = new THREE.HemisphereLight(0x999999, 0x000000, 1);
  hemiLight.position.set(0, 0, 10);
  scene.add(hemiLight);

  const backLight = new THREE.PointLight(0x5599ff, 1);
  // backLight.add( new THREE.Mesh( new THREE.SphereGeometry( 1, 1, 8 ), new THREE.MeshBasicMaterial( { color: 0xff0040 } ) ) );
  backLight.position.set(0, 0, 10);
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

function setupCamera(w, h) {
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
  scene = new THREE.Scene();
  camera.position.set(0, 16, 16);
  rebuildOrbitControl();
}

function rebuildOrbitControl() {
  if (USE_CAMERA_CONTROL) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    //controls.enablePan = false;
    controls.minDistance = 4; // the minimum distance the camera must have from center
    controls.maxDistance = 30; // the maximum distance the camera must have from center
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
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    rebuildOrbitControl();
    return;
  }
  setupCamera(w, h);
  setupLight();
  setupObject();
  window.addEventListener("resize", onWindowResize);
}

function destroy() {
  renderer.dispose();
}

function onWindowResize() {
  let canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    return;
  }
  canvas.style = "";
  let w = canvas.clientWidth;
  let h = canvas.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function render() {
  time += clock.getDelta();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  if (controls) {
    controls.update();
  }
}
function playAnimation() {
  dropAnimation.play();
}

export { CANVAS_ID, init, destroy, render, playAnimation };
