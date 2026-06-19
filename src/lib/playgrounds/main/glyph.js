// The glyph (long-life symbol): baked once into quadratic-bezier segments. The
// glyph traces itself in during B3 (the dragon does NOT ride it). buildGlyph()
// returns an immutable handle the rest of the scene reads — the segments and the
// total playhead length (driven by the glyph block's trace tween).

import { longSymbol } from "$lib/brush/long.js";
import { bakeSegs } from "$lib/brush/bake.js";
import { GLYPH_SCALE } from "./config.js";

export function buildGlyph() {
  const sym = longSymbol();
  const baked = bakeSegs(sym, { connect: { enabled: true, thread: 0.18 }, timing: { speed: 1.0 } });
  // scale glyph geometry about origin (timing/pressure fields unchanged)
  for (const s of baked.segs) {
    s.p1.x *= GLYPH_SCALE; s.p1.y *= GLYPH_SCALE;
    s.p2.x *= GLYPH_SCALE; s.p2.y *= GLYPH_SCALE;
    s.ctrl.x *= GLYPH_SCALE; s.ctrl.y *= GLYPH_SCALE;
  }
  return { segs: baked.segs, total: baked.total || 1 };
}
