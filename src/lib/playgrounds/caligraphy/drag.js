// Pointer state machine for the stage: pan, cursor-anchored wheel zoom, and
// the drag modes (point / edge / control handle / whole-glyph move+scale).
// Drag state is deliberately plain (non-reactive) - only the doc it mutates is.
import {
  findStroke,
  selectPoint,
  selectPath,
  deselect,
  materializeControl,
  translateGlyph,
  scaleGlyph,
} from "./model.js";
import { screenToWorld, zoomAt, panBy } from "./view.js";

const PAN_SLOP = 3; // px of movement before a bg drag stops counting as a click

export function makeDrag(getStage, doc) {
  // mode: "pan" | "point" | "edge" | "ctrl" | "frame-move" | "frame-scale"
  let mode = null, strokeId = null, idx = null;
  let lastWorld = null, anchor = null; // anchor = pivot (world) for frame-scale
  let lastScreen = null, downScreen = null, moved = false;

  const rect = () => getStage().getBoundingClientRect();
  function world(e) {
    const r = rect();
    return screenToWorld(e.clientX - r.left, e.clientY - r.top, r.width, r.height, doc.view);
  }
  function begin(e, m) {
    e.preventDefault();
    e.stopPropagation();
    mode = m;
    lastWorld = world(e);
  }

  return {
    // bg-only drag -> pan. Ignore if hitting a real interactive overlay element.
    stageDown(e) {
      const tag = e.target?.tagName;
      if (tag === "circle" || tag === "rect") return;
      if (tag === "path" && e.target.style.cursor === "move") return; // edge hit area
      e.preventDefault();
      mode = "pan";
      lastScreen = { x: e.clientX, y: e.clientY };
      downScreen = { x: e.clientX, y: e.clientY };
      moved = false;
    },
    wheel(e) {
      e.preventDefault();
      const r = rect();
      zoomAt(doc.view, e.clientX - r.left, e.clientY - r.top, e.deltaY, r.width, r.height);
    },
    point(e, sid, i) {
      begin(e, "point");
      strokeId = sid;
      idx = i;
      selectPoint(doc.sel, sid, i);
    },
    edge(e, sid, i) {
      begin(e, "edge");
      strokeId = sid;
      idx = i;
      selectPath(doc.sel, sid, i);
    },
    handle(e, sid, i) {
      begin(e, "ctrl");
      strokeId = sid;
      idx = i;
      selectPath(doc.sel, sid, i);
      materializeControl(doc.symbol, sid, i); // auto ctrl -> explicit, so it can move
    },
    frameMove(e) {
      begin(e, "frame-move");
    },
    // anchor = opposite corner (world); scaling pins it in place.
    frameScale(e, ax, ay) {
      begin(e, "frame-scale");
      anchor = { x: ax, y: ay };
    },
    move(e) {
      if (!mode) return;
      if (mode === "pan") {
        const r = rect();
        const dx = e.clientX - lastScreen.x, dy = e.clientY - lastScreen.y;
        lastScreen = { x: e.clientX, y: e.clientY };
        if (Math.hypot(e.clientX - downScreen.x, e.clientY - downScreen.y) > PAN_SLOP) moved = true;
        panBy(doc.view, dx, dy, r.width, r.height);
        return;
      }
      const w = world(e);
      if (mode === "frame-move") {
        translateGlyph(doc.symbol, w.x - lastWorld.x, w.y - lastWorld.y);
      } else if (mode === "frame-scale") {
        const dPrev = Math.hypot(lastWorld.x - anchor.x, lastWorld.y - anchor.y);
        const dNow = Math.hypot(w.x - anchor.x, w.y - anchor.y);
        if (dPrev > 1e-4) scaleGlyph(doc.symbol, dNow / dPrev, anchor.x, anchor.y);
      } else {
        const s = findStroke(doc.symbol, strokeId);
        if (!s) return;
        if (mode === "point") {
          s.points[idx].x = w.x;
          s.points[idx].y = w.y;
        } else if (mode === "edge") {
          const dx = w.x - lastWorld.x, dy = w.y - lastWorld.y;
          for (const p of [s.points[idx], s.points[idx + 1]]) {
            p.x += dx;
            p.y += dy;
          }
          const ctrl = s.paths[idx].ctrl;
          if (ctrl) {
            ctrl.x += dx;
            ctrl.y += dy;
          }
        } else if (mode === "ctrl") {
          s.paths[idx].ctrl = { x: w.x, y: w.y };
        }
      }
      lastWorld = w;
    },
    up() {
      const wasClick = mode === "pan" && !moved; // click on empty stage = deselect
      mode = strokeId = idx = lastWorld = anchor = lastScreen = downScreen = null;
      moved = false;
      if (wasClick) deselect(doc.sel);
    },
  };
}
