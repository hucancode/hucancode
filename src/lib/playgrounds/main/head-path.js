// Head leads through corridor phases; speed continuous across every seam via
// cubic-eased progress with prescribed endpoint speeds (world units/sec):
//   flyin   : 0          -> descentStart   (accel from rest)
//   descent : descentStart -> CRUISE_SP    (cubic; start chosen so curve length fits)
//   enso    : CRUISE_SP   -> SP3           (decel; ensoHeadProgress)
//   roam2   : SP3 (constant; == 3D loop speed)

import { clamp, lerp } from "$lib/math/scalar.js";
import { hermiteG } from "$lib/math/curve.js";
import { BLOCK_DUR, ENSO_REVS, CRUISE_SP } from "./config.js";
import { ensoPos, ensoHeadProgress } from "./frame-path.js";

export function createHeadPath({ timing, paths }) {
  const { flyinStart, roam1Start, ensoStart, ensoExit, loop3Start } = timing;
  const { flyin, descent, roam2, ensoCenter } = paths;
  const descentCurve = descent.curve;

  // arc length head rides on each curve (skip body lead-in / tangent-guide tails
  // via headStart/headEnd)
  const arcOf = (c) => (c.headEnd ?? c.total) - (c.headStart || 0);

  // descent: choose START speed so cubic (start -> CRUISE_SP) covers whole curve
  // length over its duration. avg = L/dur; start = 2*avg - end keeps integral
  // exact for cubic whose endpoint slopes average to 1.
  const descentDur = ensoStart - roam1Start;
  const descentAvg = arcOf(descentCurve) / descentDur;
  const descentStart = Math.max(0, 2 * descentAvg - CRUISE_SP);

  // sample curve by cubic-eased progress with prescribed endpoint speeds
  const cruise = (curve, t, t0, dur, s0, s1) => {
    const hs = curve.headStart || 0, he = curve.headEnd ?? curve.total, L = (he - hs) || 1e-6;
    const x = clamp((t - t0) / dur, 0, 1);
    const g = clamp(hermiteG(x, (s0 * dur) / L, (s1 * dur) / L), 0, 1);
    return curve.pos(hs + g * L);
  };
  const frac = (t, t0, dur) => clamp((t - t0) / dur, 0, 1);

  const flyinHead = (t) => cruise(flyin, t, flyinStart, BLOCK_DUR.flyin, 0, descentStart);
  const descentHead = (t) => cruise(descentCurve, t, roam1Start, descentDur, descentStart, CRUISE_SP);
  const ensoHead = (a) => ensoPos(ENSO_REVS * a, ensoCenter);
  const roam2Head = (a) => {
    const hs = roam2.curve.headStart || 0, he = roam2.curve.headEnd ?? roam2.curve.total;
    return roam2.curve.pos(hs + a * (he - hs));
  };
  const roam2Dur = loop3Start - ensoExit; // SP3 by construction (headEnd = hs + SP3*roam2Dur)

  // flyin/descent read t directly via cubic speed law; others map t to arc/frac.
  // descent ends at enso top with circle tangent + speed CRUISE_SP, so body
  // keeps trailing onto enso (which decelerates to SP3).
  const PHASES = [
    { end: roam1Start, pos: (t) => flyinHead(t) },                                          // flyin
    { end: ensoStart, pos: (t) => descentHead(t) },                                         // descent
    { end: ensoExit, pos: (t) => ensoHead(ensoHeadProgress(frac(t, ensoStart, BLOCK_DUR.enso))) }, // enso
    { end: loop3Start, pos: (t) => roam2Head(frac(t, ensoExit, roam2Dur)) },                // roam2
    { end: Infinity, pos: () => roam2Head(1) },                                             // loop3
  ];

  function phaseOf(t) {
    for (let i = 0; i < PHASES.length; i++) if (t < PHASES[i].end) return i;
    return PHASES.length - 1;
  }

  function posAt(t) {
    return PHASES[phaseOf(t)].pos(t);
  }
  function tipAt(t) {
    const p = posAt(t), p2 = posAt(t + 1e-3);
    let dx = p2.x - p.x, dy = p2.y - p.y;
    const m = Math.hypot(dx, dy) || 1;
    return { x: p.x, y: p.y, dir: { x: dx / m, y: dy / m } };
  }

  // debug: full 2D head motion line across every phase, world coords
  function samplePath2d(n = 200) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const tt = lerp(flyinStart, loop3Start, i / n);
      const p = posAt(tt);
      out.push({ x: p.x, y: p.y, z: 0 });
    }
    return out;
  }

  return { posAt, tipAt, samplePath2d };
}
