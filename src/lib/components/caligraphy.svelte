<script>
  import { onMount } from "svelte";
  import {
    makeStrokeRaw, makePoint, insertPointAfter, removePoint,
    resolveControl, setUidFloor,
  } from "$lib/brush/engine";
  import { yongSymbol, yongMaxId } from "$lib/brush/yong";
  import {
    drawSymbol, worldToScreen, screenToWorld,
  } from "$lib/brush/render2d";
  import { EASING_NAMES } from "$lib/brush/easing";

  const LS_KEY = "brush:state:v1";

  let canvasEl;
  let stageW = $state(600), stageH = $state(600);

  // initial: load yong as seed; uid floor bumped past stored ids.
  setUidFloor(yongMaxId());
  let symbol = $state(yongSymbol());

  // selection
  let selKind = $state("path");
  let selStrokeId = $state(symbol.strokes[0].id);
  let selIdx = $state(0);

  // brush params
  let baseRadius = $state(0.05);
  let speedRef   = $state(1.5);
  let dither     = $state(0.5);
  let sampleDensity = $state(50); // samples per world unit
  let showHandles = $state(true);
  let showGrid    = $state(true);
  let view = $state({ zoom: 1, panX: 0, panY: 0 });
  const color = "#111111";

  // drag state
  // mode: "point" (move single point), "edge" (translate segment),
  // "ctrl" (move control point)
  let dragMode = null;
  let dragStrokeId = null;
  let dragIdx = null;
  let dragLastWorld = null;

  function randPressure() { return 0.25 + Math.random() * 0.7; }

  function findStroke(id) {
    return symbol.strokes.find(s => s.id === id);
  }

  function selectStroke(id) {
    selKind = "stroke"; selStrokeId = id; selIdx = 0;
  }
  function selectPoint(id, i) {
    selKind = "point"; selStrokeId = id; selIdx = i;
  }
  function selectPath(id, i) {
    selKind = "path"; selStrokeId = id; selIdx = i;
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
      if (next) { nx = (p.x + next.x) / 2; ny = (p.y + next.y) / 2; }
      else {
        const prev = s.points[selIdx - 1];
        if (prev) {
          const dx = p.x - prev.x, dy = p.y - prev.y;
          nx = p.x + dx * 0.7; ny = p.y + dy * 0.7;
        } else {
          nx = p.x + 0.2; ny = p.y;
        }
      }
      const q = insertPointAfter(s, selIdx, nx, ny, randPressure());
      selectPoint(s.id, selIdx + 1);
      void q;
    } else {
      const s = makeStrokeRaw([
        makePoint((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4, randPressure()),
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
      const idx = symbol.strokes.findIndex(x => x.id === s.id);
      symbol.strokes.splice(idx, 1);
      const fallback = symbol.strokes[Math.max(0, idx - 1)];
      if (fallback) selectStroke(fallback.id);
      else { selKind = "stroke"; selStrokeId = -1; selIdx = 0; }
      return;
    }
    removePoint(s, selIdx);
    const newIdx = Math.min(selIdx, s.points.length - 1);
    selectPoint(s.id, newIdx);
  }

  function ws(p) { return worldToScreen(p, stageW, stageH, view); }

  function pointerWorld(e) {
    const r = canvasEl.getBoundingClientRect();
    return screenToWorld(e.clientX - r.left, e.clientY - r.top, stageW, stageH, view);
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
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const before = screenToWorld(sx, sy, stageW, stageH, view);
    const factor = Math.exp(-e.deltaY * 0.0015);
    const newZoom = Math.max(0.2, Math.min(20, view.zoom * factor));
    view.zoom = newZoom;
    const after = screenToWorld(sx, sy, stageW, stageH, view);
    view.panX += before.x - after.x;
    view.panY += before.y - after.y;
  }
  function resetView() { view.zoom = 1; view.panX = 0; view.panY = 0; }
  function onPointerDownPoint(e, strokeId, i) {
    e.preventDefault(); e.stopPropagation();
    dragMode = "point"; dragStrokeId = strokeId; dragIdx = i;
    dragLastWorld = pointerWorld(e);
    selectPoint(strokeId, i);
  }
  function onPointerDownEdge(e, strokeId, i) {
    e.preventDefault(); e.stopPropagation();
    selectPath(strokeId, i);
    dragMode = "edge"; dragStrokeId = strokeId; dragIdx = i;
    dragLastWorld = pointerWorld(e);
  }
  function onPointerDownHandle(e, strokeId, i) {
    e.preventDefault(); e.stopPropagation();
    selectPath(strokeId, i);
    dragMode = "ctrl"; dragStrokeId = strokeId; dragIdx = i;
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
      const tot = Math.hypot(e.clientX - dragDownScreen.x, e.clientY - dragDownScreen.y);
      if (tot > 3) dragMoved = true;
      const aspect = stageW / stageH;
      view.panX -= (dx / stageW) * 2 * aspect / view.zoom;
      view.panY += (dy / stageH) * 2 / view.zoom;
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
      a.x += dx; a.y += dy;
      b.x += dx; b.y += dy;
      const path = s.paths[dragIdx];
      if (path.ctrl) { path.ctrl.x += dx; path.ctrl.y += dy; }
    } else if (dragMode === "ctrl") {
      s.paths[dragIdx].ctrl = { x: w.x, y: w.y };
    }
    dragLastWorld = w;
  }
  function endDrag() {
    const wasPan = dragMode === "pan";
    const wasClick = wasPan && !dragMoved;
    dragMode = null; dragStrokeId = null; dragIdx = null;
    dragLastWorld = null; dragLastScreen = null; dragDownScreen = null;
    dragMoved = false;
    if (wasClick) deselectAll();
  }
  function resetControl() {
    const s = findStroke(selStrokeId);
    if (!s || selKind !== "path") return;
    s.paths[selIdx].ctrl = null;
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
    const ctx = canvasEl.getContext("2d");
    drawSymbol(ctx, stageW, stageH, symbol, {
      baseRadius, speedRef, dither, sampleDensity, color,
      view, showGrid, bg: "#fffce0",
    });
  }

  // deep-track symbol via JSON.stringify; cheap for small models
  $effect(() => {
    // deep read all state
    void JSON.stringify(symbol);
    void baseRadius; void speedRef; void dither;
    void sampleDensity; void showGrid;
    void view.zoom; void view.panX; void view.panY;
    void stageW; void stageH;
    render();
  });

  // migrate legacy paths (h1/h2/tension) to single ctrl point in place
  function migrateSymbol(sym) {
    for (const s of sym.strokes || []) {
      for (const p of s.paths || []) {
        if (p.ctrl !== undefined) continue;
        p.ctrl = (p.h1 && p.h2)
          ? { x: (p.h1.x + p.h2.x) / 2, y: (p.h1.y + p.h2.y) / 2 }
          : null;
        delete p.h1; delete p.h2; delete p.tension;
      }
    }
  }

  function loadState() {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.symbol && Array.isArray(data.symbol.strokes)) {
        // bump uid past highest stored id
        let maxId = 0;
        for (const s of data.symbol.strokes) {
          if (s.id > maxId) maxId = s.id;
          for (const p of s.points || []) if (p.id > maxId) maxId = p.id;
        }
        setUidFloor(maxId);
        migrateSymbol(data.symbol);
        symbol = data.symbol;
      }
      if (data.params) {
        const p = data.params;
        if (typeof p.baseRadius    === "number") baseRadius    = p.baseRadius;
        if (typeof p.speedRef      === "number") speedRef      = p.speedRef;
        if (typeof p.dither        === "number") dither        = p.dither;
        if (typeof p.sampleDensity === "number") sampleDensity = p.sampleDensity;
        if (typeof p.showHandles   === "boolean") showHandles  = p.showHandles;
        if (typeof p.showGrid      === "boolean") showGrid     = p.showGrid;
      }
      if (data.view && typeof data.view.zoom === "number") {
        view.zoom = data.view.zoom;
        view.panX = data.view.panX || 0;
        view.panY = data.view.panY || 0;
      }
      if (data.selection) {
        const sel = data.selection;
        const stroke = symbol.strokes.find(s => s.id === sel.selStrokeId);
        if (stroke) {
          selStrokeId = sel.selStrokeId;
          selKind = sel.selKind || "stroke";
          selIdx = Math.min(Math.max(0, sel.selIdx | 0),
            Math.max(0, (selKind === "path" ? stroke.paths.length : stroke.points.length) - 1));
        }
      }
    } catch (e) {
      console.warn("brush: failed to load saved state", e);
    }
  }

  function saveState() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        symbol,
        params: { baseRadius, speedRef, dither, sampleDensity, showHandles, showGrid },
        view: { zoom: view.zoom, panX: view.panX, panY: view.panY },
        selection: { selKind, selStrokeId, selIdx },
      }));
    } catch (e) { /* quota/private mode */ }
  }

  onMount(() => { loadState(); render(); });

  // persist on every change (after mount/load done)
  let _saveReady = false;
  $effect(() => {
    void JSON.stringify(symbol);
    void baseRadius; void speedRef; void dither;
    void sampleDensity; void showHandles;
    void selKind; void selStrokeId; void selIdx;
    if (_saveReady) saveState();
    else _saveReady = true;
  });

  const selStroke = $derived(findStroke(selStrokeId));
  const selPoint = $derived(
    selKind === "point" && selStroke ? selStroke.points[selIdx] : null
  );
  const selPath = $derived(
    selKind === "path" && selStroke ? selStroke.paths[selIdx] : null
  );
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={endDrag} />

