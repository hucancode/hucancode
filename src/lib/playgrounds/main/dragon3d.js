// The 3D dragon: frame buffers built on the SAME 2D path (z=0 tail) then loop3, so
// the mesh overlaps the ink dragon through the crossfade, then flies the orbit
// forever. createDragon3d owns the two frame buffers and writes the per-frame draw
// params (which buffer + head offset) into _frame.dragon3d.

import { D3, BODY_LEN, CROSSFADE, SP3 } from "./config.js";

// Fill an N*16 column-major frame buffer by sampling `sample(arc)->{p,tg}` at N
// equal-arc-length steps over [0, total). Each frame is a 3D orthonormal basis
// from the tangent + world-up (cross(up,T) gives the stable in-plane width normal;
// fall back to +y only if the tangent runs near-vertical).
function fillFrames(frames, N, total, sample) {
  for (let i = 0; i < N; i++) {
    const { p, tg } = sample((i / N) * total);
    let ux = 0, uy = 0, uz = 1;
    if (Math.abs(tg.z) > 0.95) { ux = 0; uy = 1; uz = 0; }
    let nx = uy * tg.z - uz * tg.y;
    let ny = uz * tg.x - ux * tg.z;
    let nz = ux * tg.y - uy * tg.x;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const bx = tg.y * nz - tg.z * ny;
    const by = tg.z * nx - tg.x * nz;
    const bz = tg.x * ny - tg.y * nx;
    const o = i * 16;
    frames[o + 0] = tg.x; frames[o + 1] = tg.y; frames[o + 2] = tg.z; frames[o + 3] = 0;
    frames[o + 4] = nx;   frames[o + 5] = ny;   frames[o + 6] = nz;   frames[o + 7] = 0;
    frames[o + 8] = bx;   frames[o + 9] = by;   frames[o + 10] = bz;  frames[o + 11] = 0;
    frames[o + 12] = p.x; frames[o + 13] = p.y; frames[o + 14] = p.z; frames[o + 15] = 1;
  }
}

export function createDragon3d({ timing }) {
  let frames = null;     // transition buffer (curvePath tail + loop3), N*16
  let pathLen = 1;
  let framesLoop = null; // pure loop3 ring (wraps cleanly forever), N*16
  let loopLen = 1;
  let transArc = 0;      // curvePath tail length baked into the transition buffer

  // Build BOTH 3D frame buffers (arc-uniform; the shader maps mesh.x linearly to
  // frame index, so equal-arc frames keep the dragon a constant length):
  //   - transition buffer: [0, transArc) = curvePath tail ending at bp, then loop3.
  //   - loop buffer: pure loop3 closed ring; wraps mod-N cleanly forever after.
  // The join at bp is tangent-continuous (loop3 leaves bp along the curvePath exit).
  function build(loop3, curvePath) {
    if (!loop3 || !curvePath) return;
    const N = D3.N;
    const bodyArc = BODY_LEN * D3.bodyFactor;
    transArc = bodyArc + CROSSFADE * SP3; // curvePath tail length in the trans buffer

    const total = transArc + loop3.total;
    const trans = new Float32Array(N * 16);
    fillFrames(trans, N, total, (arc) => {
      if (arc < transArc) {
        const cpArc = curvePath.total - transArc + arc;
        return { p: curvePath.pos(cpArc), tg: curvePath.tan(cpArc) };
      }
      return { p: loop3.pos(arc - transArc), tg: loop3.tan(arc - transArc) };
    });
    frames = trans;
    pathLen = total;

    const loop = new Float32Array(N * 16);
    fillFrames(loop, N, loop3.total, (arc) => ({ p: loop3.pos(arc), tg: loop3.tan(arc) }));
    framesLoop = loop;
    loopLen = loop3.total;
  }

  // Write the per-frame draw params into `d` (= _frame.dragon3d; no alloc). Picks
  // the buffer (transition vs pure loop3 ring) + head offset; the shader wraps
  // mod-N over the whole buffer.
  //   - transition buffer while the body still trails off the flat circles;
  //   - pure loop3 ring once the tail has left the circles (wraps forever).
  function writeState(d, t, viewProj) {
    const bodyArc = BODY_LEN * D3.bodyFactor;
    const elapsed = Math.max(0, t - timing.d3Start) * SP3;
    if (!framesLoop || elapsed < transArc) {
      d.frames = frames; d.pathLen = pathLen; d.headOffset = elapsed;
    } else {
      const loopArc = bodyArc + (elapsed - transArc);
      d.frames = framesLoop; d.pathLen = loopLen; d.headOffset = loopArc - bodyArc;
    }
    d.frameCount = D3.N;
    d.bodyLen = bodyArc; // mesh head is at x=1 (leads by bodyLen); headOffset accounts for it
    d.viewProj = viewProj;
    d.time = t;
  }

  // debug: 3D path centreline (frame translations) as xyz triples
  function samplePath3d(stride = 4) {
    if (!frames) return new Float32Array(0);
    const out = [];
    for (let i = 0; i < D3.N; i += stride) {
      out.push(frames[i * 16 + 12], frames[i * 16 + 13], frames[i * 16 + 14]);
    }
    return new Float32Array(out);
  }

  return { build, writeState, samplePath3d };
}
