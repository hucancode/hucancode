import * as THREE from "three";
import { FBXLoader } from "../three/loaders/FBXLoader";
import { OrbitControls } from "../three/controls/OrbitControls";

let camera, scene, renderer, animator;
const clock = new THREE.Clock();
const USE_CAMERA_CONTROL = false

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

}
export function init() {
    let canvas = document.getElementById('renderer');
    let w = window.innerWidth * 0.8;
    let h = window.innerHeight * 0.8;

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(400, 220, 400);
    camera.lookAt(0, 100, 0);

    scene = new THREE.Scene();
    scene.background = null;//new THREE.Color(0x282c34);
    //scene.fog = new THREE.Fog(0xa0a0a0, 100, 2000);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = - 100;
    dirLight.shadow.camera.left = - 120;
    dirLight.shadow.camera.right = 120;
    scene.add(dirLight);

    // scene.add( new THREE.CameraHelper( dirLight.shadow.camera ) );

    // ground
    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(200, 50, 0, Math.PI * 2),
        new THREE.MeshPhongMaterial({ color: 0x282c34, depthWrite: false }));
    ground.rotation.x = - Math.PI / 2;
    ground.receiveShadow = true;
    ground.material.opacity = 0.2;
    ground.material.transparent = true;
    scene.add(ground);

    // model
    const loader = new FBXLoader();
    loader.setPath('assets/fbx/');
    loader.setResourcePath('assets/textures/');
    loader.load('SarborV2.fbx', function (object) {
        animator = new THREE.AnimationMixer(object);
        const action = animator.clipAction(object.animations.find(e => e.name === 'idle'));
        action.play();
        object.traverse(child => {
            if (!child.isMesh) {
                return;
            }
            child.castShadow = true;
            child.receiveShadow = false;
            child.material.vertexColors = false;
            child.material.shininess = child.material.name === 'body' ? 1.0 : 10.0;
        });
        scene.add(object);
    });

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0); // the default
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    if (USE_CAMERA_CONTROL) {
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 100, 0);
        controls.update();
    }
    window.addEventListener('resize', onWindowResize);
}

export function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (animator) {
        animator.update(delta);
    }
    renderer.render(scene, camera);
}