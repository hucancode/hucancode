<script>
  import { onMount } from "svelte";
  import Scene from "$lib/components/playground-canvas.svelte";
  import { resolveControl } from "$lib/brush/engine";
  import { bakeGLSL, bakeSegs } from "$lib/brush/bake";
  import * as caligraphy from "$lib/playgrounds/caligraphy";
  import {
    SAMPLES,
    makeDoc,
    loadSample,
    selectStroke,
    selStroke,
    selPoint,
    selPath,
    selPathK,
    spawnPoint,
    despawnPoint,
    moveStroke,
    canSplit,
    splitStroke,
    glyphBBox,
    resetControl,
    setPctrlK,
    resetPressure,
  } from "$lib/playgrounds/caligraphy/model.js";
  import { worldToScreen, resetView } from "$lib/playgrounds/caligraphy/view.js";
  import { makeDrag } from "$lib/playgrounds/caligraphy/drag.js";
  import { makePlayback, togglePlay, seek, exitAnim, tick } from "$lib/playgrounds/caligraphy/playback.js";
  import * as store from "$lib/playgrounds/caligraphy/persist.js";

  let scene = $state(null);
  let stageEl = $state();
  let stageW = $state(600), stageH = $state(600);

  const doc = $state(makeDoc());
  const drag = makeDrag(() => stageEl, doc);
  const autosave = store.makeAutosave(doc);

  let pb = $state(makePlayback());
  let sampleKey = $state("yong");
  let frameMode = $state(false); // edit the whole glyph (translate + uniform scale)

  // fixed save slots: slot i persisted as { data, at }.
  let slot = $state(0);
  let slots = $state(Array.from({ length: store.SLOT_COUNT }, () => ({ filled: false, at: null })));
  let saved = $state(false);
  let loaded = $state(false);

  // single bake shared by renderer + timeline: recomputes only when
  // symbol/connect/timing deep-change (bakeSegs reads them all), and its
  // identity doubles as the renderer's re-pack key.
  const baked = $derived(bakeSegs(doc.symbol, { connect: doc.connect, timing: doc.timing }));
  const total = $derived(baked.total);
  const curStroke = $derived(selStroke(doc));
  const curPoint = $derived(selPoint(doc));
  const curPath = $derived(selPath(doc));
  const curK = $derived(selPathK(doc));
  const splittable = $derived(canSplit(doc));
  // recomputed live during frame drags: glyphBBox reads every point, so the
  // derived deep-tracks the glyph by itself.
  const frameWorld = $derived(frameMode ? glyphBBox(doc.symbol) : null);

  const ws = (p) => worldToScreen(p, stageW, stageH, doc.view);

  // show-code panel: dump the live symbol.strokes array as JSON.
  let showCode = $state(false);
  const codeText = $derived(JSON.stringify(doc.symbol.strokes, null, 2));

  // bake panel: emit the shadertoy GLSL Seg[] table for the live symbol.
  let bakeText = $state("");
  let bakeInfo = $state("");
  function bake() {
    const r = bakeGLSL(doc.symbol, {
      connect: { enabled: doc.connect.enabled, thread: doc.connect.thread },
      timing: { speed: doc.timing.speed },
      glyph: SAMPLES[sampleKey]?.label ?? "?",
    });
    bakeText = r.glsl;
    bakeInfo = `${r.segCount} segs / ${r.strokeCount} strokes / ${r.total.toFixed(3)}s`;
  }

  function pickSample(key) {
    if (!loadSample(doc, key)) return;
    sampleKey = key;
    exitAnim(pb);
  }

  function onSaveSlot() {
    slots = store.saveSlot(slot, doc);
    saved = true;
    setTimeout(() => (saved = false), 1200);
  }
  function onLoadSlot() {
    if (!store.loadSlot(slot, doc)) return;
    exitAnim(pb);
    loaded = true;
    setTimeout(() => (loaded = false), 1200);
  }

  onMount(() => {
    store.loadScratch(doc);
    slots = store.slotMeta();
    return () => autosave.flush(); // flush a pending debounced autosave
  });

  $effect(() => {
    scene?.apply({
      segs: baked.segs,
      baseRadius: doc.baseRadius,
      showGrid: doc.showGrid,
      view: { zoom: doc.view.zoom, panX: doc.view.panX, panY: doc.view.panY },
      playhead: pb.anim ? pb.t : undefined,
    });
  });

  // persist on change (after mount/load done), debounced.
  $effect(() => {
    void baked; // deep-tracks symbol + connect + timing via bakeSegs
    void doc.baseRadius;
    void doc.showHandles;
    void doc.sel.kind;
    void doc.sel.strokeId;
    void doc.sel.idx;
    autosave.schedule();
  });
</script>

<svelte:head>
  <title>Caligraphy</title>
</svelte:head>

<svelte:window onpointermove={drag.move} onpointerup={drag.up} />

