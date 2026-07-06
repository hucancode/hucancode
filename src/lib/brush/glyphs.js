// Shared glyph-data loader. Glyph modules (yong/long/fu) are pure data wired
// through makeGlyph(data) -> { symbol(), maxId() }.

// highest stroke/point id in a symbol; used to bump the uid floor past stored ids.
export function maxSymbolId(symbol) {
  let m = 0;
  for (const s of symbol?.strokes || []) {
    if (s.id > m) m = s.id;
    for (const p of s.points || []) if (p.id > m) m = p.id;
  }
  return m;
}

export function makeGlyph(symbol) {
  return {
    symbol: () => JSON.parse(JSON.stringify(symbol)), // deep clone; callers mutate freely
    maxId: () => maxSymbolId(symbol),
  };
}
