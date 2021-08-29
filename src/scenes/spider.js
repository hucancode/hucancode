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
let curve, curveObject;
let path;
let currentPathNode = 0;
let nextPathNode = 1;
let nodeTravelTime = 0;
let nodeTravelDuration = 1.2;
const CANVAS_ID = 'spider';
const DRAW_PATH = true;
const ASPECT_RATIO = 0.75;
const LEG_STEP_FREQUENCY = 0.5;
const LEG_STEP_DURATION = 0.2;
const VISUALIZE_IK = true;
var speed = 3;

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
            let stepHeight = this.targetPosition.distanceTo(this.sourcePosition) * 0.4;
            if(stepHeight < 0.1)
            {
                stepHeight = 0;
            }
            this.bone.position.y = (1 - Math.abs(movementPercent - 0.5)*2) * stepHeight;
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
            const offset = speed * LEG_STEP_FREQUENCY/2;
            var angle = root.rotation.y;
            const localTarget = this.position.clone();
            localTarget.add(new THREE.Vector3(0, 0, offset)).applyAxisAngle(this.root.up, angle);
            this.targetPosition.copy(rootWorldPosition.add(localTarget));
            if(this.targetPosition.distanceTo(this.sourcePosition) < 0.5)
            {
                return;
            }
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
    camera.position.set(20, 20, 40);
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
    const MIN_X = -10;
    const VAR_X = 20;
    const MIN_Y = 0;
    const VAR_Y = 0;
    const MIN_Z = -20;
    const VAR_Z = 40;
    const points = [
        { x: -10, y: 0, z: -15 },
        { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
        { x: -10, y: 0, z: 15 },
        { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
        { x: -10, y: 0, z: -15 },
        { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
        { x: 10, y: 0, z: -15 },
        { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
        
    ];
    
    curve = new THREE.CatmullRomCurve3(
        points.map((e) => new THREE.Vector3(e.x, e.y, e.z))
    );
    curve.curveType = 'centripetal';
    curve.closed = true;
    path = curve.getPoints(100);
    if(DRAW_PATH)
    {
        curveObject = new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(path),
            new THREE.LineBasicMaterial({ color: 0x00ff00 })
        );
        //curveObject.rotation.y = Math.PI*0.5;
        scene.add(curveObject);
    }
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
        const links = [];
        {
            const i = index + 2;
            //const range = new THREE.Vector3(Math.PI*0.5, 0, Math.PI*0.5);
            const range = new THREE.Vector3(0, Math.PI*0.2, Math.PI*0.3);
            const rotationMin = body.skeleton.bones[i].rotation.clone();
            rotationMin.setFromVector3(rotationMin.toVector3().sub(range));
            const rotationMax = body.skeleton.bones[i].rotation.clone();
            rotationMax.setFromVector3(rotationMax.toVector3().add(range));
            console.log(`rotation min max = `);
            console.log(rotationMin);
            console.log(rotationMax);
            links.push({
                index: i, 
                rotationMin: rotationMin, 
                rotationMax: rotationMax
            });
        }
        {
            const i = index + 1;
            const range = new THREE.Vector3(Math.PI*0.1, 0, 0);
            const rotationMin = body.skeleton.bones[i].rotation.clone();
            rotationMin.setFromVector3(rotationMin.toVector3().sub(range));
            const rotationMax = body.skeleton.bones[i].rotation.clone();
            rotationMax.setFromVector3(rotationMax.toVector3().add(range));
            links.push({
                index: i, 
                rotationMin: rotationMin, 
                rotationMax: rotationMax
            });
        }
        {
            const i = index;
            const range = new THREE.Vector3(0, 0, Math.PI*0.5);
            const rotationMin = body.skeleton.bones[i].rotation.clone();
            rotationMin.setFromVector3(rotationMin.toVector3().sub(range));
            const rotationMax = body.skeleton.bones[i].rotation.clone();
            rotationMax.setFromVector3(rotationMax.toVector3().add(range));
            links.push({
                index: i, 
                rotationMin: rotationMin, 
                rotationMax: rotationMax
            });
        }
        iks.push({
            target: ikBoneIndex,
            effector: index + 3,
            links: links,
            iteration: 10,
            minAngle: 0.0,
            maxAngle: 0.01,
        });
        let position = new THREE.Vector3();
        ikBone.getWorldPosition(position);
        var offset = 0;
        if(ikBone.name.indexOf('L') !== -1)
        {
            offset += LEG_STEP_FREQUENCY/2;
        }
        if(ikBone.name.indexOf('b') !== -1)
        {
            offset += LEG_STEP_FREQUENCY/8;
        }
        if(ikBone.name.indexOf('c') !== -1)
        {
            offset += LEG_STEP_FREQUENCY/4;
        }
        if(ikBone.name.indexOf('d') !== -1)
        {
            offset += LEG_STEP_FREQUENCY/2;
        }
        const leg = new Leg(root, 
            position,
            ikBone,
            offset);
        legIKAnimator.push(leg);

        
    });
    ikSolver = new CCDIKSolver(body, iks);
    if(VISUALIZE_IK)
    {
        let helper = new CCDIKHelper(body, iks );
        scene.add( helper );
    }
    
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
    if(root)
    {
        nodeTravelTime += delta;
        var progress = nodeTravelTime/nodeTravelDuration;
        if(progress >= 1.0)
        {
            currentPathNode = (currentPathNode+1)%path.length;
            nextPathNode = (currentPathNode+1)%path.length;
            const distance = path[currentPathNode].distanceTo(path[nextPathNode]);
            nodeTravelTime = 0;
            nodeTravelDuration = distance/speed;
            progress = 0;
            root.lookAt(path[nextPathNode]);
        }
        root.lookAt(path[nextPathNode]);
        root.rotation.x = 0;
        root.rotation.z = 0;
        root.position.lerpVectors(path[currentPathNode], path[nextPathNode], progress);
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