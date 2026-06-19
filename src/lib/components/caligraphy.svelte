<script>
  import { onMount } from "svelte";
  import {
    makeStrokeRaw,
    makePoint,
    insertPointAfter,
    removePoint,
    resolveControl,
    setUidFloor,
    uid,
    makePlayback,
    syncPlayback,
    step,
    symbolDuration,
    DEFAULT_CONNECT,
    DEFAULT_TIMING,
  } from "$lib/brush/engine";
  import { yongSymbol, yongMaxId } from "$lib/brush/yong";
  import { longSymbol, longMaxId } from "$lib/brush/long";
  import { fuSymbol, fuMaxId } from "$lib/brush/fu";
  import { bakeGLSL } from "$lib/brush/bake";
  import { makeGLRenderer } from "$lib/brush/render-gl";

  // World coords: x in [-aspect,+aspect], y in [-1,+1], origin centred.
  // view: { zoom, panX, panY } applied as pScreen = view((p - pan) * zoom).
  function worldToScreen(p, w, h, view) {
    const aspect = w / h;
    const vx = (p.x - view.panX) * view.zoom;
    const vy = (p.y - view.panY) * view.zoom;
    return { x: ((vx / aspect + 1) / 2) * w, y: (1 - (vy + 1) / 2) * h };
  }
  function screenToWorld(x, y, w, h, view) {
    const aspect = w / h;
    const vx = ((x / w) * 2 - 1) * aspect;
    const vy = (1 - y / h) * 2 - 1;
    return { x: vx / view.zoom + view.panX, y: vy / view.zoom + view.panY };
  }

  const LS_KEY = "brush:state:v1";
  const LS_SLOTS_KEY = "brush:slots:v1";

  // named save slots: explicit user snapshots, [{ id, name, data }].
  let slots = $state([]);
  let activeSlotId = $state(null);

  // seed samples: dropdown picks one to load fresh.
  const SAMPLES = {
    yong: { label: "永 (yong)", make: yongSymbol, maxId: yongMaxId },
    long: { label: "龍 (long)", make: longSymbol, maxId: longMaxId },
    fu: { label: "福 (fu)", make: fuSymbol, maxId: fuMaxId },
  };
  let sampleKey = $state("yong");

  let canvasEl;
  let glRenderer = null;
  let stageW = $state(600),
    stageH = $state(600);

  // initial: load yong as seed; uid floor bumped past stored ids.
  setUidFloor(SAMPLES[sampleKey].maxId());
  let symbol = $state(SAMPLES[sampleKey].make());

  // selection
  let selKind = $state("path");
  let selStrokeId = $state(symbol.strokes[0].id);
  let selIdx = $state(0);

  // brush params
  let baseRadius = $state(0.07);
  let sampleDensity = $state(80); // samples per world unit
  let showHandles = $state(true);
  let showGrid = $state(true);
  let view = $state({ zoom: 1, panX: 0, panY: 0 });
  const color = "#111111";

  // frame mode: edit the whole glyph at once (translate + uniform scale)
  // instead of individual points.
  let frameMode = $state(false);

  // show-code panel: dump the live symbol.strokes array as JSON.
  let showCode = $state(false);
  const codeText = $derived(JSON.stringify(symbol.strokes, null, 2));

  // bake panel: emit the shadertoy GLSL Seg[] table for the live symbol.
  let bakeText = $state("");
  let bakeInfo = $state("");
  function bake() {
    const r = bakeGLSL(symbol, {
      connect: { enabled: connect.enabled, thread: connect.thread },
      timing: { speed: timing.speed },
      glyph: SAMPLES[sampleKey]?.label ?? "?",
    });
    bakeText = r.glsl;
    bakeInfo = `${r.segCount} segs / ${r.strokeCount} strokes / ${r.total.toFixed(3)}s`;
  }

  // auto connectors: derive a thin silk thread between every consecutive
  // stroke pair. Pure derived geometry - not stored on the symbol.
  let connect = $state(DEFAULT_CONNECT());

  // auto timing: per-path durations derived from geometry + pressure (slow at
  // pivots, accelerate leaving them, faster on thin line). Only base speed is
  // configurable; timing is always auto-computed.
  let timing = $state(DEFAULT_TIMING());

  // playback: anim=true renders partially up to pb.t; false = full edit view.
  let anim = $state(false);
  let pb = $state(makePlayback(symbol, connect, timing));
  let rafId = null;
  let lastTs = null;

  // drag state
  // mode: "point" (move single point), "edge" (translate segment),
  // "ctrl" (move control point)
  let dragMode = null;
  let dragStrokeId = null;
  let dragIdx = null;
  let dragLastWorld = null;
  let frameAnchor = null; // pivot (world) for frame-scale drag

  function randPressure() {
    return 0.25 + Math.random() * 0.7;
  }

  function findStroke(id) {
    return symbol.strokes.find((s) => s.id === id);
  }

  // load a fresh seed sample, discarding current edits.
  function loadSample(key) {
    const s = SAMPLES[key];
    if (!s) return;
    sampleKey = key;
    setUidFloor(s.maxId());
    symbol = s.make();
    selKind = "stroke";
    selStrokeId = symbol.strokes[0].id;
    selIdx = 0;
    pause();
    anim = false;
  }

  function selectStroke(id) {
    selKind = "stroke";
    selStrokeId = id;
    selIdx = 0;
  }
  function selectPoint(id, i) {
    selKind = "point";
    selStrokeId = id;
    selIdx = i;
  }
  function selectPath(id, i) {
    selKind = "path";
    selStrokeId = id;
    selIdx = i;
  }

  // "+ point":
  //  - point selected  -> insert after selected point on same stroke
  //  - else            -> spawn new stroke with 1 point (not rendered yet)
  function spawnPoint() {
    if (selKind === "point") {
      const s = findStroke(selStrokeId);
      if (!s) return;
      const p = s.points[selIdx];
      const next = s.points[selIdx + 1];
      let nx, ny;
      if (next) {
        nx = (p.x + next.x) / 2;
        ny = (p.y + next.y) / 2;
      } else {
        const prev = s.points[selIdx - 1];
        if (prev) {
          const dx = p.x - prev.x,
            dy = p.y - prev.y;
          nx = p.x + dx * 0.7;
          ny = p.y + dy * 0.7;
        } else {
          nx = p.x + 0.2;
          ny = p.y;
        }
      }
      const q = insertPointAfter(s, selIdx, nx, ny, randPressure());
      selectPoint(s.id, selIdx + 1);
      void q;
    } else {
      const s = makeStrokeRaw([
        makePoint(
          (Math.random() - 0.5) * 1.4,
          (Math.random() - 0.5) * 1.4,
          randPressure(),
        ),
      ]);
      symbol.strokes.push(s);
      selectPoint(s.id, 0);
    }
  }
  function despawnPoint() {
    if (selKind !== "point") return;
    const s = findStroke(selStrokeId);
    if (!s) return;
    if (s.points.length <= 1) {
      // last point on stroke -> remove stroke
      const idx = symbol.strokes.findIndex((x) => x.id === s.id);
      symbol.strokes.splice(idx, 1);
      const fallback = symbol.strokes[Math.max(0, idx - 1)];
      if (fallback) selectStroke(fallback.id);
      else {
        selKind = "stroke";
        selStrokeId = -1;
        selIdx = 0;
      }
      return;
    }
    removePoint(s, selIdx);
    const newIdx = Math.min(selIdx, s.points.length - 1);
    selectPoint(s.id, newIdx);
  }

  // --- stroke order -----------------------------------------------------------
  function moveStroke(idx, dir) {
    const j = idx + dir;
    const arr = symbol.strokes;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
  }

  // Split the selected stroke at the selected (interior) point, dropping that
  // point as the lift gap: stroke A keeps points before it, B keeps points
  // after. The auto-connector then threads the gap. Turns connectors on so the
  // result is visible immediately.
  const canSplit = $derived(
    selKind === "point" &&
      selStroke &&
      selIdx > 0 &&
      selIdx < selStroke.points.length - 1,
  );
  function splitStroke() {
    const s = findStroke(selStrokeId);
    if (!s || selKind !== "point") return;
    const i = selIdx;
    if (i <= 0 || i >= s.points.length - 1) return;
    const idx = symbol.strokes.findIndex((x) => x.id === s.id);
    const a = {
      id: s.id,
      points: s.points.slice(0, i),
      paths: s.paths.slice(0, i - 1),
    };
    const b = {
      id: uid(),
      points: s.points.slice(i + 1),
      paths: s.paths.slice(i + 1),
    };
    symbol.strokes.splice(idx, 1, a, b);
    connect.enabled = true;
    selectStroke(b.id);
  }

  // --- playback ---------------------------------------------------------------
  function stopRaf() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTs = null;
  }
  function tick(ts) {
    if (lastTs == null) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    syncPlayback(pb, symbol, connect, timing);
    step(pb, dt);
    render();
    if (pb.playing) rafId = requestAnimationFrame(tick);
    else stopRaf();
  }
  function play() {
    syncPlayback(pb, symbol, connect, timing);
    if (pb.duration <= 0) return;
    if (pb.t >= pb.duration) pb.t = 0; // replay from start
    anim = true;
    pb.playing = true;
    lastTs = null;
    stopRaf();
    rafId = requestAnimationFrame(tick);
  }
  function pause() {
    pb.playing = false;
    stopRaf();
  }
  function togglePlay() {
    pb.playing ? pause() : play();
  }
  function seekTo(v) {
    pause();
    anim = true;
    syncPlayback(pb, symbol, connect, timing);
    pb.t = Math.max(0, Math.min(pb.duration, v));
    render();
  }
  function exitAnim() {
    pause();
    anim = false;
    render();
  }

  function ws(p) {
    return worldToScreen(p, stageW, stageH, view);
  }

  function pointerWorld(e) {
    const r = canvasEl.getBoundingClientRect();
    return screenToWorld(
      e.clientX - r.left,
      e.clientY - r.top,
      stageW,
      stageH,
      view,
    );
  }
  let dragLastScreen = null;
  let dragDownScreen = null;
  let dragMoved = false;
  function onStageDown(e) {
    // bg-only drag → pan. Ignore if hitting a real interactive overlay element.
    const tag = e.target?.tagName;
    if (tag === "circle" || tag === "rect") return;
    if (tag === "path" && e.target.style.cursor === "move") return; // edge hit area
    e.preventDefault();
    dragMode = "pan";
    dragLastScreen = { x: e.clientX, y: e.clientY };
    dragDownScreen = { x: e.clientX, y: e.clientY };
    dragMoved = false;
  }
  function deselectAll() {
    selKind = "none";
    selIdx = 0;
  }
  function onWheel(e) {
    if (!canvasEl) return;
    e.preventDefault();
    const r = canvasEl.getBoundingClientRect();
    const sx = e.clientX - r.left,
      sy = e.clientY - r.top;
    const before = screenToWorld(sx, sy, stageW, stageH, view);
    const factor = Math.exp(-e.deltaY * 0.0015);
    const newZoom = Math.max(0.2, Math.min(20, view.zoom * factor));
    view.zoom = newZoom;
    const after = screenToWorld(sx, sy, stageW, stageH, view);
    view.panX += before.x - after.x;
    view.panY += before.y - after.y;
  }
  function resetView() {
    view.zoom = 1;
    view.panX = 0;
    view.panY = 0;
  }

  // --- frame mode: transform whole glyph --------------------------------------
  // world-space bounding box over every point of every stroke.
  function glyphBBox() {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
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
  function translateGlyph(dx, dy) {
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
  function scaleGlyph(f, ox, oy) {
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
  function onPointerDownFrameMove(e) {
    e.preventDefault();
    e.stopPropagation();
    dragMode = "frame-move";
    dragLastWorld = pointerWorld(e);
  }
  // anchor = opposite corner (world); scaling pins it in place.
  function onPointerDownFrameScale(e, ax, ay) {
    e.preventDefault();
    e.stopPropagation();
    dragMode = "frame-scale";
    frameAnchor = { x: ax, y: ay };
    dragLastWorld = pointerWorld(e);
  }
  function onPointerDownPoint(e, strokeId, i) {
    e.preventDefault();
    e.stopPropagation();
    dragMode = "point";
    dragStrokeId = strokeId;
    dragIdx = i;
    dragLastWorld = pointerWorld(e);
    selectPoint(strokeId, i);
  }
  function onPointerDownEdge(e, strokeId, i) {
    e.preventDefault();
    e.stopPropagation();
    selectPath(strokeId, i);
    dragMode = "edge";
    dragStrokeId = strokeId;
    dragIdx = i;
    dragLastWorld = pointerWorld(e);
  }
  function onPointerDownHandle(e, strokeId, i) {
    e.preventDefault();
    e.stopPropagation();
    selectPath(strokeId, i);
    dragMode = "ctrl";
    dragStrokeId = strokeId;
    dragIdx = i;
    dragLastWorld = pointerWorld(e);
    // materialize control point if currently auto
    const s = findStroke(strokeId);
    if (s && !s.paths[i].ctrl) s.paths[i].ctrl = resolveControl(s, i);
  }
  function onPointerMove(e) {
    if (!dragMode || !canvasEl) return;
    if (dragMode === "pan") {
      const dx = e.clientX - dragLastScreen.x;
      const dy = e.clientY - dragLastScreen.y;
      dragLastScreen = { x: e.clientX, y: e.clientY };
      const tot = Math.hypot(
        e.clientX - dragDownScreen.x,
        e.clientY - dragDownScreen.y,
      );
      if (tot > 3) dragMoved = true;
      const aspect = stageW / stageH;
      view.panX -= ((dx / stageW) * 2 * aspect) / view.zoom;
      view.panY += ((dy / stageH) * 2) / view.zoom;
      return;
    }
    if (dragMode === "frame-move") {
      const w = pointerWorld(e);
      translateGlyph(w.x - dragLastWorld.x, w.y - dragLastWorld.y);
      dragLastWorld = w;
      return;
    }
    if (dragMode === "frame-scale") {
      const w = pointerWorld(e);
      const a = frameAnchor;
      const dPrev = Math.hypot(dragLastWorld.x - a.x, dragLastWorld.y - a.y);
      const dNow = Math.hypot(w.x - a.x, w.y - a.y);
      if (dPrev > 1e-4) scaleGlyph(dNow / dPrev, a.x, a.y);
      dragLastWorld = w;
      return;
    }
    const w = pointerWorld(e);
    const s = findStroke(dragStrokeId);
    if (!s) return;
    if (dragMode === "point") {
      s.points[dragIdx].x = w.x;
      s.points[dragIdx].y = w.y;
    } else if (dragMode === "edge") {
      const dx = w.x - dragLastWorld.x;
      const dy = w.y - dragLastWorld.y;
      const a = s.points[dragIdx];
      const b = s.points[dragIdx + 1];
      a.x += dx;
      a.y += dy;
      b.x += dx;
      b.y += dy;
      const path = s.paths[dragIdx];
      if (path.ctrl) {
        path.ctrl.x += dx;
        path.ctrl.y += dy;
      }
    } else if (dragMode === "ctrl") {
      s.paths[dragIdx].ctrl = { x: w.x, y: w.y };
    }
    dragLastWorld = w;
  }
  function endDrag() {
    const wasPan = dragMode === "pan";
    const wasClick = wasPan && !dragMoved;
    dragMode = null;
    dragStrokeId = null;
    dragIdx = null;
    dragLastWorld = null;
    dragLastScreen = null;
    dragDownScreen = null;
    frameAnchor = null;
    dragMoved = false;
    if (wasClick) deselectAll();
  }
  function resetControl() {
    const s = findStroke(selStrokeId);
    if (!s || selKind !== "path") return;
    s.paths[selIdx].ctrl = null;
  }

  // pressure curve control {x,k}: belly thins/swells to k at progress x.
  // materialize from a straight line (k = lerp(A,B,0.5)) on first edit.
  function ensurePctrl() {
    const s = findStroke(selStrokeId);
    if (!s || selKind !== "path") return null;
    const p = s.paths[selIdx];
    if (!p.pctrl) {
      const a = s.points[selIdx].pressure;
      const b = s.points[selIdx + 1].pressure;
      p.pctrl = { k: (a + b) / 2 };
    }
    return p.pctrl;
  }
  function setPctrlK(v) {
    const c = ensurePctrl();
    if (c) c.k = v;
  }
  function resetPressure() {
    const s = findStroke(selStrokeId);
    if (!s || selKind !== "path") return;
    s.paths[selIdx].pctrl = null;
  }

  function syncCanvasSize() {
    if (!canvasEl || stageW <= 0 || stageH <= 0) return;
    if (canvasEl.width !== stageW || canvasEl.height !== stageH) {
      canvasEl.width = stageW;
      canvasEl.height = stageH;
    }
  }

  function render() {
    if (!canvasEl || stageW <= 0 || stageH <= 0) return;
    syncCanvasSize();
    if (!glRenderer) glRenderer = makeGLRenderer(canvasEl);
    glRenderer.render(symbol, {
      baseRadius,
      view,
      showGrid,
      gridSize: 1.6,
      connect,
      timing,
      playhead: anim ? pb.t : undefined,
    });
  }

  // deep-track symbol via JSON.stringify; cheap for small models
  $effect(() => {
    // deep read all state
    void JSON.stringify(symbol);
    void baseRadius;
    void sampleDensity;
    void showGrid;
    void connect.enabled;
    void connect.thread;
    void timing.speed;
    void view.zoom;
    void view.panX;
    void view.panY;
    void stageW;
    void stageH;
    render();
  });

  // snapshot all editable state into a plain serializable object.
  function serializeState() {
    return {
      symbol,
      params: { baseRadius, sampleDensity, showHandles, showGrid },
      connect: { enabled: connect.enabled, thread: connect.thread },
      timing: { speed: timing.speed },
      view: { zoom: view.zoom, panX: view.panX, panY: view.panY },
      selection: { selKind, selStrokeId, selIdx },
    };
  }

  // restore state from a snapshot object (from scratch autosave or a slot).
  function applyState(data) {
    if (!data) return;
    if (data.symbol && Array.isArray(data.symbol.strokes)) {
      // bump uid past highest stored id
      let maxId = 0;
      for (const s of data.symbol.strokes) {
        if (s.id > maxId) maxId = s.id;
        for (const p of s.points || []) if (p.id > maxId) maxId = p.id;
      }
      setUidFloor(maxId);
      symbol = data.symbol;
    }
    if (data.params) {
      const p = data.params;
      if (typeof p.baseRadius === "number") baseRadius = p.baseRadius;
      if (typeof p.sampleDensity === "number") sampleDensity = p.sampleDensity;
      if (typeof p.showHandles === "boolean") showHandles = p.showHandles;
      if (typeof p.showGrid === "boolean") showGrid = p.showGrid;
    }
    if (data.connect) {
      const c = data.connect;
      if (typeof c.enabled === "boolean") connect.enabled = c.enabled;
      if (typeof c.thread === "number") connect.thread = c.thread;
    }
    if (data.timing && typeof data.timing.speed === "number") {
      timing.speed = data.timing.speed;
    }
    if (data.view && typeof data.view.zoom === "number") {
      view.zoom = data.view.zoom;
      view.panX = data.view.panX || 0;
      view.panY = data.view.panY || 0;
    }
    if (data.selection) {
      const sel = data.selection;
      const stroke = symbol.strokes.find((s) => s.id === sel.selStrokeId);
      if (stroke) {
        selStrokeId = sel.selStrokeId;
        selKind = sel.selKind || "stroke";
        selIdx = Math.min(
          Math.max(0, sel.selIdx | 0),
          Math.max(
            0,
            (selKind === "path" ? stroke.paths.length : stroke.points.length) -
              1,
          ),
        );
      }
    }
  }

  function loadState() {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      applyState(JSON.parse(raw));
    } catch (e) {
      console.warn("brush: failed to load saved state", e);
    }
  }

  function saveState() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(serializeState()));
    } catch (e) {
      /* quota/private mode */
    }
  }

  // --- named save slots -------------------------------------------------------
  // scratch autosave (LS_KEY) is the live working copy; slots are explicit,
  // user-named snapshots persisted under LS_SLOTS_KEY as [{ id, name, data }].
  function loadSlots() {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(LS_SLOTS_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) slots = arr;
    } catch (e) {
      /* ignore corrupt slot store */
    }
  }
  function persistSlots() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(LS_SLOTS_KEY, JSON.stringify(slots));
    } catch (e) {
      /* quota/private mode */
    }
  }
  function newSlot() {
    const name =
      typeof prompt === "function"
        ? prompt("Save slot name", `slot ${slots.length + 1}`)
        : `slot ${slots.length + 1}`;
    if (name == null) return; // cancelled
    const slot = {
      id: uid(),
      name: name.trim() || `slot ${slots.length + 1}`,
      data: JSON.parse(JSON.stringify(serializeState())),
    };
    slots.push(slot);
    activeSlotId = slot.id;
    persistSlots();
  }
  function saveToSlot(id) {
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;
    slot.data = JSON.parse(JSON.stringify(serializeState()));
    activeSlotId = id;
    persistSlots();
  }
  function loadSlot(id) {
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;
    applyState(JSON.parse(JSON.stringify(slot.data)));
    activeSlotId = id;
    pause();
    anim = false;
  }
  function renameSlot(id) {
    const slot = slots.find((s) => s.id === id);
    if (!slot || typeof prompt !== "function") return;
    const name = prompt("Rename slot", slot.name);
    if (name == null) return;
    slot.name = name.trim() || slot.name;
    persistSlots();
  }
  function deleteSlot(id) {
    const i = slots.findIndex((s) => s.id === id);
    if (i < 0) return;
    slots.splice(i, 1);
    if (activeSlotId === id) activeSlotId = null;
    persistSlots();
  }

  onMount(() => {
    loadState();
    loadSlots();
    render();
    return () => {
      glRenderer?.dispose();
      glRenderer = null;
    };
  });

  // persist on every change (after mount/load done)
  let _saveReady = false;
  $effect(() => {
    void JSON.stringify(symbol);
    void baseRadius;
    void sampleDensity;
    void showHandles;
    void connect.enabled;
    void connect.thread;
    void timing.speed;
    void selKind;
    void selStrokeId;
    void selIdx;
    if (_saveReady) saveState();
    else _saveReady = true;
  });

  const totalDuration = $derived(symbolDuration(symbol, connect, timing));
  const selStroke = $derived(findStroke(selStrokeId));
  const selPoint = $derived(
    selKind === "point" && selStroke ? selStroke.points[selIdx] : null,
  );
  const selPath = $derived(
    selKind === "path" && selStroke ? selStroke.paths[selIdx] : null,
  );
  // recomputed live during frame drags, so the frame tracks the glyph.
  const frameWorld = $derived(
    frameMode ? (void JSON.stringify(symbol), glyphBBox()) : null,
  );
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={endDrag} />

