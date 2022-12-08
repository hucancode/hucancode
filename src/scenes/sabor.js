"use client";
import Canvas3D from "./canvas3D";
import * as THREE from "three";
import { FBXLoader } from "../three/loaders/FBXLoader";
import { GLTFLoader } from "../three/loaders/GLTFLoader.js";
import { OrbitControls } from "../three/controls/OrbitControls";

var camera, scene, renderer, animator;
var sabor;
const clock = new THREE.Clock();
const CANVAS_ID = "sabor";
const USE_CAMERA_CONTROL = true;
const ASPECT_RATIO = 0.75;
const USE_FBX = false;

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

function init() {
  let canvas = document.getElementById(CANVAS_ID);
  let w = canvas.clientWidth;
  let h = canvas.clientHeight; //w * ASPECT_RATIO;
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
  camera.position.set(330, 200, 330);
  camera.lookAt(0, 80, 0);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = true;
  if (USE_CAMERA_CONTROL) {
    const isTouchDevice =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0;
    if (!isTouchDevice) {
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 80, 0);
      controls.enableRotateY = false;
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.update();
    }
  }
  window.addEventListener("resize", onWindowResize);
  buildScene();
}

async function buildScene() {
  if (scene != null) {
    return;
  }
  scene = new THREE.Scene();
  scene.background = null; //new THREE.Color(0x282c34);
  //scene.fog = new THREE.Fog(0xa0a0a0, 100, 2000);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  hemiLight.position.set(0, 200, 0);
  hemiLight.intensity = 2;
  scene.add(hemiLight);

  const backLight = new THREE.PointLight(0xffffff, 1, 600);
  //backLight.add( new THREE.Mesh( new THREE.SphereGeometry( 15, 16, 8 ), new THREE.MeshBasicMaterial( { color: 0xff0040 } ) ) );
  backLight.position.set(0, 250, -70);
  scene.add(backLight);

  const dirLight = new THREE.DirectionalLight(0xffffff);
  dirLight.intensity = 1;
  dirLight.position.set(0, 220, 150);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 180;
  dirLight.shadow.camera.bottom = -100;
  dirLight.shadow.camera.left = -120;
  dirLight.shadow.camera.right = 120;
  //scene.add(dirLight);

  //scene.add( new THREE.CameraHelper( dirLight.shadow.camera ) );

  // ground
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(200, 50, 0, Math.PI * 2),
    new THREE.MeshPhongMaterial({ color: 0x11111f, depthWrite: false })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.material.opacity = 0.4;
  ground.material.transparent = true;
  scene.add(ground);

  if (USE_FBX) {
    const loader = new FBXLoader();
    loader.setPath("/assets/fbx/");
    loader.setResourcePath("/assets/textures/");
    loader.load("SarborV2.fbx", function (object) {
      animator = new THREE.AnimationMixer(object);
      object.traverse((child) => {
        if (!child.isMesh) {
          return;
        }
        child.castShadow = true;
        child.receiveShadow = false;
        child.material.vertexColors = false;
        child.material.shininess = child.material.name === "body" ? 1.0 : 10.0;
      });
      object.position.z = 40;
      scene.add(object);
      sabor = object;
      window.setTimeout(playIntro, 0);
    });
  } else {
    const loader = new GLTFLoader();
    loader.setPath("/assets/gltf/");
    loader.load("sabor.glb", function (gltf) {
      animator = new THREE.AnimationMixer(gltf.scene);
      gltf.scene.traverse((child) => {
        if (!child.isMesh) {
          return;
        }
        child.material.doubleSided = false;
        child.castShadow = true;
        child.receiveShadow = false;
      });
      gltf.scene.scale.setScalar(100);
      gltf.scene.position.z = 40;
      scene.add(gltf.scene);
      sabor = gltf;
      window.setTimeout(playIntro, 0);
    });
  }
}

function animate() {
  const delta = clock.getDelta();
  if (animator) {
    animator.update(delta);
  }
  if (scene) {
    renderer.render(scene, camera);
  }
}

function playIntro() {
  const animation = fadeToAction("intro", 0.0);
  animation.clampWhenFinished = true;
  animation.setLoop(THREE.LoopOnce);
  animator.addEventListener("finished", returnToIdle);
}

function returnToIdle() {
  animator.removeEventListener("finished", returnToIdle);
  fadeToAction("idle", 0.25);
}

function fadeToAction(name, duration) {
  const animation = animator.clipAction(
    sabor.animations.find((e) => e.name === name)
  );
  return animation.reset().fadeIn(duration).play();
}

export default class SaborScene extends Canvas3D {
  constructor(props) {
    super(props);
    this.canvasID = CANVAS_ID;
    this.init = init;
    this.animate = animate;
  }
}
