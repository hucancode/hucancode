import { createPlayground, createOrbit, boxGeometry, mat4, animate, stagger, utils, eases, MAT4 } from "$lib/engine/index.js";
import { hexToRGB } from "$lib/math/color.js";
import RUBIK from "./shaders/rubik.wgsl?shader";
import { solve, extractState, toPlaygroundMoves, moveToNotation, parseNotation } from "./solver.js";

const FACE_RIGHT = 0, FACE_LEFT = 1, FACE_TOP = 2, FACE_BOTTOM = 3, FACE_FRONT = 4, FACE_BACK = 5;
const FACE_TO_COLOR = [0x40a02b, 0x89b4fa, 0xf9e2af, 0xf8fafc, 0xef4444, 0xfe640b];
const BLACK = 0x181825;
const RUBIK_SIZE = 8;
const CUBE_MARGIN = 0.1;
const CELL = (1 + CUBE_MARGIN) * RUBIK_SIZE;
const CUBE_NUM_DEFAULT = 3;

const RANDOM_EASES = [
  eases.inElastic, eases.outElastic, eases.inOutElastic, eases.outInElastic,
  eases.inCubic, eases.inQuint, eases.inBack, eases.outCubic, eases.outQuint,
  eases.outBack, eases.inBounce, eases.inOutCubic, eases.inOutBack, eases.outBounce,
  eases.outInCubic, eases.outInBack, eases.outInBounce,
];

const config = { speed: 1, autoplay: true, randomEase: true, onSolution: null };
let cubeNum = CUBE_NUM_DEFAULT;

let device = null, shader, orbit;
let cubes = [];
let move = null;
let busy = false;
let running = false;
let queue = [];
let pendingSolve = false;
// current solution being played back / scrubbed
let solution = null;
let solutionPos = 0;
let solutionPlaying = false;
let inSolutionMove = false;

const CAM_PITCH = Math.PI / 4;
const _rot = mat4.create();
const _model = mat4.create();
const _t = mat4.create();
const _vp = mat4.create();

function setConfig(patch) {
  Object.assign(config, patch);
  if (config.autoplay) resume();
}
function setCubeSize(size) {
  cubeNum = size;
}

function isInFace(x, y, z, face, depth) {
  return (
    (face === FACE_TOP && y >= cubeNum - depth) ||
    (face === FACE_BOTTOM && y < depth) ||
    (face === FACE_FRONT && z >= cubeNum - depth) ||
    (face === FACE_BACK && z < depth) ||
    (face === FACE_LEFT && x < depth) ||
    (face === FACE_RIGHT && x >= cubeNum - depth)
  );
}
function faceColor(x, y, z, face) {
  return isInFace(x, y, z, face, 1) ? FACE_TO_COLOR[face] : BLACK;
}

// unit box, 6 verts/face, faces ordered +X,-X,+Y,-Y,+Z,-Z (matches faceColor index)
function makeCubeData(x, y, z) {
  const g = boxGeometry(1, 1, 1);
  const pos = g.attributes.position.array;
  const count = g.attributes.position.count;
  const color = new Float32Array(36 * 3);
  for (let face = 0; face < 6; face++) {
    const c = hexToRGB(faceColor(x, y, z, face));
    for (let v = 0; v < 6; v++) {
      const o = (face * 6 + v) * 3;
      color[o] = c[0]; color[o + 1] = c[1]; color[o + 2] = c[2];
    }
  }
  return { position: pos, color, count };
}

function buildCubes() {
  cubes = [];
  for (let y = 0; y < cubeNum; y++) {
    for (let x = 0; x < cubeNum; x++) {
      for (let z = 0; z < cubeNum; z++) {
        const d = makeCubeData(x, y, z);
        cubes.push({
          posBuf: device.buffer({ kind: "vertex", data: d.position }),
          colorBuf: device.buffer({ kind: "vertex", data: d.color }),
          count: d.count,
          base: mat4.create(),
          intro: { x: 0, y: 0 },
        });
      }
    }
  }
  resetTransforms();
}

// place every cubelet back at its solved home transform (same order as buildCubes)
function resetTransforms() {
  const half = (cubeNum - 1) / 2;
  let i = 0;
  for (let y = 0; y < cubeNum; y++) {
    for (let x = 0; x < cubeNum; x++) {
      for (let z = 0; z < cubeNum; z++) {
        mat4.compose(
          cubes[i++].base,
          { x: (x - half) * CELL, y: (y - half) * CELL, z: (z - half) * CELL },
          { x: 0, y: 0, z: 0 },
          { x: RUBIK_SIZE, y: RUBIK_SIZE, z: RUBIK_SIZE },
        );
      }
    }
  }
}

function disposeCubes() {
  for (const c of cubes) {
    c.posBuf?.destroy();
    c.colorBuf?.destroy();
  }
  cubes = [];
}

