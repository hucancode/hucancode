// Hand-written glue for the poker-solver wasm (plain extern "C" ABI, no wasm-bindgen).
// Strings cross as (ptr, len) utf-8; results come back in flat buffers:
//   solve       -> 3 x u32 [win, lose, tie]
//   solve_multi -> (4 + villains) x f64 [iterations, win, tie, lose, equity...]
import wasmUrl from "./poker_solver.wasm?url";

let ex = null;
const enc = new TextEncoder();
const dec = new TextDecoder();

export async function init() {
  if (ex) return;
  const { instance } = await WebAssembly.instantiateStreaming(
    fetch(wasmUrl),
    {},
  );
  ex = instance.exports;
}

function writeStr(s) {
  const bytes = enc.encode(s);
  const ptr = bytes.length ? ex.alloc(bytes.length) : 0;
  if (bytes.length) new Uint8Array(ex.memory.buffer).set(bytes, ptr);
  return [ptr, bytes.length];
}

function lastError() {
  const ptr = ex.last_error_ptr();
  const len = ex.last_error_len();
  return dec.decode(new Uint8Array(ex.memory.buffer, ptr, len));
}

export function solve(handA, handB, community) {
  const [ap, al] = writeStr(handA);
  const [bp, bl] = writeStr(handB);
  const [cp, cl] = writeStr(community);
  const out = ex.alloc(12);
  try {
    if (ex.solve(ap, al, bp, bl, cp, cl, out) < 0) {
      throw new Error(lastError());
    }
    const [win, lose, tie] = new Uint32Array(ex.memory.buffer, out, 3);
    return { win, lose, tie };
  } finally {
    ex.dealloc(ap, al);
    ex.dealloc(bp, bl);
    ex.dealloc(cp, cl);
    ex.dealloc(out, 12);
  }
}

export function solveMulti(hero, villains, community, maxIterations, seed) {
  const [hp, hl] = writeStr(hero);
  const [vp, vl] = writeStr(villains.join("\n"));
  const [cp, cl] = writeStr(community);
  const n = villains.length;
  const bytes = (4 + n) * 8;
  const out = ex.alloc(bytes);
  try {
    const code = ex.solve_multi(
      hp,
      hl,
      vp,
      vl,
      cp,
      cl,
      maxIterations,
      seed,
      out,
    );
    if (code < 0) throw new Error(lastError());
    const f = new Float64Array(ex.memory.buffer, out, 4 + n);
    return {
      iterations: f[0],
      heroWin: f[1],
      heroTie: f[2],
      heroLose: f[3],
      villainEquity: Array.from(f.subarray(4)),
    };
  } finally {
    ex.dealloc(hp, hl);
    ex.dealloc(vp, vl);
    ex.dealloc(cp, cl);
    ex.dealloc(out, bytes);
  }
}
