// 3x3 solving engine: Thistlethwaite's four phases, bidirectional BFS per phase
// (compact formulation after Stefan Pochmann's C++ solver).
//
// State: 40 ints. [0..11] edge piece at each edge position, [12..19] corner
// piece (+12) at each corner position, [20..39] orientation at each position.
// Solver faces: U=0 D=1 F=2 B=3 L=4 R=5; move = face*3 + quarterTurns-1,
// one quarter turn = -90deg about the face's outward normal (clockwise
// looking at the face).
//
// Edges: 0 UF, 1 UR, 2 UB, 3 UL, 4 DF, 5 DR, 6 DB, 7 DL, 8 FR, 9 FL, 10 BR, 11 BL
// Corners: 0 UFR, 1 UBR, 2 UBL, 3 UFL, 4 DFR, 5 DFL, 6 DBL, 7 DBR

const AFFECTED = [
  [0, 1, 2, 3, 0, 1, 2, 3], // U
  [4, 7, 6, 5, 4, 5, 6, 7], // D
  [0, 9, 4, 8, 0, 3, 5, 4], // F
  [2, 10, 6, 11, 2, 1, 7, 6], // B
  [3, 11, 7, 9, 3, 2, 6, 5], // L
  [1, 8, 5, 10, 1, 0, 4, 7], // R
];

// move sets per phase: all -> no F/B quarters -> only U/D quarters -> half turns
const PHASE_MOVES = [262143, 259263, 74943, 74898];

export const SOLVED = [...Array(20).keys(), ...Array(20).fill(0)];

export function applyMove(move, state) {
  const face = (move / 3) | 0;
  let turns = (move % 3) + 1;
  state = state.slice();
  while (turns--) {
    const old = state.slice();
    for (let i = 0; i < 8; i++) {
      const isCorner = i > 3 ? 1 : 0;
      const target = AFFECTED[face][i] + isCorner * 12;
      const killer = AFFECTED[face][(i & 3) === 3 ? i - 3 : i + 1] + isCorner * 12;
      // F/B quarters flip edges; corner twist alternates 2,1 except on U/D
      const delta = i < 4 ? (face === 2 || face === 3 ? 1 : 0) : face < 2 ? 0 : 2 - (i & 1);
      state[target] = old[killer];
      state[target + 20] = (old[killer + 20] + delta) % (2 + isCorner);
    }
  }
  return state;
}

const inverse = (m) => m + 2 - 2 * (m % 3);

// invariant fixed by each phase: edge orientation -> corner orientation +
// E-slice edges -> slice membership + corner tetrads + parity -> everything
function phaseId(s, phase) {
  if (phase === 0) return s.slice(20, 32).join("");
  if (phase === 1) {
    let slice = 0;
    for (let e = 0; e < 12; e++) slice = slice * 2 + (s[e] > 7 ? 1 : 0);
    return s.slice(32, 40).join("") + "|" + slice;
  }
  if (phase === 2) {
    let id = "";
    for (let e = 0; e < 12; e++) id += s[e] > 7 ? 2 : s[e] & 1;
    for (let c = 12; c < 20; c++) id += (s[c] - 12) & 5;
    let parity = 0;
    for (let i = 12; i < 20; i++)
      for (let j = i + 1; j < 20; j++) parity ^= s[i] > s[j] ? 1 : 0;
    return id + parity;
  }
  return s.join(",");
}

// returns move list (indices 0..17) bringing `state` to SOLVED
export function solve(state) {
  const solution = [];
  let cur = state.slice();
  for (let phase = 0; phase < 4; phase++) {
    const curId = phaseId(cur, phase);
    const goalId = phaseId(SOLVED, phase);
    if (curId === goalId) continue;

    // bidirectional BFS, frontiers keyed by phase id
    const queue = [cur, SOLVED];
    const dir = new Map([[curId, 1], [goalId, 2]]);
    const pred = new Map();
    const lastMove = new Map();
    let algo = null;
    for (let head = 0; !algo; head++) {
      if (head >= queue.length) throw new Error("rubik solver: unreachable state");
      const oldState = queue[head];
      const oldId = phaseId(oldState, phase);
      const oldDir = dir.get(oldId);
      for (let m = 0; m < 18 && !algo; m++) {
        if (!((PHASE_MOVES[phase] >> m) & 1)) continue;
        const newState = applyMove(m, oldState);
        const newId = phaseId(newState, phase);
        const newDir = dir.get(newId);
        if (newDir !== undefined && newDir !== oldDir) {
          // frontiers met; stitch forward path + reversed backward path
          let a = oldId, b = newId, mid = m;
          if (oldDir === 2) [a, b, mid] = [newId, oldId, inverse(m)];
          algo = [mid];
          while (a !== curId) { algo.unshift(lastMove.get(a)); a = pred.get(a); }
          while (b !== goalId) { algo.push(inverse(lastMove.get(b))); b = pred.get(b); }
        } else if (newDir === undefined) {
          dir.set(newId, oldDir);
          pred.set(newId, oldId);
          lastMove.set(newId, m);
          queue.push(newState);
        }
      }
    }
    for (const m of algo) {
      cur = applyMove(m, cur);
      solution.push(m);
    }
  }
  return solution;
}

