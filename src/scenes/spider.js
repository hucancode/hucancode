import * as THREE from 'three';
import { CCDIKSolver,  CCDIKHelper} from '../three/IK/CCDIKSolver';
import { GLTFLoader } from '../three/loaders/GLTFLoader.js';
import Canvas3D from './canvas3D'
import { OrbitControls } from "../three/controls/OrbitControls";

let scene, camera, renderer;
let ikSolver;// = new CCDIKSolver();
let clock = new THREE.Clock();
let root, body;
let legIKAnimator = [];
var time = 0;
const CANVAS_ID = 'spider';
const ASPECT_RATIO = 0.75;
const LEG_STEP_FREQUENCY = 0.4;
const LEG_STEP_DURATION = 0.2;
const STEP_HEIGHT = 2;

class Leg {
    constructor(root, position, bone, syncOffset = 0.0) {
        this.isMoving = false;
        this.movementTime = 0.0;
        this.time = syncOffset;
        this.sourcePosition = new THREE.Vector3();
        this.targetPosition = new THREE.Vector3();
        this.bone = bone;
        this.root = root;
        this.position = position;
        bone.position.copy(root.position.clone().add(position));
    }
    update(deltaTime) {
        this.time += deltaTime;
        if(this.isMoving) {
            this.movementTime += deltaTime;
            const movementPercent = this.movementTime/LEG_STEP_DURATION;
            this.bone.position.lerpVectors(this.sourcePosition, this.targetPosition, movementPercent);
            this.bone.position.y = (1 - Math.abs(movementPercent - 0.5)*2) * STEP_HEIGHT;
            if(this.movementTime >= LEG_STEP_DURATION)
            {
                this.isMoving = false;
            }
        }
        if(this.time > LEG_STEP_FREQUENCY)
        {
            this.time -= LEG_STEP_FREQUENCY;
            this.movementTime = 0;
            this.sourcePosition.copy(this.bone.position);
            const rootWorldPosition = new THREE.Vector3();
            this.root.getWorldPosition(rootWorldPosition);
            this.targetPosition.copy(rootWorldPosition.add(this.position));
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
    camera.position.set(10, 10, 20);
    //camera.position.set(4, 4, 8);
    camera.lookAt(scene.position);
    window.addEventListener('resize', onWindowResize);
    const unlitWhite = new THREE.MeshBasicMaterial( { color: 0xffffff } );
    const loader = new GLTFLoader();
    loader.setPath('assets/gltf/');
    loader.load( 'spider.gltf', function ( gltf ) {
        scene.add(gltf.scene);
        gltf.scene.traverse(child => {
            let isRootBone = child instanceof THREE.Bone && child.name==='root';
            if(isRootBone) {
                root = child;
                return; 
            }
            let isSkinnedMesh = child instanceof THREE.SkinnedMesh;
            if(isSkinnedMesh)
            {
                body = child;
                let skeletonHelper = new THREE.SkeletonHelper( child );
				skeletonHelper.material.linewidth = 5;
				scene.add(skeletonHelper);
            }
            if (!child.isMesh) {
                return;
            }
            child.castShadow = true;
            child.receiveShadow = false;
            child.material = unlitWhite;
        });
        initIKSolver();
    });
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();
}

function initIKSolver()
{
    let iks = [];
    body.skeleton.bones.forEach((bone, index) => {
        if(!bone.name==='root') {
            root = bone;
            return; 
        }
        if(!bone.name.startsWith('leg')) {
            return; 
        }
        console.log(`bone ${index} ${bone.name}`);
        if(!bone.name.endsWith('L') && !bone.name.endsWith('R')) {
            return;
        }
        let ikBoneIndex = body.skeleton.bones.findIndex(e => e.name === "IK_"+bone.name);
        let ikBone = body.skeleton.bones[ikBoneIndex];
        console.log(`create IK with ${ikBone.name}, effector = ${body.skeleton.bones[index + 2].name}`);
        iks.push({
            target: ikBoneIndex,
            effector: index + 3,
            links: [
                { index: index + 2 }, 
                { index: index + 1, limitation: new THREE.Vector3( 0, 0, 0 ) }, 
                { index : index} ],
            iteration: 5,
            minAngle: 0.0,
            maxAngle: 1.0,
        });
        let position = new THREE.Vector3();
        ikBone.getWorldPosition(position);
        const leg = new Leg(root, 
            position,
            ikBone,
            Math.random()*0.5);
        legIKAnimator.push(leg);

        
    });
    ikSolver = new CCDIKSolver(body, iks);
    let helper = new CCDIKHelper(body, iks );
    scene.add( helper );
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
    if(root)
    {
        root.position.setZ(Math.sin(time*0.3)*20);
    }
    legIKAnimator.forEach((leg) => {
        leg.update(delta);
    });
    if(ikSolver)
    {
        ikSolver.update();
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