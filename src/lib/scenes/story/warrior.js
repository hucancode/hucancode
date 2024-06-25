import * as THREE from "three";
import anime from "animejs";
import { loadModel } from "$lib/utils.js";

let warrior, animator;
let hemiLight, backLight;
let isWaitingForResource = false;
let waitingScene = null;
const clock = new THREE.Clock();
let warriorParams = {
  y: -50,
  scale: 1,
}

async function buildScene() {
  hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  // hemiLight.add( new THREE.Mesh( new THREE.SphereGeometry( 1, 16, 8 ), new THREE.MeshBasicMaterial( { color: 0x0400ff } ) ) );
  hemiLight.position.set(0, 30, 0);
  hemiLight.intensity = 0;
  backLight = new THREE.PointLight(0xffffff, 1, 600);
  // backLight.add( new THREE.Mesh( new THREE.SphereGeometry( 1, 16, 8 ), new THREE.MeshBasicMaterial( { color: 0xff0040 } ) ) );
  backLight.position.set(0, 18, -10);
  backLight.intensity = 0;
  warrior = await loadModel("warrior.glb");
  animator = new THREE.AnimationMixer(warrior.scene);
  warrior.scene.scale.set(10, 10, 10);
  if(isWaitingForResource) {
    animateWarriorIn(waitingScene);
  }
}

function playIntro() {
  if(!animator) {
    return;
  }
  animator.stopAllAction();
  animator.removeEventListener("finished", returnToIdle);
  const animation = fadeToAction("intro", 0.0);
  animation.clampWhenFinished = true;
  animation.setLoop(THREE.LoopOnce);
  animator.addEventListener("finished", returnToIdle);
}

async function playAction(callback) {
  if(!animator) {
    return;
  }
  animator.stopAllAction();
  if(!callback) {
    callback = returnToIdle;
  }
  animator.removeEventListener("finished", callback);
  const ACTIONS = ["jump", "jump_lick"];
  const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  const animation = fadeToAction(action, 0.0);
  animation.clampWhenFinished = true;
  animation.setLoop(THREE.LoopOnce);
  animator.addEventListener("finished", callback);
}

function init() {
  buildScene();
}

function animateWarriorIn(scene) {
  if(!warrior || !warrior.scene) {
    isWaitingForResource = true;
    waitingScene = scene;
    return;
  }
  isWaitingForResource = false;
  warriorParams.y = -50;
  anime({
    targets: warriorParams,
    y: 0,
    scale: 2,
    duration: 750,
    easing: "easeInElastic",
    begin: () => {
      scene.add(warrior.scene);
    },
    update: () => {
      warrior.scene.position.set(0, warriorParams.y, 0);
      warrior.scene.scale.set(warriorParams.scale, 10, warriorParams.scale);
    },
    complete: () => {
      anime({
        targets: warriorParams,
        scale: 10,
        duration: 1000,
        update: () => {
          warrior.scene.scale.set(warriorParams.scale, 10, warriorParams.scale);
        },
      })
      playIntro();
    }
  });
}

function animateLightIn(scene) {
  if(!hemiLight || !backLight) {
    return;
  }
  anime({
    targets: hemiLight,
    intensity: 1.2,
    delay: 300,
    duration: 1000,
    begin: () => {
      scene.add(hemiLight);
    }
  });
  anime({
    targets: backLight,
    intensity: 5,
    delay: 800,
    duration: 1000,
    begin: () => {
      scene.add(backLight);
    }
  });
}

function animateWarriorOut(scene) {
  if(!warrior || !warrior.scene) {
    return;
  }
  playAction();
  anime({
    targets: warriorParams,
    y: 50,
    scale: 0,
    duration: 1000,
    easing: "easeInElastic",
    update: () => {
      update();
      warrior.scene.position.set(0, warriorParams.y, 0);
      warrior.scene.scale.set(warriorParams.scale, 10, warriorParams.scale);
    },
    complete: () => {
      scene.remove(warrior.scene);
    }
  });
}

function animateLightOut(scene) {
  if(!hemiLight || !backLight) {
    return;
  }
  anime({
    targets: hemiLight,
    intensity: 0,
    duration: 1000,
    complete: () => {
      scene.remove(hemiLight);
    },
  });
  anime({
    targets: backLight,
    intensity: 0,
    duration: 1000,
    complete: () => {
      scene.remove(backLight);
    },
  });
}

function enter(scene, camera) {
  animateWarriorIn(scene);
  animateLightIn(scene);
}

function leave(scene) {
  animateLightOut(scene);
  animateWarriorOut(scene);
}

function update() {
  const delta = clock.getDelta();
  if (animator) {
    animator.update(delta);
  }
}

async function returnToIdle() {
  if(!animator) {
    return;
  }
  animator.removeEventListener("finished", returnToIdle);
  fadeToAction("idle", 0.25);
}

function fadeToAction(name, duration) {
  if(!animator) {
    return;
  }
  const animation = animator.clipAction(
    warrior.animations.find((e) => e.name === name)
  );
  if(!animation) {
    return;
  }
  return animation.reset()
    .fadeIn(duration)
    .play();
}

export { init, enter, update, leave };