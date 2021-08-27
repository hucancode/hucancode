import * as THREE from 'three';
// import { GLTFLoader } from '../three/loaders/GLTFLoader.js';
import Canvas3D from './canvas3D'

let scene, camera, renderer;
let clock = new THREE.Clock();
let body, legFrontL, legFrontR, legMidL, legMidR, legRearL, legRearR;
var time = 0;
const CANVAS_ID = 'spider';
const ASPECT_RATIO = 0.75;
const LEG_STEP_FREQUENCY = 0.4;
const LEG_STEP_DURATION = 0.2;

class Leg {
    constructor(parent, position, mesh, syncOffset = 0.0) {
        this.isMoving = false;
        this.movementTime = 0.0;
        this.time = syncOffset;
        this.sourcePosition = new THREE.Vector3();
        this.targetPosition = new THREE.Vector3();
        this.mesh = mesh;
        this.parent = parent;
        this.position = position;
        mesh.position.copy(parent.position.clone().add(position));
    }
    update(deltaTime) {
        this.time += deltaTime;
        if(this.isMoving) {
            this.movementTime += deltaTime;
            this.mesh.position.lerpVectors(this.sourcePosition, this.targetPosition, this.movementTime/LEG_STEP_DURATION);
            if(this.movementTime >= LEG_STEP_DURATION)
            {
                this.isMoving = false;
            }
        }
        if(this.time > LEG_STEP_FREQUENCY)
        {
            this.time -= LEG_STEP_FREQUENCY;
            this.movementTime = 0;
            this.sourcePosition.copy(this.mesh.position);
            this.targetPosition.copy(this.parent.position.clone().add(this.position));
            this.isMoving = true;
        }
    }
  }

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
    camera.position.set(100, 100, 200);
    camera.lookAt(scene.position);
    window.addEventListener('resize', onWindowResize);
    const bigSphere = new THREE.SphereGeometry( 5, 16, 8 );
    const smallSphere = new THREE.SphereGeometry( 1, 16, 8 );
    const unlitWhite = new THREE.MeshBasicMaterial( { color: 0xffffff } );
    const unlitAzure = new THREE.MeshBasicMaterial( { color: 0x0077ff } );
    body = new THREE.Mesh(bigSphere, unlitWhite);
    body.position.set(0, 0, 0);

    legFrontL = new Leg(body, 
        new THREE.Vector3(5,0,5),
        new THREE.Mesh(smallSphere, unlitAzure),
        0.4);
    legFrontR = new Leg(body, 
        new THREE.Vector3(5,0,-5),
        new THREE.Mesh(smallSphere, unlitAzure));
    legMidL = new Leg(body, 
        new THREE.Vector3(0,0,7),
        new THREE.Mesh(smallSphere, unlitAzure),
        -0.3);
    legMidR = new Leg(body, 
        new THREE.Vector3(0,0,-7),
        new THREE.Mesh(smallSphere, unlitAzure),
        -0.3);
    legRearL = new Leg(body, 
        new THREE.Vector3(-5,0,5),
        new THREE.Mesh(smallSphere, unlitAzure));
    legRearR = new Leg(body, 
        new THREE.Vector3(-5,0,-5),
        new THREE.Mesh(smallSphere, unlitAzure),
        0.4);
    
    scene.add(body);
    scene.add(legFrontL.mesh);
    scene.add(legFrontR.mesh);
    scene.add(legMidL.mesh);
    scene.add(legMidR.mesh);
    scene.add(legRearL.mesh);
    scene.add(legRearR.mesh);
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

function animate() {
    const delta = clock.getDelta();
    time += delta;
    body.position.setX(Math.sin(time*0.3)*100);
    legFrontL.update(delta);
    legFrontR.update(delta);
    legMidL.update(delta);
    legMidR.update(delta);
    legRearL.update(delta);
    legRearR.update(delta);
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