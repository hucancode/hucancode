// SHAPE COLORING — one palette, one hash. Every primitive instance is its own
// draw item with a seeded random color, so a given seed reproduces the same
// coloring across kits and rigs; bump the seed to reshuffle.

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// curated mech palette
export const PALETTE = [
  "#c0392b", "#e67e22", "#f1c40f", "#7dcb2f", "#27ae60", "#1abc9c",
  "#3498db", "#2c5aa0", "#8e44ad", "#d354a4", "#c8a165", "#8d6e63",
  "#95a5a6", "#5d6d7e", "#e8e4d8", "#37474f",
].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));

// color = palette[f(shape id, seed)]: identical primitives with the same
// parameters get the SAME color (like lego pieces); bumping the seed remaps
// shapes to other palette entries but keeps the identity property.
export function colorOf(id, seed = 1) {
  const h = (hashStr(id || "anon") ^ Math.imul(seed, 0x9e3779b1)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// memoized colorOf for the rigs, which re-color the same shape ids every frame
export function colorMemo(seed) {
  const cache = new Map();
  return (id) => {
    let c = cache.get(id);
    if (!c) cache.set(id, (c = colorOf(id, seed)));
    return c;
  };
}
