// Fixed localStorage save slots shared by playground pages: slot i is one
// key `${prefix}${i}` holding { [field]: payload, at: ISO timestamp }.
// `revive` validates/migrates a stored payload on read; return null/undefined
// to treat the slot as empty (corrupt or legacy data). SSR-safe: every call
// no-ops to "empty" when localStorage is unavailable.
export function makeSlots({ prefix, count, field = "data", revive = (p) => p }) {
  const key = (i) => `${prefix}${i}`;
  const ok = () => typeof localStorage !== "undefined";

  // -> { payload, at } or null when empty/corrupt
  function read(i) {
    if (!ok()) return null;
    try {
      const e = JSON.parse(localStorage.getItem(key(i)));
      const payload = e ? revive(e[field]) : null;
      if (payload != null) return { payload, at: e.at ?? null };
    } catch { /* corrupt slot -> empty */ }
    return null;
  }

  // per-slot { filled, at } for slot pickers
  const meta = () =>
    Array.from({ length: count }, (_, i) => {
      const e = read(i);
      return { filled: !!e, at: e?.at ?? null };
    });

  function save(i, payload) {
    if (ok()) {
      try {
        localStorage.setItem(key(i), JSON.stringify({ [field]: payload, at: new Date().toISOString() }));
      } catch { /* quota/private mode */ }
    }
    return meta();
  }

  function clear(i) {
    if (ok()) localStorage.removeItem(key(i));
    return meta();
  }

  return { read, meta, save, clear };
}

export const slotLabel = (at) => (at ? new Date(at).toLocaleString() : "empty");
