// The 3D dragon: frame buffers built on the SAME 2D path (z=0 tail) then loop3, so
// the mesh overlaps the ink dragon through the crossfade, then flies the orbit
// forever. createDragon3d owns the two frame buffers and writes the per-frame draw
// params (which buffer + head offset) into _frame.dragon3d.

import { clamp } from "$lib/math/scalar.js";
import { D3, BODY_LEN, SP3 } from "./config.js";

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
  let frames = null;     // transition buffer (curvePath roam2 window + loop3), N*16
  let pathLen = 1;
  let framesLoop = null; // pure loop3 ring (wraps cleanly forever), N*16
  let loopLen = 1;
  let transArc = 0;      // curvePath window length baked into the transition buffer
  let _hs = 0, _branchArc = 0, _transStart = 0, _bodyArc = 0;

  // Build BOTH 3D frame buffers (arc-uniform; the shader maps mesh.x linearly to
  // frame index, so equal-arc frames keep the dragon a constant length):
  //   - transition buffer: the roam2 window [transStart, branchArc) of curvePath
  //     (the exact arc the 2D dragon rides during the crossfade) then loop3.
  //   - loop buffer: pure loop3 closed ring; wraps mod-N cleanly forever after.
  // The join at the branch point is tangent-continuous (loop3 leaves it along the
  // curvePath exit). curvePath.headStart / headEnd mark the roam2 head's arc range.
  function build(loop3, curvePath) {
    if (!loop3 || !curvePath) return;
    const N = D3.N;
    _bodyArc = BODY_LEN * D3.bodyFactor;
    _hs = curvePath.headStart || 0;
    _branchArc = curvePath.headEnd ?? curvePath.total; // 2D roam2 end == 3D loop start
    _transStart = Math.max(0, _hs);                    // cover the whole ridden window
    transArc = _branchArc - _transStart;

    const total = transArc + loop3.total;
    const trans = new Float32Array(N * 16);
    fillFrames(trans, N, total, (arc) => {
      if (arc < transArc) {
        const cpArc = _transStart + arc;
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

  // The 3D head's curvePath arc as a function of t. Through the crossfade it follows
  // the EXACT same arc-vs-time law as the 2D roam2 head (constant SP3 from _hs at
  // ensoExit to _branchArc at loop3Start), so the two dragons share position. After
  // loop3Start it continues into loop3 at SP3 with no speed jump (same SP3).
  function headArcAt(t) {
    const roamDur = timing.loop3Start - timing.ensoExit;
    if (t <= timing.loop3Start) {
      const frac = clamp((t - timing.ensoExit) / roamDur, 0, 1);
      return _hs + frac * (_branchArc - _hs);
    }
    return _branchArc + (t - timing.loop3Start) * SP3;
  }

  // Write the per-frame draw params into `d` (= _frame.dragon3d; no alloc). Picks
  // the buffer (transition window vs pure loop3 ring) + head offset; the shader
  // wraps mod-N over the whole buffer.
  function writeState(d, t, viewProj) {
    const bodyArc = _bodyArc;
    const headArc = headArcAt(t);
    const tailInWindow = headArc - bodyArc < _branchArc; // body still on curvePath
    if (!framesLoop || tailInWindow) {
      d.frames = frames; d.pathLen = pathLen;
      d.headOffset = headArc - _transStart - bodyArc;
    } else {
      const loopHead = headArc - _branchArc; // arc into loop3
      d.frames = framesLoop; d.pathLen = loopLen;
      d.headOffset = loopHead - bodyArc;
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