// recover cubelet integer grid coord from world translation
function gridOf(base) {
  const half = (cubeNum - 1) / 2;
  return {
    x: Math.round(base[12] / CELL + half),
    y: Math.round(base[13] / CELL + half),
    z: Math.round(base[14] / CELL + half),
  };
}

function rotationFor(axis, angle) {
  if (axis === 0) return mat4.rotationX(_rot, angle);
  if (axis === 1) return mat4.rotationY(_rot, angle);
  return mat4.rotationZ(_rot, angle);
}

const axisForFace = (face) =>
  face === FACE_LEFT || face === FACE_RIGHT ? 0
  : face === FACE_TOP || face === FACE_BOTTOM ? 1 : 2;

function randomMove() {
  return {
    face: Math.floor(Math.random() * 6),
    depth: Math.floor(Math.random() * (cubeNum - 1)) + 1,
    magnitude: (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 2) + 1),
    quick: true,
  };
}

function startMoveRandom() {
  if (busy || !running) return;
  clearSolution();
  const m = randomMove();
  startMove(m.face, m.depth, m.magnitude);
}

// run the next pending thing: queued moves, then a deferred solve, then
// solution playback, then autoplay
function advance() {
  if (busy || !running) return;
  if (queue.length) {
    const q = queue.shift();
    startMove(q.face, q.depth, q.magnitude, q.quick);
    return;
  }
  if (pendingSolve) {
    pendingSolve = false;
    runSolve();
    return;
  }
  if (solution && solutionPlaying && solutionPos < solution.length) {
    inSolutionMove = true;
    const m = solution[solutionPos];
    startMove(m.face, m.depth, m.magnitude);
    return;
  }
  if (config.autoplay) startMoveRandom();
}

function startMove(face, depth, magnitude, quick = false) {
  const axis = axisForFace(face);
  const idx = [];
  for (let i = 0; i < cubes.length; i++) {
    const g = gridOf(cubes[i].base);
    if (isInFace(g.x, g.y, g.z, face, depth)) idx.push(i);
  }
  const target = (Math.PI / 2) * magnitude;
  const ease = quick ? eases.outCubic
    : config.randomEase
    ? RANDOM_EASES[Math.floor(Math.random() * RANDOM_EASES.length)]
    : eases.inOutCubic;
  const spd = config.speed || 1;
  busy = true;
  move = { idx, axis, angle: { v: 0 }, target };
  animate(move.angle, {
    v: target,
    duration: quick ? 120 : (600 * Math.abs(magnitude)) / spd,
    delay: quick ? 30 : 200 / spd,
    ease,
    onComplete: () => {
      const R = rotationFor(axis, target);
      for (const i of idx) {
        mat4.multiply(cubes[i].base, R, cubes[i].base);
        snap(cubes[i].base);
      }
      move = null;
      busy = false;
      if (inSolutionMove) {
        inSolutionMove = false;
        solutionPos++;
        if (solutionPos >= solution.length) solutionPlaying = false;
        notifySolution();
      }
      advance();
    },
  });
}

// apply a move to the bases with no animation (solution scrubbing)
function applyInstant(face, depth, magnitude) {
  const R = rotationFor(axisForFace(face), (Math.PI / 2) * magnitude);
  for (const c of cubes) {
    const g = gridOf(c.base);
    if (isInFace(g.x, g.y, g.z, face, depth)) {
      mat4.multiply(c.base, R, c.base);
      snap(c.base);
    }
  }
}

// cancel an in-flight animated move; bases are only mutated on completion,
// so dropping the tween leaves logical state untouched
function cancelMove() {
  if (!move) return;
  utils.remove(move.angle);
  move = null;
  busy = false;
  inSolutionMove = false;
}

// re-quantize translation to exact grid centres; kills accumulated float drift
function snap(base) {
  const half = (cubeNum - 1) / 2;
  base[12] = (Math.round(base[12] / CELL + half) - half) * CELL;
  base[13] = (Math.round(base[13] / CELL + half) - half) * CELL;
  base[14] = (Math.round(base[14] / CELL + half) - half) * CELL;
}

function resume() {
  if (!busy && config.autoplay && running) startMoveRandom();
}
function step() {
  if (!busy) startMoveRandom();
}

// ---------------------------------------------------------------------------
// solving

function notifySolution() {
  config.onSolution?.(
    solution
      ? { pos: solutionPos, total: solution.length, playing: solutionPlaying }
      : { pos: 0, total: 0, playing: false },
  );
}

function clearSolution() {
  if (!solution) return;
  solution = null;
  solutionPos = 0;
  solutionPlaying = false;
  inSolutionMove = false;
  notifySolution();
}

// cubelet transforms in solver form: unit grid pos + integer rotation matrix
function cubeletsForSolver() {
  return cubes.map((c) => {
    const b = c.base;
    return {
      p: [Math.round(b[12] / CELL), Math.round(b[13] / CELL), Math.round(b[14] / CELL)],
      r: [b[0], b[1], b[2], b[4], b[5], b[6], b[8], b[9], b[10]].map((v) => Math.round(v / RUBIK_SIZE)),
    };
  });
}