<div class="brush-demo">
  <div class="stage" bind:clientWidth={stageW} bind:clientHeight={stageH}
       onwheel={onWheel} onpointerdown={onStageDown}>
    <canvas bind:this={canvasEl}
            style="width:{stageW}px;height:{stageH}px"></canvas>
    <div class="viewport-tools">
      <button type="button" class="vp-btn"
              class:active={showGrid}
              title={showGrid ? "hide 米 grid" : "show 米 grid"}
              onpointerdown={(e) => e.stopPropagation()}
              onclick={() => (showGrid = !showGrid)}
              aria-label="toggle grid">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
             stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <rect x="3" y="3" width="18" height="18" rx="1.5" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="3" x2="21" y2="21" />
          <line x1="21" y1="3" x2="3" y2="21" />
        </svg>
      </button>
      <button type="button" class="vp-btn"
              class:active={showHandles}
              title={showHandles ? "hide control points" : "show control points"}
              onpointerdown={(e) => e.stopPropagation()}
              onclick={() => (showHandles = !showHandles)}
              aria-label="toggle edit">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
             stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 4.5 19 9 8 20H3.5v-4.5z" />
          <line x1="13" y1="6" x2="18" y2="11" />
        </svg>
      </button>
    </div>
    {#if showHandles && stageW > 0}
      <svg class="overlay" width={stageW} height={stageH}>
        <!-- pass 1: edges (preview + hit area) for every segment of every stroke -->
        {#each symbol.strokes as stroke (stroke.id)}
          {@const isActive = selKind !== "none" && stroke.id === selStrokeId}
          {#each stroke.points.slice(0, -1) as p, i}
            {@const a = ws(p)}
            {@const b = ws(stroke.points[i + 1])}
            {@const cs = ws(resolveControl(stroke, i))}
            {@const edgeSelected = selKind === "path" && selStrokeId === stroke.id && selIdx === i}
            <path d={`M ${a.x} ${a.y} Q ${cs.x} ${cs.y}, ${b.x} ${b.y}`}
                  fill="none"
                  stroke={edgeSelected ? "rgba(220,40,40,0.75)"
                        : isActive    ? "rgba(220,40,40,0.45)"
                        :               "rgba(120,120,120,0.4)"}
                  stroke-width={edgeSelected ? 3 : 1.5}
                  stroke-dasharray="4 3"
                  style="pointer-events:none;" />
            <path d={`M ${a.x} ${a.y} Q ${cs.x} ${cs.y}, ${b.x} ${b.y}`}
                  fill="none" stroke="transparent" stroke-width="16"
                  style="cursor:move; pointer-events:stroke;"
                  onpointerdown={(e) => onPointerDownEdge(e, stroke.id, i)} />
          {/each}
        {/each}

        <!-- pass 2: control point of selected edge (rendered on top of all edges) -->
        {#if selKind === "path" && selStroke && selPath}
          {@const a = ws(selStroke.points[selIdx])}
          {@const b = ws(selStroke.points[selIdx + 1])}
          {@const cs = ws(resolveControl(selStroke, selIdx))}
          <line x1={a.x} y1={a.y} x2={cs.x} y2={cs.y}
                stroke="rgba(40,80,220,0.45)" stroke-width="1"
                style="pointer-events:none;" />
          <line x1={b.x} y1={b.y} x2={cs.x} y2={cs.y}
                stroke="rgba(40,80,220,0.45)" stroke-width="1"
                style="pointer-events:none;" />
          <rect x={cs.x - 6} y={cs.y - 6} width="12" height="12"
                fill="rgba(40,140,220,0.95)" stroke="white" stroke-width="2"
                style="cursor:grab; pointer-events:all;"
                onpointerdown={(e) => onPointerDownHandle(e, selStrokeId, selIdx)} />
        {/if}

        <!-- pass 3: points (rendered last, on top of everything) -->
        {#each symbol.strokes as stroke (stroke.id)}
          {@const isActive = selKind !== "none" && stroke.id === selStrokeId}
          {#each stroke.points as pt, i}
            {@const sp = ws(pt)}
            {@const r = 5 + pt.pressure * 7}
            <circle cx={sp.x} cy={sp.y} r={r}
                    fill={
                      selKind === "point" && selStrokeId === stroke.id && selIdx === i
                        ? "rgba(255,200,40,0.95)"
                        : i === 0 ? "rgba(40,160,40,0.85)"
                        : i === stroke.points.length - 1 ? "rgba(40,80,220,0.85)"
                        : "rgba(220,40,40,0.85)"
                    }
                    stroke={isActive ? "white" : "rgba(255,255,255,0.6)"} stroke-width="2"
                    onpointerdown={(e) => onPointerDownPoint(e, stroke.id, i)} />
            <text x={sp.x + r + 2} y={sp.y - r - 2} font-size="10"
                  fill="#222" font-weight="600"
                  style="pointer-events:none;">{i}</text>
          {/each}
        {/each}
      </svg>
    {/if}
  </div>

  <div class="controls">
    <fieldset>
      <legend>symbol</legend>
      <div class="buttons">
        <button type="button" onclick={spawnPoint}>+ point</button>
        <button type="button" onclick={despawnPoint}
                disabled={selKind !== "point"}>− point</button>
      </div>
    </fieldset>

    <fieldset>
      <legend>view</legend>
      <label>
        <span>zoom</span>
        <input type="range" min="0.2" max="8" step="0.01" bind:value={view.zoom} />
        <output>{view.zoom.toFixed(2)}×</output>
      </label>
      <div class="buttons">
        <button type="button" onclick={resetView}>reset view</button>
      </div>
    </fieldset>

    <fieldset>
      <legend>brush</legend>
      <label>
        <span>base radius</span>
        <input type="range" min="0.005" max="0.2" step="0.001" bind:value={baseRadius} />
        <output>{baseRadius.toFixed(3)}</output>
      </label>
      <label>
        <span>speed ref</span>
        <input type="range" min="0.2" max="8" step="0.01" bind:value={speedRef} />
        <output>{speedRef.toFixed(2)}</output>
      </label>
      <label>
        <span>dither</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={dither} />
        <output>{dither.toFixed(2)}</output>
      </label>
      <label>
        <span>samples/dist</span>
        <input type="range" min="10" max="400" step="1" bind:value={sampleDensity} />
        <output>{sampleDensity}</output>
      </label>
    </fieldset>

    {#if selPoint}
      <fieldset>
        <legend>point #{selIdx}</legend>
        <label>
          <span>x</span>
          <input type="range" min="-1.5" max="1.5" step="0.001" bind:value={selPoint.x} />
          <output>{selPoint.x.toFixed(2)}</output>
        </label>
        <label>
          <span>y</span>
          <input type="range" min="-1" max="1" step="0.001" bind:value={selPoint.y} />
          <output>{selPoint.y.toFixed(2)}</output>
        </label>
        <label>
          <span>pressure</span>
          <input type="range" min="0" max="1" step="0.01" bind:value={selPoint.pressure} />
          <output>{selPoint.pressure.toFixed(2)}</output>
        </label>
      </fieldset>
    {/if}

    {#if selPath}
      <fieldset>
        <legend>path #{selIdx} → {selIdx + 1}</legend>
        <label>
          <span>time ease</span>
          <select bind:value={selPath.timeEase}>
            {#each EASING_NAMES as n}<option value={n}>{n}</option>{/each}
          </select>
          <output></output>
        </label>
        <label>
          <span>pressure ease</span>
          <select bind:value={selPath.pressureEase}>
            {#each EASING_NAMES as n}<option value={n}>{n}</option>{/each}
          </select>
          <output></output>
        </label>
        <label>
          <span>duration</span>
          <input type="range" min="0.05" max="4" step="0.01" bind:value={selPath.duration} />
          <output>{selPath.duration.toFixed(2)}</output>
        </label>
        <div class="buttons">
          <button type="button" onclick={resetControl}
                  disabled={!selPath.ctrl}>reset curve</button>
        </div>
        <p class="hint">
          drag the blue square to bend the segment. reset returns it to the auto curve.
        </p>
      </fieldset>
    {/if}
  </div>
</div>

<style>
  .brush-demo {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  @media (min-width: 768px) {
    .brush-demo { flex-direction: row; }
  }
  .stage {
    position: relative;
    width: 100%;
    max-width: 720px;
    aspect-ratio: 1 / 1;
    flex: 0 0 auto;
    overscroll-behavior: contain;
    touch-action: none;
    cursor: grab;
  }
  .stage:active { cursor: grabbing; }
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
    border: 1px solid rgba(0,0,0,0.18);
    border-radius: 6px;
    background: rgba(255,255,255,0.85);
    color: #333;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  }
  .vp-btn:hover { background: rgba(255,255,255,1); }
  .vp-btn.active {
    background: rgba(40,80,220,0.92);
    color: white;
    border-color: rgba(40,80,220,1);
  }
  .overlay circle {
    pointer-events: all;
    cursor: grab;
  }
  .overlay circle:active { cursor: grabbing; }
  .controls {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding: 0.5rem 0;
    min-width: 280px;
  }
  label {
    display: grid;
    grid-template-columns: 6rem 1fr 3rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  label.check { grid-template-columns: auto 1fr; }
  input[type="range"] { width: 100%; }
  fieldset {
    border: 1px solid rgba(128,128,128,0.3);
    border-radius: 0.35rem;
    padding: 0.5rem 0.75rem 0.6rem;
    margin: 0;
    display: grid;
    gap: 0.4rem;
  }
  legend {
    padding: 0 0.4rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.7;
  }
  .buttons { display: flex; gap: 0.5rem; }
  .hint {
    font-size: 0.8rem;
    opacity: 0.7;
    margin: 0.25rem 0 0;
  }
</style>
