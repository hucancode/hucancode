// The glyph (long-life symbol): baked once into quadratic-bezier segments the
// 2D dragon head traces. buildGlyph() returns an immutable handle the rest of the
// scene reads — segments, total playhead, the trace-exit playhead, a pen sampler,
// and the entry/exit poses.

import { longSymbol } from "$lib/brush/long.js";
import { bakeSegs } from "$lib/brush/bake.js";
import { clamp } from "$lib/math/scalar.js";
import { GLYPH_SCALE, GLYPH_EXIT_SEG } from "./config.js";

// Where the brush tip is at playhead `ph` (0..total), plus its heading. Segments
// are quadratic beziers with a [t0, t0+dur] window in playhead time.
function strokeAt(segs, total, ph) {
  const n = segs.length;
  if (n === 0) return { x: 0, y: 0, dir: { x: 0, y: 1 } };
  ph = clamp(ph, 0, total);
  let s = segs[n - 1];
  for (let i = 0; i < n; i++) {
    const g = segs[i];
    if (ph < g.t0 + g.dur) { s = g; break; }
  }
  const u = clamp((ph - s.t0) / (s.dur || 1e-6), 0, 1);
  const p1 = s.p1, c = s.ctrl, p2 = s.p2;
  const v = 1 - u, b0 = v * v, b1 = 2 * v * u, b2 = u * u;
  const x = b0 * p1.x + b1 * c.x + b2 * p2.x;
  const y = b0 * p1.y + b1 * c.y + b2 * p2.y;
  // B'(u) = 2(1-u)(c-p1) + 2u(p2-c)
  let dx = 2 * v * (c.x - p1.x) + 2 * u * (p2.x - c.x);
  let dy = 2 * v * (c.y - p1.y) + 2 * u * (p2.y - c.y);
  const m = Math.hypot(dx, dy) || 1;
  return { x, y, dir: { x: dx / m, y: dy / m } };
}

export function buildGlyph() {
  const sym = longSymbol();
  const baked = bakeSegs(sym, { connect: { enabled: true, thread: 0.18 }, timing: { speed: 1.0 } });
  // scale glyph geometry about origin (timing/pressure fields unchanged)
  for (const s of baked.segs) {
    s.p1.x *= GLYPH_SCALE; s.p1.y *= GLYPH_SCALE;
    s.p2.x *= GLYPH_SCALE; s.p2.y *= GLYPH_SCALE;
    s.ctrl.x *= GLYPH_SCALE; s.ctrl.y *= GLYPH_SCALE;
  }
  const segs = baked.segs;
  const total = baked.total || 1;

  // resolve the glyph-trace exit playhead from the configured segment index:
  // the head peels onto the enso at the END of that baked segment.
  const lastSeg = segs.length - 1;
  const exitSeg = GLYPH_EXIT_SEG == null ? lastSeg : clamp(Math.round(GLYPH_EXIT_SEG), 0, lastSeg);
  const es = segs[exitSeg];
  const exitPh = es ? Math.min(es.t0 + es.dur, total) : total;

  const at = (ph) => strokeAt(segs, total, ph);
  return { segs, total, exitPh, at, entry: at(0), end: at(exitPh) };
}
