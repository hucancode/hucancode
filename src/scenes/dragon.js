import * as THREE from 'three';
import { Flow } from '../three/modifiers/CurveModifier.js';
import { OBJLoader } from '../three/loaders/OBJLoader.js';

const curveHandles = [];
let scene, camera, renderer, dragonBody, dragonHead, dragonLegs;
const ASPECT_RATIO = 0.95;

export function init() {
    let canvas = document.getElementById('renderer');
    let w = canvas.clientWidth;
    let h = w * ASPECT_RATIO;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
    scene = new THREE.Scene();
    camera.position.set(200, 200, 400);
    camera.lookAt(scene.position);
    const initialPoints = [
        { x: 100, y: 0, z: - 100 },
        { x: 100, y: 0, z: 100 },
        { x: - 100, y: 0, z: 100 },
        { x: - 100, y: 0, z: - 100 },
    ];
    const boxGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const boxMaterial = new THREE.MeshBasicMaterial();
    for (const handlePos of initialPoints) {
        const handle = new THREE.Mesh(boxGeometry, boxMaterial);
        handle.position.copy(handlePos);
        curveHandles.push(handle);
        scene.add(handle);
    }

    const curve = new THREE.CatmullRomCurve3(
        curveHandles.map((handle) => handle.position)
   );
    curve.curveType = 'centripetal';
    curve.closed = true;
    const points = curve.getPoints(50);
    const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0x00ff00 })
   );

    scene.add(line);

    //

    const light = new THREE.DirectionalLight(0xffaa33);
    light.position.set(- 10, 10, 10);
    light.intensity = 1.0;
    scene.add(light);

    const light2 = new THREE.AmbientLight(0x003973);
    light2.intensity = 1.0;
    scene.add(light2);

    //
    
    const loader = new OBJLoader();
    loader.load('assets/obj/dragon_body.obj', function (obj) {
        obj.traverse(function (child) {
            //if (child.isMesh) child.material.map = texture;
        });
        obj.rotation.y = Math.PI*0.5;
        dragonBody = new Flow(obj);
        dragonBody.updateCurve(0, curve);
        scene.add(dragonBody.object3D);
        scene.add(obj);
    });

    loader.load('assets/obj/dragon_head.obj', function (obj) {
        obj.traverse(function (child) {
            //if (child.isMesh) child.material.map = texture;
        });
        obj.rotation.y = Math.PI*0.5;
        dragonHead = new Flow(obj);
        dragonHead.updateCurve(0, curve);
        scene.add(dragonHead.object3D);
        scene.add(obj);
    });


    // loader.load('assets/obj/dragon_legs.obj', function (obj) {
    //     obj.traverse(function (child) {
    //         //if (child.isMesh) child.material.map = texture;
    //     });
    //     obj.rotation.y = Math.PI*0.5;
    //     dragonLegs = new Flow(obj);
    //     dragonLegs.updateCurve(0, curve);
    //     scene.add(dragonLegs.object3D);
    //     scene.add(obj);
    // });

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    let canvas = document.getElementById('renderer');
    canvas.style = "";
    let w = canvas.clientWidth;
    let h = w * ASPECT_RATIO;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

export function animate() {
    requestAnimationFrame(animate);
    if (dragonBody) {
        dragonBody.moveAlongCurve(0.001);
    }
    if (dragonHead) {
        dragonHead.moveAlongCurve(0.001);
    }
    if (dragonLegs) {
        dragonLegs.moveAlongCurve(0.001);
    }
    renderer.render(scene, camera);
}