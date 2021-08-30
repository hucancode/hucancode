import * as THREE from 'three';
import { CCDIKSolver,  CCDIKHelper} from '../three/IK/CCDIKSolver';
import { GLTFLoader } from '../three/loaders/GLTFLoader.js';
import Canvas3D from './canvas3D'
import { OrbitControls } from "../three/controls/OrbitControls";

let spiders = [];
let scene, camera, renderer;
let clock = new THREE.Clock();
const CANVAS_ID = 'spider';
const DRAW_PATH = false;
const ASPECT_RATIO = 0.75;
const LEG_STEP_FREQUENCY = 0.5;
const LEG_STEP_DURATION = 0.2;
const VISUALIZE_IK = false;
const USE_ORBIT_CONTROL = false;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const SPIDER_COUNT = 4;

function lerp(a, b, n) {
    return (1 - n) * a + n * b;
}
class Leg {
    constructor(root, position, bone, syncOffset = 0.0) {
        this.isMoving = true;
        this.movementTime = 0.0;
        this.time = syncOffset;
        this.sourcePosition = new THREE.Vector3();
        this.targetPosition = new THREE.Vector3();
        this.bone = bone;
        this.root = root;
        this.position = position;
    }
    update(deltaTime) {
        this.time += deltaTime;
        if(this.isMoving) {
            this.movementTime += deltaTime;
            const movementPercent = this.movementTime/LEG_STEP_DURATION;
            this.bone.position.lerpVectors(this.sourcePosition, this.targetPosition, movementPercent*1.3);
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
            var angle = this.root.rotation.y;
            const localTarget = this.position.clone();
            localTarget.applyAxisAngle(Y_AXIS, angle);
            this.targetPosition.copy(rootWorldPosition.add(localTarget));
            if(this.targetPosition.distanceTo(this.sourcePosition) < 0.5)
            {
                return;
            }
            this.isMoving = true;
        }
    }
}
class Spider {
    constructor(gltf) {
        this.gltfScene = gltf.scene;//.clone();
        this.legIKAnimator = [];
        this.path = [];
        this.currentPathNode = 0;
        this.nextPathNode = 1;
        this.targetAngle = 0;
        this.nodeTravelTime = 0;
        this.nodeTravelDuration = 1.2;
        this.speed = 3.5;
        this.findBodyParts();
        this.initIKSolver();
        this.buildCurvePath();
    }
    findBodyParts() {
        const litGray = new THREE.MeshPhongMaterial( { color: 0x333333, depthWrite: false } )
        //scene.add(this.gltfScene);
        this.gltfScene.traverse(child => {
            let isRootBone = child instanceof THREE.Bone && child.name==='root';
            if(isRootBone) {
                this.root = child;
                return; 
            }
            let isSkinnedMesh = child instanceof THREE.SkinnedMesh;
            if(isSkinnedMesh)
            {
                this.body = child;
            }
            if (!child.isMesh) {
                return;
            }
            child.castShadow = true;
            child.receiveShadow = false;
            child.material = litGray;
        });
    }
    initIKSolver() {
        let iks = [];
        this.body.skeleton.bones.forEach((bone, index) => {
            if(!bone.name==='root') {
                this.root = bone;
                return; 
            }
            if(!bone.name.startsWith('leg')) {
                return; 
            }
            if(!bone.name.endsWith('L') && !bone.name.endsWith('R')) {
                return;
            }
            let ikBoneIndex = this.body.skeleton.bones.findIndex(e => e.name === "IK_"+bone.name);
            let ikBone = this.body.skeleton.bones[ikBoneIndex];
            const links = [];
            {
                const i = index + 2;
                const range = new THREE.Vector3(0, Math.PI*0.2, Math.PI*0.3);
                const rotationMin = this.body.skeleton.bones[i].rotation.clone();
                rotationMin.setFromVector3(rotationMin.toVector3().sub(range));
                const rotationMax = this.body.skeleton.bones[i].rotation.clone();
                rotationMax.setFromVector3(rotationMax.toVector3().add(range));
                links.push({
                    index: i, 
                    rotationMin: rotationMin, 
                    rotationMax: rotationMax
                });
            }
            {
                const i = index + 1;
                const range = new THREE.Vector3(Math.PI*0.1, 0, 0);
                const rotationMin = this.body.skeleton.bones[i].rotation.clone();
                rotationMin.setFromVector3(rotationMin.toVector3().sub(range));
                const rotationMax = this.body.skeleton.bones[i].rotation.clone();
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
                const rotationMin = this.body.skeleton.bones[i].rotation.clone();
                rotationMin.setFromVector3(rotationMin.toVector3().sub(range));
                const rotationMax = this.body.skeleton.bones[i].rotation.clone();
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
            const leg = new Leg(this.root, 
                position,
                ikBone,
                offset);
            this.legIKAnimator.push(leg);
        });
        this.ikSolver = new CCDIKSolver(this.body, iks);
        if(VISUALIZE_IK)
        {
            let helper = new CCDIKHelper(this.body, iks );
            scene.add( helper );
        }
    }
    
    buildCurvePath() {
        const MIN_X = -10;
        const VAR_X = 20;
        const MIN_Y = 0;
        const VAR_Y = 0;
        const MIN_Z = -10;
        const VAR_Z = 20;
        const points = [
            { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
            { x: -10, y: 0, z: -10 },
            { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
            { x: -10, y: 0, z: 10 },
            { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
            { x: -10, y: 0, z: -10 },
            { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
            { x: 10, y: 0, z: -10 },
            { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },  
            { x: -10, y: 0, z: -10 },
            { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
            { x: -10, y: 0, z: 10 },
            { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
            { x: -10, y: 0, z: -10 },
            { x: Math.random()*VAR_X+MIN_X, y: Math.random()*VAR_Y+MIN_Y, z: Math.random()*VAR_Z+MIN_Z },
            { x: 10, y: 0, z: -10 },
        ];
        this.curve = new THREE.CatmullRomCurve3(
            points.map((e) => new THREE.Vector3(e.x, e.y, e.z))
        );
        this.curve.curveType = 'centripetal';
        this.curve.closed = true;
        this.path = this.curve.getPoints(100);
        if(DRAW_PATH)
        {
            this.curveObject = new THREE.LineLoop(
                new THREE.BufferGeometry().setFromPoints(this.path),
                new THREE.LineBasicMaterial({ color: 0x00ff00 })
            );
            scene.add(this.curveObject);
        }
    }
    update(deltaTime) {
        if(!this.root)
        {
            return;
        }
        if(this.ikSolver)
        {
            this.ikSolver.update();
        }
        this.nodeTravelTime += deltaTime;
        var progress = this.nodeTravelTime/this.nodeTravelDuration;
        if(progress >= 1.0)
        {
            this.currentPathNode = (this.currentPathNode+1)%this.path.length;
            this.nextPathNode = (this.currentPathNode+1)%this.path.length;
            const distance = this.path[this.currentPathNode].distanceTo(this.path[this.nextPathNode]);
            this.nodeTravelTime = 0;
            this.nodeTravelDuration = distance/this.speed;
            progress = 0;
            const currentPath = new THREE.Vector3();
            currentPath.subVectors(this.path[this.nextPathNode], this.path[this.currentPathNode]);
            this.targetAngle = Math.atan2(currentPath.x, currentPath.z);
            const distanceRad = Math.abs(this.root.rotation.y - this.targetAngle);
            if(distanceRad > Math.PI) {
                //targetAngle = Math.PI*2 - targetAngle;
            }
        }
        const angle = lerp(this.root.rotation.y, this.targetAngle, 0.02);
        this.root.rotation.y = angle;
        if(Math.abs(angle - this.targetAngle) > 0.5)
        {
            this.nodeTravelTime = 0;
        }
        this.root.position.lerpVectors(this.path[this.currentPathNode], this.path[this.nextPathNode], progress);
        //console.log(`spider update`);
        this.legIKAnimator.forEach((leg) => {
            leg.update(deltaTime);
        });
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
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
    camera.position.set(35, 30, 35);
    camera.lookAt(scene.position);
    window.addEventListener('resize', onWindowResize);

    // lights
    const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
    hemiLight.position.set( 0, 20, 0 );
    scene.add( hemiLight );
    const dirLight = new THREE.DirectionalLight( 0xffffff );
    dirLight.position.set( 0, 20, 10 );
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = - 100;
    dirLight.shadow.camera.left = - 120;
    dirLight.shadow.camera.right = 120;
    scene.add( dirLight );

    // ground
    const mesh = new THREE.Mesh( new THREE.PlaneGeometry( 35, 35 ), new THREE.MeshPhongMaterial( { color: 0x666666, depthWrite: false } ) );
    mesh.rotation.x = - Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add( mesh );
    const grid = new THREE.GridHelper( 35, 10, 0x0000ff, 0x000000 );
    grid.material.opacity = 0.3;
    grid.material.transparent = true;
    scene.add( grid );

    const litGray = new THREE.MeshPhongMaterial( { color: 0x333333, depthWrite: false } )
    const loader = new GLTFLoader();
    loader.setPath('assets/gltf/');
    for(var i=0;i<SPIDER_COUNT;i++)
    {
        loader.load( 'spider.gltf', function ( gltf ) {
            const spider = new Spider(gltf);
            scene.add(gltf.scene);
            spiders.push(spider);
            spider.speed = Math.random()*2 + 1.5;
        });
    }
    if(USE_ORBIT_CONTROL)
    {
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0, 0);
        controls.update();
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
    spiders.forEach(spider => spider.update(delta));
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