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
    step,
    DEFAULT_CONNECT,
    DEFAULT_TIMING,
  } from "$lib/brush/engine";
  import { yong } from "$lib/brush/yong";
  import { long } from "$lib/brush/long";
  import { fu } from "$lib/brush/fu";
  import { maxSymbolId } from "$lib/brush/glyphs";
  import { bakeGLSL, bakeSegs } from "$lib/brush/bake";
  import { makeSlots, slotLabel } from "$lib/save-slots.js";
  import { makeRenderer } from "$lib/playgrounds/caligraphy";

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
  const SLOT_COUNT = 5;
  const slotStore = makeSlots({ prefix: "brush:slot:", count: SLOT_COUNT });

  // fixed save slots (as in /lego): slot i persisted as { data, at }.
  let slot = $state(0);
  let slots = $state(
    Array.from({ length: SLOT_COUNT }, () => ({ filled: false, at: null })),
  );
  let saved = $state(false);
  let loaded = $state(false);

  // seed samples: dropdown picks one to load fresh.
  const SAMPLES = {
    yong: { label: "永 (yong)", ...yong },
    long: { label: "龍 (long)", ...long },
    fu: { label: "福 (fu)", ...fu },
  };
  const INITIAL_SAMPLE = "yong";
  let sampleKey = $state(INITIAL_SAMPLE);

  let canvasEl;
  let glRenderer = null;
  let stageW = $state(600),
    stageH = $state(600);

  // initial: load yong as seed; uid floor bumped past stored ids.
  setUidFloor(SAMPLES[INITIAL_SAMPLE].maxId());
  const seedSymbol = SAMPLES[INITIAL_SAMPLE].symbol();
  let symbol = $state(seedSymbol);

  // selection
  let selKind = $state("path");
  let selStrokeId = $state(seedSymbol.strokes[0].id);
  let selIdx = $state(0);

  // brush params
  let baseRadius = $state(0.07);
  let showHandles = $state(true);
  let showGrid = $state(true);
  let view = $state({ zoom: 1, panX: 0, panY: 0 });

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

  // single bake shared by renderer + timeline: recomputes only when
  // symbol/connect/timing deep-change (bakeSegs reads them all), and its
  // identity doubles as the renderer's re-pack key.
  const baked = $derived(bakeSegs(symbol, { connect, timing }));

  // playback: anim=true renders partially up to pb.t; false = full edit view.
  let anim = $state(false);
  let pb = $state({ t: 0, playing: false });
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
    symbol = s.symbol();
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
      insertPointAfter(s, selIdx, nx, ny, randPressure());
      selectPoint(s.id, selIdx + 1);
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
    step(pb, dt, totalDuration); // pb.t mutation triggers the render effect
    if (pb.playing) rafId = requestAnimationFrame(tick);
    else stopRaf();
  }
  function play() {
    if (totalDuration <= 0) return;
    if (pb.t >= totalDuration) pb.t = 0; // replay from start
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
    pb.t = Math.max(0, Math.min(totalDuration, v));
  }
  function exitAnim() {
    pause();
    anim = false;
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

  // pressure curve control {k}: stroke belly thins/swells toward k.
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

  // backing store in device pixels (capped at 2x), CSS size stays stageW/stageH.
  // All pointer/overlay math stays in CSS px; only the canvas resolution scales.
  function syncCanvasSize() {
    if (!canvasEl || stageW <= 0 || stageH <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(stageW * dpr));
    const h = Math.max(1, Math.floor(stageH * dpr));
    if (canvasEl.width !== w || canvasEl.height !== h) {
      canvasEl.width = w;
      canvasEl.height = h;
    }
  }

  function render() {
    if (!canvasEl || stageW <= 0 || stageH <= 0) return;
    syncCanvasSize();
    if (!glRenderer) return; // device renderer is created async in onMount
    glRenderer.render(baked.segs, {
      baseRadius,
      view,
      showGrid,
      gridSize: 1.6,
      playhead: anim ? pb.t : undefined,
    });
  }

  $effect(() => {
    void baked; // deep-tracks symbol + connect + timing via bakeSegs
    void baseRadius;
    void showGrid;
    void view.zoom;
    void view.panX;
    void view.panY;
    void stageW;
    void stageH;
    void anim; // single render path: playback ticks/seeks mutate pb.t and
    void pb.t; // land here; nothing calls render() directly per frame.
    render();
  });

  // snapshot all editable state into a plain serializable object.
  function serializeState() {
    return {
      symbol,
      params: { baseRadius, showHandles, showGrid },
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
      setUidFloor(maxSymbolId(data.symbol));
      symbol = data.symbol;
    }
    if (data.params) {
      const p = data.params;
      if (typeof p.baseRadius === "number") baseRadius = p.baseRadius;
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

  // --- fixed save slots ---------------------------------------------------
  // scratch autosave (LS_KEY) is the live working copy; slots are explicit
  // snapshots via the shared slot store.
  function saveSlot() {
    slots = slotStore.save(slot, serializeState());
    saved = true;
    setTimeout(() => (saved = false), 1200);
  }
  function loadSlot() {
    const e = slotStore.read(slot);
    if (!e) return;
    applyState(e.payload);
    pause();
    anim = false;
    loaded = true;
    setTimeout(() => (loaded = false), 1200);
  }
  function clearSlot() {
    slots = slotStore.clear(slot);
  }

  onMount(() => {
    loadState();
    slots = slotStore.meta();
    let cancelled = false;
    syncCanvasSize();
    makeRenderer(canvasEl).then((r) => {
      if (cancelled) { r.dispose(); return; }
      glRenderer = r;
      render();
    });
    return () => {
      cancelled = true;
      clearTimeout(_saveTimer);
      if (_saveReady) saveState(); // flush a pending debounced autosave
      glRenderer?.dispose();
      glRenderer = null;
    };
  });

  // persist on change (after mount/load done), debounced: an un-debounced
  // save is a synchronous stringify + localStorage write per pointermove.
  let _saveReady = false;
  let _saveTimer = null;
  $effect(() => {
    void baked; // deep-tracks symbol + connect + timing via bakeSegs
    void baseRadius;
    void showHandles;
    void selKind;
    void selStrokeId;
    void selIdx;
    if (_saveReady) {
      clearTimeout(_saveTimer);
      _saveTimer = setTimeout(saveState, 300);
    } else _saveReady = true;
  });

  const totalDuration = $derived(baked.total);
  const selStroke = $derived(findStroke(selStrokeId));
  const selPoint = $derived(
    selKind === "point" && selStroke ? selStroke.points[selIdx] : null,
  );
  const selPath = $derived(
    selKind === "path" && selStroke ? selStroke.paths[selIdx] : null,
  );
  // belly slider value: explicit pctrl.k, else the straight-line default
  const selPathK = $derived(
    selPath
      ? (selPath.pctrl?.k ??
          (selStroke.points[selIdx].pressure +
            selStroke.points[selIdx + 1].pressure) /
            2)
      : 0,
  );
  // recomputed live during frame drags: glyphBBox reads every point, so the
  // derived deep-tracks the glyph by itself.
  const frameWorld = $derived(frameMode ? glyphBBox() : null);
</script>
<svelte:head>
  <title>Caligraphy</title>
</svelte:head>


<svelte:window onpointermove={onPointerMove} onpointerup={endDrag} />

<section
  bind:clientWidth={stageW}
  bind:clientHeight={stageH}
  onwheel={onWheel}
  onpointerdown={onStageDown}
>
  <canvas bind:this={canvasEl} style="width:{stageW}px;height:{stageH}px"
  ></canvas>
  <menu>
    <li><button
      type="button"
      aria-pressed={showGrid}
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
    </button></li>
    <li><button
      type="button"
      aria-pressed={showHandles && !anim}
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
    </button></li>
    <li><button
      type="button"
      aria-pressed={frameMode && !anim}
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
    </button></li>
  </menu>
  <menu onpointerdown={(e) => e.stopPropagation()}>
    <li><output>{Math.round(view.zoom * 100)}%</output></li>
    <li><button
      type="button"
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
    </button></li>
  </menu>
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
    <svg width={stageW} height={stageH}>
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
    <svg width={stageW} height={stageH}>
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
    <menu>
      <li><button type="button" onclick={spawnPoint} disabled={!showHandles}
        >+ point</button
      ></li>
      <li><button
        type="button"
        onclick={despawnPoint}
        disabled={!showHandles || selKind !== "point"}>− point</button
      ></li>
      <li><button
        type="button"
        onclick={splitStroke}
        disabled={!showHandles || !canSplit}
        title="cut this stroke at the selected point; the gap auto-connects with a silk thread"
        >split</button
      ></li>
    </menu>
    <menu>
      <li><button type="button" onclick={() => (showCode = !showCode)}>
        {showCode ? "hide code" : "show code"}
      </button></li>
      {#if showCode}
        <li><button
          type="button"
          title="copy to clipboard"
          onclick={() => navigator.clipboard?.writeText(codeText)}>copy</button
        ></li>
      {/if}
      <li><button
        type="button"
        onclick={bake}
        title="generate the shadertoy GLSL Seg[] table for this glyph"
        >bake glsl</button
      ></li>
      {#if bakeText}
        <li><button
          type="button"
          title="copy to clipboard"
          onclick={() => navigator.clipboard?.writeText(bakeText)}>copy</button
        ></li>
        <li><button
          type="button"
          title="clear baked output"
          onclick={() => {
            bakeText = "";
            bakeInfo = "";
          }}>clear</button
        ></li>
      {/if}
    </menu>
    {#if showCode}
      <textarea
        readonly
        rows="12"
        onpointerdown={(e) => e.stopPropagation()}>{codeText}</textarea
      >
    {/if}
    {#if bakeText}
      <small>baked: {bakeInfo}</small>
      <textarea
        readonly
        rows="14"
        onpointerdown={(e) => e.stopPropagation()}>{bakeText}</textarea
      >
    {/if}
  </fieldset>

  <fieldset>
    <legend>save slots</legend>
    <div role="group" aria-label="save slots">
      {#each slots as s, i (i)}
        <label title={slotLabel(s.at)}>
          <input type="radio" name="brush-slot" value={i} bind:group={slot} />
          {i + 1}{#if s.filled}<em>●</em>{/if}
        </label>
      {/each}
    </div>
    <menu>
      <li><button type="button" onclick={saveSlot}>{saved ? "✓ saved" : "💾 save"}</button></li>
      <li><button type="button" onclick={loadSlot} disabled={!slots[slot].filled}>{loaded ? "✓ loaded" : "📂 load"}</button></li>
      <li><button type="button" onclick={clearSlot} disabled={!slots[slot].filled}>🗑 clear</button></li>
    </menu>
  </fieldset>

  <fieldset>
    <legend>strokes</legend>
    <ol>
      {#each symbol.strokes as stroke, i (stroke.id)}
        <li>
          <label>
            <input
              type="radio"
              name="brush-stroke"
              checked={selKind !== "none" && selStrokeId === stroke.id}
              onclick={() => selectStroke(stroke.id)}
            />
            stroke {i + 1}
          </label>
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
        </li>
      {/each}
    </ol>
  </fieldset>

  <fieldset>
    <legend>playback</legend>
    <menu>
      <li><button type="button" onclick={togglePlay} disabled={totalDuration <= 0}>
        {pb.playing ? "⏸ pause" : "▶ play"}
      </button></li>
    </menu>
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
      <output>{pb.t.toFixed(2)}</output>
    </label>
    <label>
      <span>speed</span>
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
    <label>
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
          value={selPathK}
          oninput={(e) => setPctrlK(+e.target.value)}
        />
        <output>{selPathK.toFixed(2)}</output>
      </label>
      <menu>
        <li><button type="button" onclick={resetControl} disabled={!selPath.ctrl}
          >reset curve</button
        ></li>
        <li><button type="button" onclick={resetPressure} disabled={!selPath.pctrl}
          >reset pressure</button
        ></li>
      </menu>
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
    touch-action: none;
  }
  svg circle {
    pointer-events: all;
    cursor: grab;
  }
  svg circle:active {
    cursor: grabbing;
  }
  section > menu:first-of-type {
    top: 0.5rem;
    right: 0.5rem;
    flex-direction: column;
  }
  section > menu:last-of-type {
    bottom: 0.5rem;
    left: 0.5rem;
    align-items: center;
  }
  textarea {
    width: 100%;
    margin-top: 0.35rem;
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
  ol {
    max-height: 12rem;
    overflow-y: auto;
  }
</style>