<section
  bind:clientWidth={stageW}
  bind:clientHeight={stageH}
  onwheel={onWheel}
  onpointerdown={onStageDown}
>
  <canvas bind:this={canvasEl} style="width:{stageW}px;height:{stageH}px"
  ></canvas>
  <div class="viewport-tools">
    <button
      type="button"
      class="vp-btn"
      class:active={showGrid}
      title={showGrid ? "hide 米 grid" : "show 米 grid"}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => (showGrid = !showGrid)}
      aria-label="toggle grid"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="1.5" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="3" x2="21" y2="21" />
        <line x1="21" y1="3" x2="3" y2="21" />
      </svg>
    </button>
    <button
      type="button"
      class="vp-btn"
      class:active={showHandles && !anim}
      title={anim
        ? "back to edit"
        : showHandles
          ? "hide control points"
          : "show control points"}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => {
        if (anim) {
          exitAnim();
          showHandles = true;
        } else showHandles = !showHandles;
      }}
      aria-label="toggle edit"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M14.5 4.5 19 9 8 20H3.5v-4.5z" />
        <line x1="13" y1="6" x2="18" y2="11" />
      </svg>
    </button>
    <button
      type="button"
      class="vp-btn"
      class:active={frameMode && !anim}
      title={frameMode
        ? "exit frame mode"
        : "frame mode (scale/move whole glyph)"}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => {
        if (anim) exitAnim();
        frameMode = !frameMode;
      }}
      aria-label="toggle frame mode"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" />
        <rect x="8" y="8" width="8" height="8" rx="1" opacity="0.55" />
      </svg>
    </button>
  </div>
  <div class="viewport-zoom" onpointerdown={(e) => e.stopPropagation()}>
    <span class="zoom-pct">{Math.round(view.zoom * 100)}%</span>
    <button
      type="button"
      class="vp-btn"
      title="reset zoom"
      onclick={resetView}
      aria-label="reset zoom"
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v4h4" />
      </svg>
    </button>
  </div>
  {#if frameMode && !anim && stageW > 0 && frameWorld}
    {@const fw = frameWorld}
    {@const cA = ws({ x: fw.minX, y: fw.minY })}
    {@const cB = ws({ x: fw.maxX, y: fw.minY })}
    {@const cC = ws({ x: fw.maxX, y: fw.maxY })}
    {@const cD = ws({ x: fw.minX, y: fw.maxY })}
    {@const left = Math.min(cA.x, cB.x, cC.x, cD.x)}
    {@const right = Math.max(cA.x, cB.x, cC.x, cD.x)}
    {@const top = Math.min(cA.y, cB.y, cC.y, cD.y)}
    {@const bot = Math.max(cA.y, cB.y, cC.y, cD.y)}
    <svg class="overlay" width={stageW} height={stageH}>
      <rect
        x={left}
        y={top}
        width={right - left}
        height={bot - top}
        fill="rgba(40,140,220,0.06)"
        stroke="rgba(40,140,220,0.85)"
        stroke-width="1.5"
        stroke-dasharray="6 4"
        style="cursor:move; pointer-events:all;"
        onpointerdown={onPointerDownFrameMove}
      />
      <!-- corner handles: each scales uniformly about the opposite corner -->
      {#each [{ p: cA, ax: fw.maxX, ay: fw.maxY }, { p: cB, ax: fw.minX, ay: fw.maxY }, { p: cC, ax: fw.minX, ay: fw.minY }, { p: cD, ax: fw.maxX, ay: fw.minY }] as h}
        <rect
          x={h.p.x - 6}
          y={h.p.y - 6}
          width="12"
          height="12"
          fill="rgba(40,140,220,0.95)"
          stroke="white"
          stroke-width="2"
          style="cursor:nwse-resize; pointer-events:all;"
          onpointerdown={(e) => onPointerDownFrameScale(e, h.ax, h.ay)}
        />
      {/each}
    </svg>
  {/if}
  {#if showHandles && !anim && !frameMode && stageW > 0}
    <svg class="overlay" width={stageW} height={stageH}>
      <!-- pass 1: edges (preview + hit area) for every segment of every stroke -->
      {#each symbol.strokes as stroke (stroke.id)}
        {@const isActive = selKind !== "none" && stroke.id === selStrokeId}
        {#each stroke.points.slice(0, -1) as p, i}
          {@const a = ws(p)}
          {@const b = ws(stroke.points[i + 1])}
          {@const cs = ws(resolveControl(stroke, i))}
          {@const edgeSelected =
            selKind === "path" && selStrokeId === stroke.id && selIdx === i}
          <path
            d={`M ${a.x} ${a.y} Q ${cs.x} ${cs.y}, ${b.x} ${b.y}`}
            fill="none"
            stroke={edgeSelected
              ? "rgba(220,40,40,0.75)"
              : isActive
                ? "rgba(220,40,40,0.45)"
                : "rgba(120,120,120,0.4)"}
            stroke-width={edgeSelected ? 3 : 1.5}
            stroke-dasharray="4 3"
            style="pointer-events:none;"
          />
          <path
            d={`M ${a.x} ${a.y} Q ${cs.x} ${cs.y}, ${b.x} ${b.y}`}
            fill="none"
            stroke="transparent"
            stroke-width="16"
            style="cursor:move; pointer-events:stroke;"
            onpointerdown={(e) => onPointerDownEdge(e, stroke.id, i)}
          />
        {/each}
      {/each}

      <!-- pass 2: control point of selected edge (rendered on top of all edges) -->
      {#if selKind === "path" && selStroke && selPath}
        {@const a = ws(selStroke.points[selIdx])}
        {@const b = ws(selStroke.points[selIdx + 1])}
        {@const cs = ws(resolveControl(selStroke, selIdx))}
        <line
          x1={a.x}
          y1={a.y}
          x2={cs.x}
          y2={cs.y}
          stroke="rgba(40,80,220,0.45)"
          stroke-width="1"
          style="pointer-events:none;"
        />
        <line
          x1={b.x}
          y1={b.y}
          x2={cs.x}
          y2={cs.y}
          stroke="rgba(40,80,220,0.45)"
          stroke-width="1"
          style="pointer-events:none;"
        />
        <rect
          x={cs.x - 6}
          y={cs.y - 6}
          width="12"
          height="12"
          fill="rgba(40,140,220,0.95)"
          stroke="white"
          stroke-width="2"
          style="cursor:grab; pointer-events:all;"
          onpointerdown={(e) => onPointerDownHandle(e, selStrokeId, selIdx)}
        />
      {/if}

      <!-- pass 3: points (rendered last, on top of everything) -->
      {#each symbol.strokes as stroke (stroke.id)}
        {@const isActive = selKind !== "none" && stroke.id === selStrokeId}
        {#each stroke.points as pt, i}
          {@const sp = ws(pt)}
          {@const r = 5 + pt.pressure * 7}
          <circle
            cx={sp.x}
            cy={sp.y}
            {r}
            fill={selKind === "point" &&
            selStrokeId === stroke.id &&
            selIdx === i
              ? "rgba(255,200,40,0.95)"
              : i === 0
                ? "rgba(40,160,40,0.85)"
                : i === stroke.points.length - 1
                  ? "rgba(40,80,220,0.85)"
                  : "rgba(220,40,40,0.85)"}
            stroke={isActive ? "white" : "rgba(255,255,255,0.6)"}
            stroke-width="2"
            onpointerdown={(e) => onPointerDownPoint(e, stroke.id, i)}
          />
          <text
            x={sp.x + r + 2}
            y={sp.y - r - 2}
            font-size="10"
            fill="#222"
            font-weight="600"
            style="pointer-events:none;">{i}</text
          >
        {/each}
      {/each}
    </svg>
  {/if}
</section>

<aside>
  <fieldset>
    <legend>symbol</legend>
    <label>
      <span>sample</span>
      <select value={sampleKey} onchange={(e) => loadSample(e.target.value)}>
        {#each Object.entries(SAMPLES) as [key, s]}
          <option value={key}>{s.label}</option>
        {/each}
      </select>
    </label>
    <div class="buttons">
      <button type="button" onclick={spawnPoint} disabled={!showHandles}
        >+ point</button
      >
      <button
        type="button"
        onclick={despawnPoint}
        disabled={!showHandles || selKind !== "point"}>− point</button
      >
      <button
        type="button"
        onclick={splitStroke}
        disabled={!showHandles || !canSplit}
        title="cut this stroke at the selected point; the gap auto-connects with a silk thread"
        >split</button
      >
    </div>
    <div class="buttons">
      <button type="button" onclick={() => (showCode = !showCode)}>
        {showCode ? "hide code" : "show code"}
      </button>
      {#if showCode}
        <button
          type="button"
          title="copy to clipboard"
          onclick={() => navigator.clipboard?.writeText(codeText)}>copy</button
        >
      {/if}
      <button
        type="button"
        onclick={bake}
        title="generate the shadertoy GLSL Seg[] table for this glyph"
        >bake glsl</button
      >
      {#if bakeText}
        <button
          type="button"
          title="copy to clipboard"
          onclick={() => navigator.clipboard?.writeText(bakeText)}>copy</button
        >
        <button
          type="button"
          title="clear baked output"
          onclick={() => {
            bakeText = "";
            bakeInfo = "";
          }}>clear</button
        >
      {/if}
    </div>
    {#if showCode}
      <textarea
        class="code-dump"
        readonly
        rows="12"
        onpointerdown={(e) => e.stopPropagation()}>{codeText}</textarea
      >
    {/if}
    {#if bakeText}
      <p class="hint">baked: {bakeInfo}</p>
      <textarea
        class="code-dump"
        readonly
        rows="14"
        onpointerdown={(e) => e.stopPropagation()}>{bakeText}</textarea
      >
    {/if}
  </fieldset>

  <fieldset>
    <legend>save slots</legend>
    <div class="buttons">
      <button type="button" onclick={newSlot}>+ new slot</button>
    </div>
    {#if slots.length === 0}
      <p class="hint">no slots yet - "+ new slot" snapshots current work.</p>
    {:else}
      <ol class="slot-list">
        {#each slots as slot (slot.id)}
          <li class:sel={activeSlotId === slot.id}>
            <button
              type="button"
              class="slot-pick"
              title="load this slot"
              onclick={() => loadSlot(slot.id)}
            >
              <span class="name">{slot.name}</span>
            </button>
            <span class="slot-actions">
              <button
                type="button"
                title="overwrite with current work"
                onclick={() => saveToSlot(slot.id)}>save</button
              >
              <button
                type="button"
                title="rename"
                onclick={() => renameSlot(slot.id)}>✎</button
              >
              <button
                type="button"
                title="delete"
                onclick={() => deleteSlot(slot.id)}>✕</button
              >
            </span>
          </li>
        {/each}
      </ol>
    {/if}
  </fieldset>

  <fieldset>
    <legend>strokes</legend>
    <ol class="stroke-list">
      {#each symbol.strokes as stroke, i (stroke.id)}
        <li class:sel={selKind !== "none" && selStrokeId === stroke.id}>
          <button
            type="button"
            class="stroke-pick"
            onclick={() => selectStroke(stroke.id)}
          >
            <span class="name">stroke {i + 1}</span>
            <span class="meta">{stroke.points.length} pts</span>
          </button>
          <span class="reorder">
            <button
              type="button"
              title="move earlier"
              disabled={i === 0}
              onclick={() => moveStroke(i, -1)}>▲</button
            >
            <button
              type="button"
              title="move later"
              disabled={i === symbol.strokes.length - 1}
              onclick={() => moveStroke(i, 1)}>▼</button
            >
          </span>
        </li>
      {/each}
    </ol>
  </fieldset>

  <fieldset>
    <legend>playback</legend>
    <div class="buttons">
      <button type="button" onclick={togglePlay} disabled={totalDuration <= 0}>
        {pb.playing ? "⏸ pause" : "▶ play"}
      </button>
    </div>
    <label>
      <span>seek</span>
      <input
        type="range"
        min="0"
        max={totalDuration || 0.001}
        step="0.01"
        value={pb.t}
        oninput={(e) => seekTo(+e.target.value)}
      />
      <output>{pb.t.toFixed(2)}/{totalDuration.toFixed(2)}s</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>auto timing</legend>
    <label>
      <span>base speed</span>
      <input
        type="range"
        min="0.2"
        max="4"
        step="0.05"
        bind:value={timing.speed}
      />
      <output>{timing.speed.toFixed(2)}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>brush</legend>
    <label class="check">
      <input type="checkbox" bind:checked={connect.enabled} />
      <span>auto-thread strokes</span>
    </label>
    <label>
      <span>thread width</span>
      <input
        type="range"
        min="0.0"
        max="0.6"
        step="0.01"
        bind:value={connect.thread}
        disabled={!connect.enabled}
      />
      <output>{connect.thread.toFixed(2)}</output>
    </label>
    <label>
      <span>base radius</span>
      <input
        type="range"
        min="0.005"
        max="0.2"
        step="0.001"
        bind:value={baseRadius}
      />
      <output>{baseRadius.toFixed(3)}</output>
    </label>
  </fieldset>

  {#if selPoint}
    <fieldset>
      <legend>point #{selIdx}</legend>
      <label>
        <span>x</span>
        <input
          type="range"
          min="-1.5"
          max="1.5"
          step="0.001"
          bind:value={selPoint.x}
        />
        <output>{selPoint.x.toFixed(2)}</output>
      </label>
      <label>
        <span>y</span>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.001"
          bind:value={selPoint.y}
        />
        <output>{selPoint.y.toFixed(2)}</output>
      </label>
      <label>
        <span>pressure</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          bind:value={selPoint.pressure}
        />
        <output>{selPoint.pressure.toFixed(2)}</output>
      </label>
    </fieldset>
  {/if}

  {#if selPath}
    <fieldset>
      <legend>path #{selIdx} → {selIdx + 1}</legend>
      <label>
        <span>belly thin</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={selPath.pctrl?.k ??
            (selStroke.points[selIdx].pressure +
              selStroke.points[selIdx + 1].pressure) /
              2}
          oninput={(e) => setPctrlK(+e.target.value)}
        />
        <output
          >{(
            selPath.pctrl?.k ??
            (selStroke.points[selIdx].pressure +
              selStroke.points[selIdx + 1].pressure) /
              2
          ).toFixed(2)}</output
        >
      </label>
      <div class="buttons">
        <button type="button" onclick={resetControl} disabled={!selPath.ctrl}
          >reset curve</button
        >
        <button type="button" onclick={resetPressure} disabled={!selPath.pctrl}
          >reset pressure</button
        >
      </div>
      <p class="hint">
        drag the blue square to bend the segment - it also sets where the belly
        sits. belly thin sets how thin the stroke gets there.
      </p>
    </fieldset>
  {/if}
</aside>

<style>
  section {
    max-width: 720px;
    aspect-ratio: 1 / 1;
    flex: 0 0 auto;
    overscroll-behavior: contain;
    touch-action: none;
    cursor: grab;
  }
  section:active {
    cursor: grabbing;
  }
  canvas {
    background: #fffce0;
    border-radius: 0.25rem;
    display: block;
    touch-action: none;
  }
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .viewport-tools {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    z-index: 2;
  }
  .vp-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    margin: 0;
    border: 1px solid rgba(0, 0, 0, 0.18);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.85);
    color: #333;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
  .viewport-zoom {
    position: absolute;
    bottom: 0.5rem;
    left: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    z-index: 2;
  }
  .zoom-pct {
    min-width: 3rem;
    padding: 0 0.5rem;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #333;
    border: 1px solid rgba(0, 0, 0, 0.18);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.85);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
  .vp-btn:hover {
    background: rgba(255, 255, 255, 1);
  }
  .vp-btn.active {
    background: rgba(40, 80, 220, 0.92);
    color: white;
    border-color: rgba(40, 80, 220, 1);
  }
  .code-dump {
    width: 100%;
    margin-top: 0.35rem;
    box-sizing: border-box;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.7rem;
    line-height: 1.35;
    resize: vertical;
    white-space: pre;
    overflow: auto;
    border: 1px solid rgba(0, 0, 0, 0.18);
    border-radius: 6px;
    background: #fbfbf5;
    color: #222;
  }
  .overlay circle {
    pointer-events: all;
    cursor: grab;
  }
  .overlay circle:active {
    cursor: grabbing;
  }
  .stroke-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
    max-height: 12rem;
    overflow-y: auto;
  }
  .stroke-list li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 0.3rem;
    padding: 0.1rem 0.1rem 0.1rem 0;
  }
  .stroke-list li.sel {
    border-color: rgba(40, 80, 220, 0.8);
    background: rgba(40, 80, 220, 0.08);
  }
  .stroke-pick {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 0.25rem 0.5rem;
    font-size: 0.85rem;
  }
  .stroke-pick .name {
    font-weight: 600;
  }
  .stroke-pick .meta {
    opacity: 0.6;
  }
  .slot-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
    max-height: 12rem;
    overflow-y: auto;
  }
  .slot-list li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 0.3rem;
    padding: 0.1rem 0.3rem 0.1rem 0;
  }
  .slot-list li.sel {
    border-color: rgba(40, 80, 220, 0.8);
    background: rgba(40, 80, 220, 0.08);
  }
  .slot-pick {
    flex: 1;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 0.25rem 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .slot-actions {
    display: inline-flex;
    gap: 0.15rem;
  }
  .slot-actions button {
    height: 1.6rem;
    padding: 0 0.4rem;
    line-height: 1;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .reorder {
    display: inline-flex;
    gap: 0.15rem;
  }
  .reorder button {
    width: 1.6rem;
    height: 1.6rem;
    padding: 0;
    line-height: 1;
    cursor: pointer;
  }
  .reorder button:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .hint {
    font-size: 0.8rem;
    opacity: 0.7;
    margin: 0.25rem 0 0;
  }
</style>
