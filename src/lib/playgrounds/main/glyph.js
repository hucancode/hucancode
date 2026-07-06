import { long } from "$lib/brush/long.js";
import { bakeSegs } from "$lib/brush/bake.js";
import { GLYPH_SCALE } from "./config.js";

export function buildGlyph() {
  const baked = bakeSegs(long.symbol());
  for (const s of baked.segs) {
    s.p1.x *= GLYPH_SCALE; s.p1.y *= GLYPH_SCALE;
    s.p2.x *= GLYPH_SCALE; s.p2.y *= GLYPH_SCALE;
    s.ctrl.x *= GLYPH_SCALE; s.ctrl.y *= GLYPH_SCALE;
  }
  return { segs: baked.segs, total: baked.total || 1 };
}
