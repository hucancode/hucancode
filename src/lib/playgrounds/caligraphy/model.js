// Editable document + every op the editor performs on it.
// doc = { symbol, sel, view, connect, timing, baseRadius, showHandles, showGrid }
// sel = { kind: "stroke"|"point"|"path"|"none", strokeId, idx }
// The doc is a Svelte $state proxy at the call site: every op mutates in place
// (or reassigns doc.symbol), so reactivity falls out for free.
import {
  makeStrokeRaw,
  makePoint,
  insertPointAfter,
  removePoint,
  resolveControl,
  setUidFloor,
  uid,
  DEFAULT_CONNECT,
  DEFAULT_TIMING,
} from "$lib/brush/engine";
import { yong } from "$lib/brush/yong";
import { long } from "$lib/brush/long";
import { fu } from "$lib/brush/fu";

// seed samples: the dropdown picks one to load fresh.
export const SAMPLES = {
  yong: { label: "永 (yong)", ...yong },
  long: { label: "龍 (long)", ...long },
  fu: { label: "福 (fu)", ...fu },
};
export const INITIAL_SAMPLE = "yong";

export function makeDoc() {
  setUidFloor(SAMPLES[INITIAL_SAMPLE].maxId());
  const symbol = SAMPLES[INITIAL_SAMPLE].symbol();
  return {
    symbol,
    sel: { kind: "path", strokeId: symbol.strokes[0].id, idx: 0 },
    view: { zoom: 1, panX: 0, panY: 0 },
    connect: DEFAULT_CONNECT(),
    timing: DEFAULT_TIMING(),
    baseRadius: 0.07,
    showHandles: true,
    showGrid: true,
  };
}

// load a fresh seed sample, discarding current edits.
export function loadSample(doc, key) {
  const s = SAMPLES[key];
  if (!s) return false;
  setUidFloor(s.maxId()); // uid floor bumped past the sample's ids
  doc.symbol = s.symbol();
  selectStroke(doc.sel, doc.symbol.strokes[0].id);
  return true;
}

// --- selection ---------------------------------------------------------------
export const findStroke = (symbol, id) => symbol.strokes.find((s) => s.id === id);
export const selStroke = (doc) => findStroke(doc.symbol, doc.sel.strokeId);

export function selectStroke(sel, id) {
  sel.kind = "stroke";
  sel.strokeId = id;
  sel.idx = 0;
}
export function selectPoint(sel, id, i) {
  sel.kind = "point";
  sel.strokeId = id;
  sel.idx = i;
}
export function selectPath(sel, id, i) {
  sel.kind = "path";
  sel.strokeId = id;
  sel.idx = i;
}
export function deselect(sel) {
  sel.kind = "none";
  sel.idx = 0;
}

export function selPoint(doc) {
  const s = selStroke(doc);
  return doc.sel.kind === "point" && s ? s.points[doc.sel.idx] : null;
}
export function selPath(doc) {
  const s = selStroke(doc);
  return doc.sel.kind === "path" && s ? s.paths[doc.sel.idx] : null;
}
// belly slider value: explicit pctrl.k, else the straight-line default
export function selPathK(doc) {
  const p = selPath(doc);
  if (!p) return 0;
  const s = selStroke(doc);
  return (
    p.pctrl?.k ??
    (s.points[doc.sel.idx].pressure + s.points[doc.sel.idx + 1].pressure) / 2
  );
}

const randPressure = () => 0.25 + Math.random() * 0.7;