function runSolve() {
  solution = toPlaygroundMoves(solve(extractState(cubeletsForSolver())));
  solutionPos = 0;
  solutionPlaying = solution.length > 0;
  notifySolution();
  advance();
}

function solveCube() {
  if (cubeNum !== 3 || !running) return;
  config.autoplay = false;
  queue = [];
  clearSolution();
  if (busy) pendingSolve = true;
  else runSolve();
}

// jump to an arbitrary point of the current solution, pausing playback
function seekSolution(pos) {
  if (!solution) return;
  pos = Math.max(0, Math.min(solution.length, Math.round(pos)));
  if (inSolutionMove) cancelMove();
  if (busy) return;
  solutionPlaying = false;
  while (solutionPos < pos) {
    const m = solution[solutionPos++];
    applyInstant(m.face, m.depth, m.magnitude);
  }
  while (solutionPos > pos) {
    const m = solution[--solutionPos];
    applyInstant(m.face, m.depth, -m.magnitude);
  }
  notifySolution();
}

function playSolution() {
  if (!solution) return;
  solutionPlaying = solutionPos < solution.length;
  notifySolution();
  advance();
}

function pauseSolution() {
  solutionPlaying = false;
  notifySolution();
}

// ---------------------------------------------------------------------------
// scramble + notation

// queue a random scramble, return it as notation
function scramble() {
  if (!running) return "";
  clearSolution();
  pendingSolve = false;
  const moves = [];
  for (let i = 0; i < cubeNum * 7; i++) moves.push(randomMove());
  queue.push(...moves);
  advance();
  return moves.map(moveToNotation).join(" ");
}

// reset to solved, then play `text` as a scramble; false on parse error
function applyScramble(text) {
  if (!running) return false;
  const moves = parseNotation(text, cubeNum);
  if (!moves) return false;
  clearSolution();
  pendingSolve = false;
  cancelMove();
  queue = moves;
  resetTransforms();
  advance();
  return true;
}

function entrance() {
  const targets = cubes.map((c) => c.intro);
  for (const c of cubes) {
    c.intro.x = -5 * CELL;
    c.intro.y = -20 * CELL;
  }
  animate(targets, {
    x: 0,
    y: { to: 0, ease: eases.outElastic },
    duration: 1000,
    delay: stagger(20),
    ease: eases.outSine,
    onComplete: () => {
      running = true;
      if (config.autoplay) startMoveRandom();
    },
  });
}

const { init, render, destroy } = createPlayground({
  camera: { fov: 45, near: 1, far: 2000 },
  init(ctx) {
    device = ctx.device;
    shader = device.shader({
      ...RUBIK,
      buffers: [
        { stride: 12, step: "vertex", attributes: [{ name: "position", location: 0, format: "float32x3", offset: 0 }] },
        { stride: 12, step: "vertex", attributes: [{ name: "color", location: 1, format: "float32x3", offset: 0 }] },
      ],
      uniforms: [MAT4("uViewProj"), MAT4("uModel")],
      depth: "test", blend: "none", topology: "tri",
    });
    // orbit yaw = PI/2 - old yaw convention; PI/4 is its own mirror, drag sign matches
    orbit = createOrbit(ctx.canvas, { yaw: Math.PI / 4, pitch: CAM_PITCH, lockPitch: true });
    buildCubes();
    entrance();
  },
  frame(_dt, { device, camera }) {
    orbit.dist = cubeNum * CELL * 2.2 + RUBIK_SIZE * 2;
    orbit.placeCamera(camera);
    mat4.copy(_vp, device.correctViewProj(camera.viewProjMatrix));

    device.beginFrame();
    device.pass({ clear: [0.09, 0.09, 0.11, 1], depth: true, depthClear: 1 }, (p) => {
      for (let i = 0; i < cubes.length; i++) {
        const cube = cubes[i];
        let model = cube.base;
        if (move && move.idx.includes(i)) {
          mat4.multiply(_model, rotationFor(move.axis, move.angle.v), cube.base);
          model = _model;
        }
        mat4.translation(_t, cube.intro.x, cube.intro.y, 0);
        mat4.multiply(_t, _t, model);
        p.draw(shader, {
          buffers: [cube.posBuf, cube.colorBuf],
          count: cube.count,
          uniforms: { uViewProj: _vp, uModel: _t },
        });
      }
    });
    device.endFrame();
  },
  destroy() {
    running = false;
    busy = false;
    queue = [];
    pendingSolve = false;
    solution = null;
    solutionPos = 0;
    solutionPlaying = false;
    inSolutionMove = false;
    if (move) utils.remove(move.angle);
    utils.remove(cubes.map((c) => c.intro));
    move = null;
    orbit?.detach();
    orbit = null;
    disposeCubes();
    shader = null;
    device = null;
  },
});

export {
  init, render, destroy, setConfig, setCubeSize, step, resume, config,
  solveCube, seekSolution, playSolution, pauseSolution, scramble, applyScramble,
};
