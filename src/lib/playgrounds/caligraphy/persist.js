// localStorage layer: a scratch autosave (the live working copy) plus 5 fixed
// save slots holding explicit snapshots. Storage shape is frozen - keep the
// legacy `selection.selKind/selStrokeId/selIdx` field names on disk.
// SSR-safe: every call no-ops when localStorage is unavailable.
import { setUidFloor } from "$lib/brush/engine";
import { maxSymbolId } from "$lib/brush/glyphs";
import { makeSlots } from "$lib/save-slots.js";

const LS_KEY = "brush:state:v1";
const SLOT_PREFIX = "brush:slot:";
export const SLOT_COUNT = 5;

const ok = () => typeof localStorage !== "undefined";

// snapshot all editable state into a plain serializable object.
export const snapshot = (doc) => ({
  symbol: doc.symbol,
  params: {
    baseRadius: doc.baseRadius,
    showHandles: doc.showHandles,
    showGrid: doc.showGrid,
  },
  connect: { enabled: doc.connect.enabled, thread: doc.connect.thread },
  timing: { speed: doc.timing.speed },
  view: { zoom: doc.view.zoom, panX: doc.view.panX, panY: doc.view.panY },
  selection: { selKind: doc.sel.kind, selStrokeId: doc.sel.strokeId, selIdx: doc.sel.idx },
});

// restore state from a snapshot object (scratch autosave or a slot).
export function restore(doc, data) {
  if (!data) return;
  if (data.symbol && Array.isArray(data.symbol.strokes)) {
    setUidFloor(maxSymbolId(data.symbol)); // bump uid past highest stored id
    doc.symbol = data.symbol;
  }
  if (data.params) {
    const p = data.params;
    if (typeof p.baseRadius === "number") doc.baseRadius = p.baseRadius;
    if (typeof p.showHandles === "boolean") doc.showHandles = p.showHandles;
    if (typeof p.showGrid === "boolean") doc.showGrid = p.showGrid;
  }
  if (data.connect) {
    const c = data.connect;
    if (typeof c.enabled === "boolean") doc.connect.enabled = c.enabled;
    if (typeof c.thread === "number") doc.connect.thread = c.thread;
  }
  if (data.timing && typeof data.timing.speed === "number") doc.timing.speed = data.timing.speed;
  if (data.view && typeof data.view.zoom === "number") {
    doc.view.zoom = data.view.zoom;
    doc.view.panX = data.view.panX || 0;
    doc.view.panY = data.view.panY || 0;
  }
  if (data.selection) {
    const s = data.selection;
    const stroke = doc.symbol.strokes.find((x) => x.id === s.selStrokeId);
    if (stroke) {
      const kind = s.selKind || "stroke";
      const len = kind === "path" ? stroke.paths.length : stroke.points.length;
      doc.sel.strokeId = s.selStrokeId;
      doc.sel.kind = kind;
      doc.sel.idx = Math.min(Math.max(0, s.selIdx | 0), Math.max(0, len - 1));
    }
  }
}

// --- scratch autosave --------------------------------------------------------
export function loadScratch(doc) {
  if (!ok()) return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) restore(doc, JSON.parse(raw));
  } catch (e) {
    console.warn("brush: failed to load saved state", e);
  }
}

function saveScratch(doc) {
  if (!ok()) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(snapshot(doc)));
  } catch (e) {
    /* quota/private mode */
  }
}

// Debounced: an un-debounced save is a synchronous stringify + localStorage
// write per pointermove. First schedule() (the post-load effect run) is a no-op.
export function makeAutosave(doc, delay = 300) {
  let timer = null, ready = false;
  return {
    schedule() {
      if (!ready) {
        ready = true;
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => saveScratch(doc), delay);
    },
    flush() {
      if (timer == null) return;
      clearTimeout(timer);
      timer = null;
      saveScratch(doc);
    },
  };
}

// --- fixed save slots --------------------------------------------------------
const slots = makeSlots({ prefix: SLOT_PREFIX, count: SLOT_COUNT });

export const slotMeta = () => slots.meta();
export const clearSlot = (i) => slots.clear(i);
export const saveSlot = (i, doc) => slots.save(i, snapshot(doc));

export function loadSlot(i, doc) {
  const e = slots.read(i);
  if (!e) return false;
  restore(doc, e.payload);
  return true;
}

export const slotLabel = (at) => (at ? new Date(at).toLocaleString() : "empty");