// --- points / strokes --------------------------------------------------------
// "+ point":
//  - point selected  -> insert after selected point on same stroke
//  - else            -> spawn new stroke with 1 point (not rendered yet)
export function spawnPoint(doc) {
  const { symbol, sel } = doc;
  if (sel.kind === "point") {
    const s = findStroke(symbol, sel.strokeId);
    if (!s) return;
    const p = s.points[sel.idx];
    const next = s.points[sel.idx + 1];
    let nx, ny;
    if (next) {
      nx = (p.x + next.x) / 2;
      ny = (p.y + next.y) / 2;
    } else {
      const prev = s.points[sel.idx - 1];
      if (prev) {
        nx = p.x + (p.x - prev.x) * 0.7;
        ny = p.y + (p.y - prev.y) * 0.7;
      } else {
        nx = p.x + 0.2;
        ny = p.y;
      }
    }
    insertPointAfter(s, sel.idx, nx, ny, randPressure());
    selectPoint(sel, s.id, sel.idx + 1);
  } else {
    const s = makeStrokeRaw([
      makePoint((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4, randPressure()),
    ]);
    symbol.strokes.push(s);
    selectPoint(sel, s.id, 0);
  }
}

export function despawnPoint(doc) {
  const { symbol, sel } = doc;
  if (sel.kind !== "point") return;
  const s = findStroke(symbol, sel.strokeId);
  if (!s) return;
  if (s.points.length <= 1) {
    // last point on stroke -> remove stroke
    const idx = symbol.strokes.findIndex((x) => x.id === s.id);
    symbol.strokes.splice(idx, 1);
    const fallback = symbol.strokes[Math.max(0, idx - 1)];
    if (fallback) selectStroke(sel, fallback.id);
    else selectStroke(sel, -1);
    return;
  }
  removePoint(s, sel.idx);
  selectPoint(sel, s.id, Math.min(sel.idx, s.points.length - 1));
}

export function moveStroke(symbol, idx, dir) {
  const j = idx + dir;
  const arr = symbol.strokes;
  if (j < 0 || j >= arr.length) return;
  [arr[idx], arr[j]] = [arr[j], arr[idx]];
}

export function canSplit(doc) {
  const s = selStroke(doc);
  return doc.sel.kind === "point" && !!s && doc.sel.idx > 0 && doc.sel.idx < s.points.length - 1;
}

// Split the selected stroke at the selected (interior) point, dropping that
// point as the lift gap: stroke A keeps points before it, B keeps points
// after. The auto-connector then threads the gap. Turns connectors on so the
// result is visible immediately.
export function splitStroke(doc) {
  const { symbol, sel } = doc;
  const s = findStroke(symbol, sel.strokeId);
  if (!s || sel.kind !== "point") return;
  const i = sel.idx;
  if (i <= 0 || i >= s.points.length - 1) return;
  const idx = symbol.strokes.findIndex((x) => x.id === s.id);
  const a = { id: s.id, points: s.points.slice(0, i), paths: s.paths.slice(0, i - 1) };
  const b = { id: uid(), points: s.points.slice(i + 1), paths: s.paths.slice(i + 1) };
  symbol.strokes.splice(idx, 1, a, b);
  doc.connect.enabled = true;
  selectStroke(sel, b.id);
}

// --- frame mode: transform whole glyph ---------------------------------------
// world-space bounding box over every point of every stroke.
export function glyphBBox(symbol) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of symbol.strokes) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

// shift every point + explicit control point by (dx,dy).
export function translateGlyph(symbol, dx, dy) {
  for (const s of symbol.strokes) {
    for (const p of s.points) {
      p.x += dx;
      p.y += dy;
    }
    for (const pa of s.paths)
      if (pa.ctrl) {
        pa.ctrl.x += dx;
        pa.ctrl.y += dy;
      }
  }
}

// uniform scale by f about pivot (ox,oy) in world space.
export function scaleGlyph(symbol, f, ox, oy) {
  if (!isFinite(f) || f <= 0) return;
  for (const s of symbol.strokes) {
    for (const p of s.points) {
      p.x = ox + (p.x - ox) * f;
      p.y = oy + (p.y - oy) * f;
    }
    for (const pa of s.paths)
      if (pa.ctrl) {
        pa.ctrl.x = ox + (pa.ctrl.x - ox) * f;
        pa.ctrl.y = oy + (pa.ctrl.y - oy) * f;
      }
  }
}

// --- curve / pressure control ------------------------------------------------
// materialize the auto control point of path i so it can be dragged.
export function materializeControl(symbol, strokeId, i) {
  const s = findStroke(symbol, strokeId);
  if (s && !s.paths[i].ctrl) s.paths[i].ctrl = resolveControl(s, i);
}

export function resetControl(doc) {
  const p = selPath(doc);
  if (p) p.ctrl = null;
}

// pressure curve control {k}: stroke belly thins/swells toward k.
// materialize from a straight line (k = lerp(A,B,0.5)) on first edit.
export function setPctrlK(doc, v) {
  const p = selPath(doc);
  if (!p) return;
  if (!p.pctrl) p.pctrl = { k: selPathK(doc) };
  p.pctrl.k = v;
}

export function resetPressure(doc) {
  const p = selPath(doc);
  if (p) p.pctrl = null;
}
