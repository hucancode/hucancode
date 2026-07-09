import { clamp } from "$lib/math/scalar.js";
import { D3, BODY_LEN, SP3, D3_STYLE, D3_MECH_SCALE } from "./config.js";
import { createDragonRig } from "$lib/mech/dragon/rig.js";
import { assembleModel } from "$lib/mech/assembly.js";
import { PALETTE as MECH_PALETTE } from "$lib/mech/color.js";

// Site palette (app.css custom properties) for the mech dragon on this page —
// the /mech playground keeps its own curated palette. Index-aligned with
// MECH_PALETTE so the lego identity property (same shape -> same color)
// carries over; remap is by palette-entry reference (colorOf returns shared
// arrays). Light set reads on paper #f2ecbc, dark set on paper #16161d.
const SITE_LIGHT = [
  "#1e2736", "#95bbfa", "#b5d0fc", "#7aa1e0", "#6585b9", "#536d97",
  "#445a7d", "#314059", "#624c83", "#9399b2", "#7f849c", "#6c7086",
  "#585b70", "#45475a", "#d6dcf5", "#16161d",
].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
const SITE_DARK = [
  "#f8f9ff", "#adb6f4", "#c4ccfe", "#949dd2", "#7b81ad", "#646a8e",
  "#d7dcfe", "#e8ebff", "#7e9cd8", "#a6adc8", "#9399b2", "#7f849c",
  "#6c7086", "#585b70", "#d7e0fe", "#dcd7ba",
].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
const SITE_LIGHT_MAP = new Map(MECH_PALETTE.map((c, i) => [c, SITE_LIGHT[i % SITE_LIGHT.length]]));
const SITE_DARK_MAP = new Map(MECH_PALETTE.map((c, i) => [c, SITE_DARK[i % SITE_DARK.length]]));
const _darkMQ = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const siteColor = (c) => (_darkMQ?.matches ? SITE_DARK_MAP : SITE_LIGHT_MAP).get(c) || c;

// Fill N*16 column-major frame buffer by sampling sample(arc)->{p,tg} at N
// equal-arc-length steps over [0, total). Each frame = 3D orthonormal basis from
// tangent + world-up. cross(up,T) gives stable in-plane width normal; tangent
// near-vertical -> fall back +y.
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