// ---------------------------------------------------------------------------
// State extraction from cubelet transforms (position + rotation), so any
// reachable configuration works -- including wide moves that rotate centers.
// Input: 27 x { p: [x,y,z] in {-1,0,1}, r: 9 ints, column-major rotation
// mapping home space -> world space }.

// world dir of each solver face: U +Y, D -Y, F +Z, B -Z, L -X, R +X
const DIRS = [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [-1, 0, 0], [1, 0, 0]];
// slot faces per position, primary (U/D, else F/B) first
const EDGE_SLOTS = [
  [0, 2], [0, 5], [0, 3], [0, 4], [1, 2], [1, 5], [1, 3], [1, 4],
  [2, 5], [2, 4], [3, 5], [3, 4],
];
// slot faces per position, counter-clockwise from U/D (matches twist deltas above)
const CORNER_SLOTS = [
  [0, 2, 5], [0, 5, 3], [0, 3, 4], [0, 4, 2],
  [1, 5, 2], [1, 2, 4], [1, 4, 3], [1, 3, 5],
];

const dirIdx = (v) => DIRS.findIndex((d) => d[0] === v[0] && d[1] === v[1] && d[2] === v[2]);
const rotW = (r, v) => [
  r[0] * v[0] + r[3] * v[1] + r[6] * v[2],
  r[1] * v[0] + r[4] * v[1] + r[7] * v[2],
  r[2] * v[0] + r[5] * v[1] + r[8] * v[2],
];
const rotH = (r, v) => [
  r[0] * v[0] + r[1] * v[1] + r[2] * v[2],
  r[3] * v[0] + r[4] * v[1] + r[5] * v[2],
  r[6] * v[0] + r[7] * v[1] + r[8] * v[2],
];
const findSlot = (table, faces) => {
  const key = faces.slice().sort().join();
  return table.findIndex((s) => s.slice().sort().join() === key);
};

export function extractState(cubelets) {
  // a sticker's colour is its home face; centers tell which colour lives on
  // which world face right now
  const solverFaceOfColor = new Array(6);
  const pieces = [];
  for (const { p, r } of cubelets) {
    const h = rotH(r, p);
    const stickers = [];
    for (let axis = 0; axis < 3; axis++) {
      if (!h[axis]) continue;
      const n = [0, 0, 0];
      n[axis] = h[axis];
      stickers.push({ color: dirIdx(n), slot: dirIdx(rotW(r, n)) });
    }
    if (stickers.length === 1) solverFaceOfColor[stickers[0].color] = stickers[0].slot;
    else if (stickers.length) pieces.push({ p, stickers });
  }

  const state = SOLVED.slice();
  for (const { p, stickers } of pieces) {
    for (const s of stickers) s.color = solverFaceOfColor[s.color];
    const posFaces = stickers.map((s) => s.slot);
    const colFaces = stickers.map((s) => s.color);
    if (stickers.length === 2) {
      const pos = findSlot(EDGE_SLOTS, posFaces);
      const piece = findSlot(EDGE_SLOTS, colFaces);
      const primary = stickers.find((s) => s.color === EDGE_SLOTS[piece][0]);
      state[pos] = piece;
      state[pos + 20] = primary.slot === EDGE_SLOTS[pos][0] ? 0 : 1;
    } else {
      const pos = findSlot(CORNER_SLOTS, posFaces);
      const piece = findSlot(CORNER_SLOTS, colFaces);
      const primary = stickers.find((s) => s.color === CORNER_SLOTS[piece][0]);
      state[pos + 12] = piece + 12;
      state[pos + 32] = CORNER_SLOTS[pos].indexOf(primary.slot);
    }
  }
  return state;
}

// solver moves -> playground { face, depth, magnitude }; magnitude is
// quarter-turns about the +axis, solver quarter is -90 about outward normal
const SOLVER_TO_PG_FACE = [2, 3, 4, 5, 1, 0]; // U D F B L R -> TOP BOTTOM FRONT BACK LEFT RIGHT
const ON_POSITIVE_AXIS = [true, false, true, false, false, true];

export function toPlaygroundMoves(moves) {
  return moves.map((m) => {
    const f = (m / 3) | 0;
    const t = (m % 3) + 1;
    const cw = ON_POSITIVE_AXIS[f] ? -1 : 1;
    return { face: SOLVER_TO_PG_FACE[f], depth: 1, magnitude: t === 2 ? 2 : t === 1 ? cw : -cw };
  });
}
