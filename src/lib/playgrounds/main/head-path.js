// The 2D ink-dragon head LEADS through a sequence of PHASES (it is the leading
// edge of the ink / reveal). Each phase is self-contained:
//   end        absolute scene time the phase ends. Infinity = runs out.
//   continuous entering from the previous phase is positionally smooth, so the
//              verlet body chain keeps running (no reseed). false phases don't
//              share an arc parameter, so the body is refit on entry.
//   path(t)    head sampler { fn, a }: fn(a) is the head point, a the arc/frac
//              parameter (tipAt/reseedBody sample fn around a).
//
// createHeadPath wires the phases to the (already built) glyph / paths / schedule
// and returns the global samplers (posAt/tipAt/phaseOf) that cross phase seams.

import { clamp, lerp } from "$lib/math/scalar.js";
import { LEADIN_DUR, GLYPH_TRACE_DUR, ENSO_LEADIN_DUR, ENSO_DUR, SP2, LEADIN_START } from "./config.js";
import { ensoPos, leadInPos } from "./frame-path.js";

export function createHeadPath({ timing, glyph, ensoLeadIn, curvePath }) {
  const { dragonStart, glyphStart, glyphEnd, ensoStart, ensoEnd, branch } = timing;

  const curveHead = (a) => { const p = curvePath.pos(a); return { x: p.x, y: p.y }; };
  const leadInHead = (a) => leadInPos(a, LEADIN_START, glyph.entry);
  const glyphHead = (a) => { const p = glyph.at(a); return { x: p.x, y: p.y }; };
  const ensoBranchHead = (a) => { const p = ensoLeadIn.pos(a); return { x: p.x, y: p.y }; };

  const PHASES = [
    { name: "leadin", end: glyphStart, continuous: false,
      path: (t) => ({ fn: leadInHead, a: clamp((t - dragonStart) / LEADIN_DUR, 0, 1) }) },
    { name: "glyph", end: glyphEnd, continuous: false,
      path: (t) => ({ fn: glyphHead, a: clamp((t - glyphStart) / GLYPH_TRACE_DUR, 0, 1) * glyph.exitPh }) },
    { name: "ensoBranch", end: ensoStart, continuous: false,
      path: (t) => ({ fn: ensoBranchHead, a: lerp(ensoLeadIn.headStart, ensoLeadIn.endArc, clamp((t - glyphEnd) / ENSO_LEADIN_DUR, 0, 1)) }) },
    // continuous: the ensoBranch exit == ensoPos(0) with matched tangent, so the
    // verlet body keeps trailing onto the circle (no reseed = no body snap/jump).
    { name: "enso", end: ensoEnd, continuous: true,
      path: (t) => ({ fn: ensoPos, a: clamp((t - ensoStart) / ENSO_DUR, 0, 1) }) },
    { name: "roam", end: branch, continuous: true,
      path: (t) => ({ fn: curveHead, a: curvePath.headStart + Math.max(0, t - ensoEnd) * SP2 }) },
    { name: "loop3", end: Infinity, continuous: true,
      path: () => ({ fn: curveHead, a: curvePath.total }) },
  ];

  // Index of the phase scene-time t is in (refit the body when a boundary is crossed).
  function phaseOf(t) {
    for (let i = 0; i < PHASES.length; i++) if (t < PHASES[i].end) return i;
    return PHASES.length - 1;
  }
  const pathAt = (t) => PHASES[phaseOf(t)].path(t);

  // Head position at scene time t (global sampler -> crosses phase seams). Every
  // phase is positionally continuous with the previous, so walking this over t
  // gives ONE continuous motion line through every transition.
  function posAt(t) {
    const { fn, a } = pathAt(t);
    return fn(a);
  }
  function tipAt(t) {
    const { fn, a } = pathAt(t);
    const p = fn(a), p2 = fn(a + 1e-3);
    let dx = p2.x - p.x, dy = p2.y - p.y;
    const m = Math.hypot(dx, dy) || 1;
    return { x: p.x, y: p.y, dir: { x: dx / m, y: dy / m } };
  }

  // debug: the FULL 2D head motion line across every phase, sampled in scene-time
  // so the phase TRANSITIONS show up and their smoothness can be eyeballed.
  function samplePath2d(n = 600) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const tt = lerp(dragonStart, branch, i / n);
      const p = posAt(tt);
      out.push({ x: p.x, y: p.y, z: 0 });
    }
    return out;
  }

  return { PHASES, phaseOf, posAt, tipAt, samplePath2d };
}