// ---- mech rig adapter ------------------------------------------------------
// main world is z-up, the mech rig is y-up. Proper rotation R = rotX(-90deg):
// rig (x,y,z) = main (x, z, -y); inverse: main = rig (x, -z, y). The path is
// also scaled by k so the rig-space dragon (rig.pitch long) spans exactly
// bodyArc of the main-world curve; instance transforms are scaled back by 1/k.
function rigPath(sample, totalMain, k) {
  const total = totalMain * k;
  const posAt = (s) => {
    const p = sample(s / k);
    return [p.x * k, p.z * k, -p.y * k];
  };
  const eps = total / 2000;
  const tangentAt = (s) => {
    const a = posAt(s - eps), b = posAt(s + eps);
    const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  return { total, posAt, tangentAt };
}

export function createDragon3d({ timing }) {
  const rig = D3_STYLE === "mech" ? createDragonRig(1) : null; // compiled once, posed per frame
  let frames = null;     // transition buffer (curvePath roam2 window + loop3), N*16 (obj style only)
  let pathLen = 1;
  let framesLoop = null; // pure loop3 ring (wraps mod-N forever), N*16 (obj style only)
  let loopLen = 1;
  let transArc = 0;      // curvePath window length baked into transition buffer
  let _hs = 0, _branchArc = 0, _transStart = 0, _bodyArc = 0;
  let _connLen = 0;      // connector spur arc length (branch point -> ring entry)
  let _loopIn = 0;       // headArc where the pure ring begins
  let _k = 1;            // rig units per main-world unit
  let _mechLen = 1;      // mech dragon spine length in main-world units
  let _pathTrans = null; // rig-space ride paths for the mech dragon
  let _pathLoop = null;
  let _asmRefAt = null;  // memoized build-progress -> frozen dragon pose (world anchors)
  let _closePt = null;   // loop3 start (= branch point), closes the debug polyline
  let _composite = null; // (arc) -> {p, tg} over the full ride (debug + obj frames)
  let _totalArc = 0;

  // Wire the ride paths. The OBJ style additionally bakes both 3D frame
  // buffers (arc-uniform; shader maps mesh.x linearly to frame index, so
  // equal-arc frames keep the dragon constant length):
  //   - transition buffer: roam2 window [transStart, branchArc) of curvePath
  //     (exact arc 2D dragon rides during crossfade), then the CONNECTOR spur,
  //     then loop3.
  //   - loop buffer: pure loop3 closed ring; wraps mod-N forever after.
  // The mech style skips the buffers entirely — the rig rides the curves live.
  function build(loop3, curvePath, conn) {
    if (!loop3 || !curvePath) return;
    const N = D3.N;
    _bodyArc = BODY_LEN * D3.bodyFactor;
    _hs = curvePath.headStart || 0;
    _branchArc = curvePath.headEnd ?? curvePath.total; // 2D roam2 end == connector start
    _transStart = Math.max(0, _hs);                    // cover whole ridden window
    transArc = _branchArc - _transStart;
    _connLen = conn?.total ?? 0;
    _loopIn = _branchArc + _connLen;                   // headArc where the ring begins

    _totalArc = transArc + _connLen + loop3.total;
    _composite = (arc) => {
      if (arc < transArc) {
        const cpArc = _transStart + arc;
        return { p: curvePath.pos(cpArc), tg: curvePath.tan(cpArc) };
      }
      if (arc < transArc + _connLen) {
        const ca = arc - transArc;
        return { p: conn.pos(ca), tg: conn.tan(ca) };
      }
      const la = arc - transArc - _connLen;
      return { p: loop3.pos(la), tg: loop3.tan(la) };
    };
    loopLen = loop3.total;

    if (D3_STYLE === "obj") {
      const trans = new Float32Array(N * 16);
      fillFrames(trans, N, _totalArc, _composite);
      frames = trans;
      pathLen = _totalArc;
      const loop = new Float32Array(N * 16);
      fillFrames(loop, N, loop3.total, (arc) => ({ p: loop3.pos(arc), tg: loop3.tan(arc) }));
      framesLoop = loop;
    }

    _closePt = loop3.pos(0);

    if (!rig) return;
    // mech rig ride paths (same two windows as the composite above)
    _mechLen = _bodyArc * D3_MECH_SCALE;
    _k = rig.pitch / _mechLen;
    _pathTrans = rigPath((arc) => {
      if (arc < 0) {   // tail behind the ridden window: extrapolate straight back
        const p = curvePath.pos(_transStart), tg = curvePath.tan(_transStart);
        return { x: p.x + tg.x * arc, y: p.y + tg.y * arc, z: (p.z || 0) + (tg.z || 0) * arc };
      }
      if (arc < transArc) return curvePath.pos(_transStart + arc);
      if (arc < transArc + _connLen) return conn.pos(arc - transArc);
      const u = (arc - transArc - _connLen) % loop3.total;
      return loop3.pos(u);
    }, transArc + _connLen + loop3.total, _k);
    _pathLoop = rigPath(
      (arc) => loop3.pos(((arc % loop3.total) + loop3.total) % loop3.total),
      loop3.total, _k,
    );
    _asmRefAt = null;                                 // paths changed -> re-freeze
  }

  // ride path + rig-space head arc for a given headArc along the flight
  function rideAt(headArc) {
    if (headArc - _mechLen < _loopIn)
      return { path: _pathTrans, s: (headArc - _transStart) * _k };
    return { path: _pathLoop, s: ((((headArc - _loopIn) % loopLen) + loopLen) % loopLen) * _k };
  }

  // 3D head's curvePath arc as fn of t. Through crossfade follows EXACT same
  // arc-vs-time law as 2D roam2 head (constant SP3 from _hs at ensoExit to
  // _branchArc at loop3Start) -> two dragons share position. After loop3Start
  // continues into loop3 at SP3, no speed jump (same SP3).
  function headArcAt(t) {
    const roamDur = timing.loop3Start - timing.ensoExit;
    if (t <= timing.loop3Start) {
      const frac = clamp((t - timing.ensoExit) / roamDur, 0, 1);
      return _hs + frac * (_branchArc - _hs);
    }
    return _branchArc + (t - timing.loop3Start) * SP3;
  }

  function writeState(d, t, viewProj, alpha = 1) {
    if (D3_STYLE === "mech") return writeStateMech(d, t, viewProj, alpha);
    const bodyArc = _bodyArc;
    const headArc = headArcAt(t);
    const tailInWindow = headArc - bodyArc < _loopIn;  // body not fully on the ring yet
    if (!framesLoop || tailInWindow) {
      d.frames = frames; d.pathLen = pathLen;
      d.headOffset = headArc - _transStart - bodyArc;
    } else {
      const loopHead = headArc - _loopIn; // arc into loop3
      d.frames = framesLoop; d.pathLen = loopLen;
      d.headOffset = loopHead - bodyArc;
    }
    d.frameCount = D3.N;
    d.bodyLen = bodyArc; // mesh head at x=1 (leads by bodyLen); headOffset accounts for it
    d.viewProj = viewProj;
    d.time = t;
  }

  // mech dragon: run the rig on the ride path and emit instance items
  // ({ key, m, t, color } over shared unit meshes) in main-world coordinates.
  function writeStateMech(d, t, viewProj, alpha) {
    d.viewProj = viewProj;
    d.time = t;
    if (!(alpha > 0) || !_pathLoop) { d.items = null; d.meshes = null; return; }
    const headArc = headArcAt(t);
    const { path, s: sHead } = rideAt(headArc);
    // swim stroke phase rides the same clock as the flight (strokes per lap)
    const model = rig.model({ offset: sHead / path.total, swim: headArc / loopLen }, path);
    const ik = 1 / _k;
    // assembly intro: the rig's 4-phase build (rig space) spans the crossfade
    // window; past it, items pass through untouched. Groups assemble in WORLD
    // space anchored on the pose where the body was when they started
    // forming; once formed each group HOMES on its moving mount point
    // (missile-style, phase 3) and captures onto the live seat along its
    // mount normal — the ref sampler below feeds the chase its targets.
    const u = (t - timing.d3Start) / Math.max(1e-6, timing.d3End - timing.d3Start);
    let src = model.items;
    if (u < 1) {
      if (!_asmRefAt) {
        const cache = new Map();                      // uStart values are per-group consts
        _asmRefAt = (uu) => {
          const key = Math.round(uu * 1e6);
          if (!cache.has(key)) {
            const ts = timing.d3Start + uu * (timing.d3End - timing.d3Start);
            const arc = headArcAt(ts);
            const r = rideAt(arc);
            cache.set(key, rig.model({ offset: r.s / r.path.total, swim: arc / loopLen }, r.path).items);
          }
          return cache.get(key);
        };
      }
      src = assembleModel(model.items, u, _asmRefAt);
    }
    d.items = src.map((it) => ({
      key: it.key,
      // rig -> main: rows permute to (x, -z, y), scaled back by 1/k
      m: [
        it.m[0] * ik, it.m[1] * ik, it.m[2] * ik,
        -it.m[6] * ik, -it.m[7] * ik, -it.m[8] * ik,
        it.m[3] * ik, it.m[4] * ik, it.m[5] * ik,
      ],
      t: [it.t[0] * ik, -it.t[2] * ik, it.t[1] * ik],
      color: siteColor(it.color),
      a: it.a ?? 1,
    }));
    d.meshes = model.meshes;
  }

  // debug: 3D ride-path centreline as xyz triples, sampled on demand from the
  // composite curve (debug-only cost). Ends back at the loop3 start (branch
  // point) — append it so the drawn line-strip closes instead of leaving a
  // one-connection gap.
  function samplePath3d(stride = 4) {
    if (!_composite) return new Float32Array(0);
    const n = Math.ceil(D3.N / stride);
    const out = [];
    for (let i = 0; i < n; i++) {
      const { p } = _composite((i / n) * _totalArc);
      out.push(p.x, p.y, p.z || 0);
    }
    if (_closePt) out.push(_closePt.x, _closePt.y, _closePt.z || 0);
    return new Float32Array(out);
  }

  return { build, writeState, samplePath3d };
}
