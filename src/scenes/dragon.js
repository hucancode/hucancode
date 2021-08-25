import * as THREE from 'three';
import { Flow } from '../three/modifiers/CurveModifier.js';
import { OBJLoader } from '../three/loaders/OBJLoader.js';
import { GLTFLoader } from '../three/loaders/GLTFLoader.js';

const curveHandles = [];
let scene, camera, renderer, dragon;
const ASPECT_RATIO = 0.75;
const DRAW_PATH = false;
const USE_OBJ = false;

export function init() {
    let canvas = document.getElementById('dragon');
    let w = canvas.clientWidth;
    let h = w * ASPECT_RATIO;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
    scene = new THREE.Scene();
    camera.position.set(0, 200, 200);
    camera.lookAt(scene.position);
    const MIN_X = -50;
    const VAR_X = 100;
    const MIN_Y = -50;
    const VAR_Y = 100;
    const MIN_Z = -150;
    const VAR_Z = 300;
    const initialPoints = [
        { x: 50, y: 30, z: -150 },
        { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
        { x: 50, y: 0, z: 150 },
        { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
        { x: -50, y: 50, z: 150 },
        { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
        { x: -50, y: 20, z: -150 },
        { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
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
    if(DRAW_PATH)
    {
        const points = curve.getPoints(50);
        const line = new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: 0x00ff00 })
        );
        scene.add(line);
    }

    //

    const light = new THREE.DirectionalLight(0xffaa33);
    light.position.set(- 10, 10, 10);
    light.intensity = 1.0;
    scene.add(light);

    const light2 = new THREE.AmbientLight(0x003973);
    light2.intensity = 1.0;
    scene.add(light2);

    //
    if(USE_OBJ)
    {    
        const loader = new OBJLoader();
        loader.load('assets/obj/dragon.obj', function (obj) {
            obj.traverse(function (child) {
                //if (child.isMesh) child.material.map = texture;
            });
            console.log('loaded dragon.obj');
            dragon = new Flow(obj);
            dragon.updateCurve(0, curve);
            scene.add(dragon.object3D);
        });
    }
    else
    {
        const loader = new GLTFLoader();
        loader.load( 'assets/gltf/dragon.gltf', function ( gltf ) {
            dragon = new Flow(gltf.scene);
            dragon.updateCurve(0, curve);
            scene.add(dragon.object3D);
        });
    }
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    let canvas = document.getElementById('dragon');
    if(!canvas)
    {
        return;
    }
    canvas.style = "";
    let w = canvas.clientWidth;
    let h = w * ASPECT_RATIO;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

export function animate() {
    requestAnimationFrame(animate);
    if (dragon) {
        dragon.moveAlongCurve(0.002);
    }
    renderer.render(scene, camera);
}