<section
  data-stage="square grab"
  bind:this={stageEl}
  bind:clientWidth={stageW}
  bind:clientHeight={stageH}
  onwheel={drag.wheel}
  onpointerdown={drag.stageDown}
>
  <Scene bind:this={scene} scene={caligraphy} id="caligraphy" onFrame={(dt) => tick(pb, dt, total)} />
  <menu>
    <li><button
      type="button"
      aria-pressed={doc.showGrid}
      title={doc.showGrid ? "hide 米 grid" : "show 米 grid"}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => (doc.showGrid = !doc.showGrid)}
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
      aria-pressed={doc.showHandles && !pb.anim}
      title={pb.anim
        ? "back to edit"
        : doc.showHandles
          ? "hide control points"
          : "show control points"}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => {
        if (pb.anim) {
          exitAnim(pb);
          doc.showHandles = true;
        } else doc.showHandles = !doc.showHandles;
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
      aria-pressed={frameMode && !pb.anim}
      title={frameMode ? "exit frame mode" : "frame mode (scale/move whole glyph)"}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => {
        if (pb.anim) exitAnim(pb);
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
    <li><output>{Math.round(doc.view.zoom * 100)}%</output></li>
    <li><button
      type="button"
      title="reset zoom"
      onclick={() => resetView(doc.view)}
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
  {#if frameMode && !pb.anim && stageW > 0 && frameWorld}
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
        onpointerdown={drag.frameMove}
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
          onpointerdown={(e) => drag.frameScale(e, h.ax, h.ay)}
        />
      {/each}
    </svg>
  {/if}
  {#if doc.showHandles && !pb.anim && !frameMode && stageW > 0}
    <svg width={stageW} height={stageH}>
      <!-- pass 1: edges (preview + hit area) for every segment of every stroke -->
      {#each doc.symbol.strokes as stroke (stroke.id)}
        {@const isActive = doc.sel.kind !== "none" && stroke.id === doc.sel.strokeId}
        {#each stroke.points.slice(0, -1) as p, i}
          {@const a = ws(p)}
          {@const b = ws(stroke.points[i + 1])}
          {@const cs = ws(resolveControl(stroke, i))}
          {@const edgeSelected =
            doc.sel.kind === "path" && doc.sel.strokeId === stroke.id && doc.sel.idx === i}
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
            onpointerdown={(e) => drag.edge(e, stroke.id, i)}
          />
        {/each}
      {/each}

      <!-- pass 2: control point of selected edge (rendered on top of all edges) -->
      {#if curPath && curStroke}
        {@const a = ws(curStroke.points[doc.sel.idx])}
        {@const b = ws(curStroke.points[doc.sel.idx + 1])}
        {@const cs = ws(resolveControl(curStroke, doc.sel.idx))}
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
          onpointerdown={(e) => drag.handle(e, doc.sel.strokeId, doc.sel.idx)}
        />
      {/if}

      <!-- pass 3: points (rendered last, on top of everything) -->
      {#each doc.symbol.strokes as stroke (stroke.id)}
        {@const isActive = doc.sel.kind !== "none" && stroke.id === doc.sel.strokeId}
        {#each stroke.points as pt, i}
          {@const sp = ws(pt)}
          {@const r = 5 + pt.pressure * 7}
          <circle
            cx={sp.x}
            cy={sp.y}
            {r}
            fill={doc.sel.kind === "point" && doc.sel.strokeId === stroke.id && doc.sel.idx === i
              ? "rgba(255,200,40,0.95)"
              : i === 0
                ? "rgba(40,160,40,0.85)"
                : i === stroke.points.length - 1
                  ? "rgba(40,80,220,0.85)"
                  : "rgba(220,40,40,0.85)"}
            stroke={isActive ? "white" : "rgba(255,255,255,0.6)"}
            stroke-width="2"
            onpointerdown={(e) => drag.point(e, stroke.id, i)}
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
      <select value={sampleKey} onchange={(e) => pickSample(e.target.value)}>
        {#each Object.entries(SAMPLES) as [key, s]}
          <option value={key}>{s.label}</option>
        {/each}
      </select>
    </label>
    <menu>
      <li><button type="button" onclick={() => spawnPoint(doc)} disabled={!doc.showHandles}
        >+ point</button
      ></li>
      <li><button
        type="button"
        onclick={() => despawnPoint(doc)}
        disabled={!doc.showHandles || doc.sel.kind !== "point"}>− point</button
      ></li>
      <li><button
        type="button"
        onclick={() => splitStroke(doc)}
        disabled={!doc.showHandles || !splittable}
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
        title="generate the shadertoy GLSL Seg[] table for this glyph">bake glsl</button
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
      <textarea readonly rows="12" onpointerdown={(e) => e.stopPropagation()}>{codeText}</textarea>
    {/if}
    {#if bakeText}
      <small>baked: {bakeInfo}</small>
      <textarea readonly rows="14" onpointerdown={(e) => e.stopPropagation()}>{bakeText}</textarea>
    {/if}
  </fieldset>

  <fieldset>
    <legend>save slots</legend>
    <menu role="group" aria-label="save slots">
      {#each slots as s, i (i)}
        <li><label title={store.slotLabel(s.at)}>
          <input type="radio" name="brush-slot" value={i} bind:group={slot} />
          {i + 1}{#if s.filled}<em>●</em>{/if}
        </label></li>
      {/each}
    </menu>
    <menu>
      <li><button type="button" onclick={onSaveSlot}>{saved ? "✓ saved" : "💾 save"}</button></li>
      <li><button type="button" onclick={onLoadSlot} disabled={!slots[slot].filled}
        >{loaded ? "✓ loaded" : "📂 load"}</button
      ></li>
      <li><button
        type="button"
        onclick={() => (slots = store.clearSlot(slot))}
        disabled={!slots[slot].filled}>🗑 clear</button
      ></li>
    </menu>
  </fieldset>

  <fieldset>
    <legend>strokes</legend>
    <ol>
      {#each doc.symbol.strokes as stroke, i (stroke.id)}
        <li>
          <label>
            <input
              type="radio"
              name="brush-stroke"
              checked={doc.sel.kind !== "none" && doc.sel.strokeId === stroke.id}
              onclick={() => selectStroke(doc.sel, stroke.id)}
            />
            stroke {i + 1}
          </label>
          <button
            type="button"
            title="move earlier"
            disabled={i === 0}
            onclick={() => moveStroke(doc.symbol, i, -1)}>▲</button
          >
          <button
            type="button"
            title="move later"
            disabled={i === doc.symbol.strokes.length - 1}
            onclick={() => moveStroke(doc.symbol, i, 1)}>▼</button
          >
        </li>
      {/each}
    </ol>
  </fieldset>

  <fieldset>
    <legend>playback</legend>
    <menu>
      <li><button type="button" onclick={() => togglePlay(pb, total)} disabled={total <= 0}>
        {pb.playing ? "⏸ pause" : "▶ play"}
      </button></li>
    </menu>
    <label>
      <span>seek</span>
      <input
        type="range"
        min="0"
        max={total || 0.001}
        step="0.01"
        value={pb.t}
        oninput={(e) => seek(pb, total, +e.target.value)}
      />
      <output>{pb.t.toFixed(2)}</output>
    </label>
    <label>
      <span>speed</span>
      <input type="range" min="0.2" max="4" step="0.05" bind:value={doc.timing.speed} />
      <output>{doc.timing.speed.toFixed(2)}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>brush</legend>
    <label>
      <input type="checkbox" bind:checked={doc.connect.enabled} />
      <span>auto-thread strokes</span>
    </label>
    <label>
      <span>thread width</span>
      <input
        type="range"
        min="0.0"
        max="0.6"
        step="0.01"
        bind:value={doc.connect.thread}
        disabled={!doc.connect.enabled}
      />
      <output>{doc.connect.thread.toFixed(2)}</output>
    </label>
    <label>
      <span>base radius</span>
      <input type="range" min="0.005" max="0.2" step="0.001" bind:value={doc.baseRadius} />
      <output>{doc.baseRadius.toFixed(3)}</output>
    </label>
  </fieldset>

  {#if curPoint}
    <fieldset>
      <legend>point #{doc.sel.idx}</legend>
      <label>
        <span>x</span>
        <input type="range" min="-1.5" max="1.5" step="0.001" bind:value={curPoint.x} />
        <output>{curPoint.x.toFixed(2)}</output>
      </label>
      <label>
        <span>y</span>
        <input type="range" min="-1" max="1" step="0.001" bind:value={curPoint.y} />
        <output>{curPoint.y.toFixed(2)}</output>
      </label>
      <label>
        <span>pressure</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={curPoint.pressure} />
        <output>{curPoint.pressure.toFixed(2)}</output>
      </label>
    </fieldset>
  {/if}

  {#if curPath}
    <fieldset>
      <legend>path #{doc.sel.idx} → {doc.sel.idx + 1}</legend>
      <label>
        <span>belly thin</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={curK}
          oninput={(e) => setPctrlK(doc, +e.target.value)}
        />
        <output>{curK.toFixed(2)}</output>
      </label>
      <menu>
        <li><button type="button" onclick={() => resetControl(doc)} disabled={!curPath.ctrl}
          >reset curve</button
        ></li>
        <li><button type="button" onclick={() => resetPressure(doc)} disabled={!curPath.pctrl}
          >reset pressure</button
        ></li>
      </menu>
    </fieldset>
  {/if}
</aside>

<style>
  section {
    max-width: 720px;
    flex: 0 0 auto;
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
