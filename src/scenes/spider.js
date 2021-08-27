import * as THREE from 'three';
// import { GLTFLoader } from '../three/loaders/GLTFLoader.js';
import Canvas3D from './canvas3D'

let scene, camera, renderer;
let clock = new THREE.Clock();
let body, leg;
var time = 0;
const CANVAS_ID = 'spider';
const ASPECT_RATIO = 0.75;

function init() {
    let canvas = document.getElementById(CANVAS_ID);
    let w = canvas.clientWidth;
    let h = w * ASPECT_RATIO;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
    scene = new THREE.Scene();
    camera.position.set(0, 20, 200);
    camera.lookAt(scene.position);
    window.addEventListener('resize', onWindowResize);
    const bigSphere = new THREE.SphereGeometry( 5, 16, 8 );
    const smallSphere = new THREE.SphereGeometry( 1, 16, 8 );
    const unlitWhite = new THREE.MeshBasicMaterial( { color: 0xffffff } );
    const unlitAzure = new THREE.MeshBasicMaterial( { color: 0x0077ff } );
    body = new THREE.Mesh(bigSphere, unlitWhite);
    body.position.set(0, 0, 0);
    leg = new THREE.Mesh(smallSphere, unlitAzure);
    leg.position.set(0, 0, 0);
    scene.add(body);
    scene.add(leg);
}

function onWindowResize() {
    let canvas = document.getElementById(CANVAS_ID);
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

let isLegMoving = false;
let legMovementTime = 0.0;
let legMovementDuration = 0.5;
let legMovementDistance = 6.0;
let sourceLegPosition = new THREE.Vector3();
let targetLegPosition = new THREE.Vector3();

function animate() {
    const delta = clock.getDelta();
    time += delta;
    body.position.setX(Math.sin(time)*100);
    if(isLegMoving)
    {
        legMovementTime = legMovementTime + delta;
        if(legMovementTime >= legMovementDuration)
        {
            isLegMoving = false;
        }
        leg.position.lerpVectors(sourceLegPosition, targetLegPosition, legMovementTime/legMovementDuration);
    }
    else
    {
        targetLegPosition.set(body.position.x + 5, body.position.y, body.position.z);
        const distance = leg.position.distanceTo(targetLegPosition);
        if(distance > legMovementDistance)
        {
            legMovementTime = 0.0;
            sourceLegPosition = leg.position;
            isLegMoving = true;
        }
    }
    renderer.render(scene, camera);
}

export default class SpiderScene extends Canvas3D {
    constructor(props) {
        super(props);
        this.canvasID = CANVAS_ID;
        this.init = init;
        this.animate = animate;
    }
}