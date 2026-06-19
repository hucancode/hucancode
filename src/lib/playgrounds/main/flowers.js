// Sumi-e ink flowers seated at the CENTRES of the circles the 2D dragon's path is
// built from (the descent chain + the roam2 rosette). The dragon rides the circle
// RIMS, so a flower "is entered" the moment the head reaches its circle's arc; from
// then it opens from a tight bud to a full bloom over FLOWER_BLOOM_DUR.
//
// Scrub-safe by construction: the earliest scene time the head reaches each circle
// (tEnter) is precomputed ONCE by sampling the head path; per-frame bloom is then a
// pure function of t — smooth((t - tEnter) / dur) — so scrubbing/reversing the
// timeline replays the blooms exactly with no integration or history.
//
// writeState() fills a reused FrameState sub-object (no per-frame allocation): a
// flat list of { x, y, r, bloom, seed } the renderer draws as world-space quads.

import { clamp, smooth } from "$lib/math/scalar.js";
import {
  FLOWER_ENTER_BAND, FLOWER_BLOOM_DUR, FLOWER_SAMPLE_DT, FLOWER_FILL,
  FLOWER_SIZE_JITTER, FLOWER_OPACITY_JITTER,
} from "./config.js";

// integer hash -> deterministic per-flower seed in [0,1) (petal count / twist / hue)
function hashSeed(i) {
  let h = (i * 2654435761) >>> 0;
  h ^= h >>> 15; h = (h * 2246822519) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const [SIZE_MIN, SIZE_MAX] = FLOWER_SIZE_JITTER;
const [OPA_MIN, OPA_MAX] = FLOWER_OPACITY_JITTER;

export function createFlowers({ headPath, timing, circles }) {
  const t0 = timing.flyinStart;
  const t1 = timing.loop3Start; // the 2D head stops advancing at loop3Start (parks at a=1)

  // precompute tEnter per circle: earliest sample time the head is within
  // r*(1+band) of the centre (on or inside the rim). One forward sweep; each circle
  // records its first hit. Circles the head never reaches are dropped (no flower).
  const pending = circles
    .map((c, i) => ({ x: c.x, y: c.y, r: c.r || 0, i }))
    .filter((c) => c.r > 0);
  const items = [];
  const found = new Set();
  for (let t = t0; t <= t1 && found.size < pending.length; t += FLOWER_SAMPLE_DT) {
    const p = headPath.posAt(t);
    for (const c of pending) {
      if (found.has(c.i)) continue;
      const trig = c.r * (1 + FLOWER_ENTER_BAND);
      const dx = p.x - c.x, dy = p.y - c.y;
      if (dx * dx + dy * dy <= trig * trig) {
        found.add(c.i);
        const seed = hashSeed(c.i);
        // independent hash for size so size jitter isn't correlated with petals/twist
        const sizeRand = hashSeed(c.i * 7 + 13);
        const opaRand = hashSeed(c.i * 31 + 5);
        const jitter = SIZE_MIN + (SIZE_MAX - SIZE_MIN) * sizeRand;
        items.push({
          x: c.x, y: c.y,
          r: c.r * FLOWER_FILL * jitter,
          tEnter: t,
          seed,
          opacity: OPA_MIN + (OPA_MAX - OPA_MIN) * opaRand,
          bloom: 0,
        });
      }
    }
  }
  // bloom in path order (outer descent flowers first) so the renderer's draw order
  // reads naturally; items already pushed in first-hit (== time) order.

  // Reused output: { items, count }. bloom is refreshed in place each frame.
  const out = { items, count: items.length };

  function writeState(t) {
    for (let k = 0; k < items.length; k++) {
      const f = items[k];
      f.bloom = smooth(clamp((t - f.tEnter) / FLOWER_BLOOM_DUR, 0, 1));
    }
    return out;
  }

  return { items, writeState };
}
