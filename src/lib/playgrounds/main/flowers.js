// Sumi-e ink flowers at centres of circles the 2D dragon's path built from
// (descent chain + roam2 rosette). dragon rides circle rims -> flower "entered"
// when head reaches its circle's arc; then opens bud->bloom over FLOWER_BLOOM_DUR.
//
// scrub-safe: tEnter (earliest scene time head reaches each circle) precomputed
// once; per-frame bloom = pure fn of t, smooth((t - tEnter) / dur) -> scrubbing
// replays exactly, no integration/history.

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
  const t1 = timing.loop3Start; // 2D head stops advancing at loop3Start (parks at a=1)

  // precompute tEnter per circle: earliest sample time head within r*(1+band) of
  // centre (on or inside rim). one forward sweep; each circle records first hit.
  // circles head never reaches dropped (no flower).
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
        // independent hash for size so size jitter not correlated with petals/twist
        const sizeRand = hashSeed(c.i * 7 + 13);
        const jitter = SIZE_MIN + (SIZE_MAX - SIZE_MIN) * sizeRand;
        items.push({
          x: c.x, y: c.y,
          r: c.r * FLOWER_FILL * jitter,
          tEnter: t,
          seed,
          opacity: 1, // set below from absolute size
          bloom: 0,
        });
      }
    }
  }
  // opacity by absolute size: small flowers solid, big translucent. normalize r
  // across all flowers, then map [smallest..biggest] -> [OPA_MAX..OPA_MIN].
  let rMin = Infinity, rMax = -Infinity;
  for (const f of items) { if (f.r < rMin) rMin = f.r; if (f.r > rMax) rMax = f.r; }
  const rSpan = Math.max(rMax - rMin, 1e-6);
  for (const f of items) {
    const sizeT = (f.r - rMin) / rSpan;        // 0 small .. 1 big
    f.opacity = OPA_MAX + (OPA_MIN - OPA_MAX) * sizeT;
  }

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
