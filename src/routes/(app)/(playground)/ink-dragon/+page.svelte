<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import * as ink from "$lib/playgrounds/ink-dragon";

  let scene = $state(null);
  let sectionEl;
  let w = $state(1);
  let h = $state(1);

  let width = $state(0.05);
  let widthEnd = $state(0.1);
  let showPoints = $state(true);
  let showPath = $state(false);
  let headSize = $state(0.15);
  let whiskerWidth = $state(0.015);
  let whiskerSegs = $state(8);
  let whiskerLen = $state(2.5);
  let whiskerDamping = $state(0.88);

  let vertexCount = $state(16);
  let bodyLen = $state(1.2);
  let propagationSpeed = $state(0.6);
  let maxBendDeg = $state(60);

  let autoFly = $state(false);
  let autoSpeed = $state(2.0);

  let zoom = $state(1);
  // mirrors camera.epoch so the SVG overlay reprojects on any pan/zoom/reset
  let camEpoch = $state(0);
  // scratch, refilled in place every frame by the lib (no per-frame allocation)
  let overlay = $state({ body: [], whiskerL: [], whiskerR: [] });
  let path = $state({ circles: [], cursor: null, cursorOn: false });

  $effect(() => {
    scene?.apply({
      width,
      widthEnd,
      whiskerWidth,
      headSize,
      vertexCount,
      bodyLen,
      propagationSpeed,
      maxBendDeg,
      whiskerSegs,
      whiskerLen,
      whiskerDamping,
      autoFly,
      autoSpeed,
    });
  });

  function onFrame() {
    zoom = ink.camera.zoom;
    camEpoch = ink.camera.epoch; // reassigning the same value is a no-op, so this only retriggers on change
    if (showPoints) ink.getOverlay(overlay);
    if (showPath) ink.getPath(path);
  }

  // read camEpoch so every projection re-runs on any camera move (pan or zoom)
  const ws = (p) => (camEpoch, ink.worldToScreen(p, w, h));

  // wheel = zoom at cursor; grabbing the dragon head drags the tip, grabbing
  // empty space pans (always pans while auto-fly drives the tip).
  function onWheel(e) {
    e.preventDefault();
    ink.camera.zoomAtEvent(e, e.deltaY);
  }

  let dragging = false;
  let panning = false;
  let panLast = null;
  function onPointerDown(e) {
    e.preventDefault();
    sectionEl.setPointerCapture(e.pointerId);
    const p = ink.eventToWorld(e);
    if (!autoFly && ink.grabHead(p)) {
      dragging = true;
      scene?.apply({ tip: p });
    } else {
      panning = true;
      panLast = { x: e.clientX, y: e.clientY };
    }
  }
  function onPointerMove(e) {
    if (panning) {
      ink.camera.panPixels(e.clientX - panLast.x, e.clientY - panLast.y);
      panLast = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!dragging) return;
    scene?.apply({ tip: ink.eventToWorld(e) });
  }
  function onPointerUp(e) {
    if (!panning && !dragging) return;
    if (dragging) scene?.apply({ tip: null });
    panning = dragging = false;
    panLast = null;
    try {
      sectionEl.releasePointerCapture(e.pointerId);
    } catch {}
  }
</script>

<svelte:head>
  <title>Ink Dragon</title>
</svelte:head>

<section
  data-stage="square grab"
  bind:this={sectionEl}
  bind:clientWidth={w}
  bind:clientHeight={h}
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
>
  <Scene bind:this={scene} scene={ink} id="ink-dragon" {onFrame} />
  <menu onpointerdown={(e) => e.stopPropagation()}>
    <li><output>{Math.round(zoom * 100)}%</output></li>
    <li><button type="button" title="reset view" onclick={() => ink.camera.reset()} aria-label="reset view">
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
  {#if showPath && path.circles.length > 0}
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <!-- rosette frame: world radius -> px via half-height * zoom -->
      {#each path.circles as c}
        {@const s = ws({ x: c.cx, y: c.cy })}
        <circle
          fill="none"
          style="stroke: rgba(80, 160, 255, 0.55)"
          stroke-dasharray="4 4"
          cx={s.x}
          cy={s.y}
          r={(c.r * zoom * h) / 2}
        />
      {/each}
      {#if path.cursorOn}
        {@const s = ws(path.cursor)}
        <circle
          fill="rgba(255, 220, 60, 0.95)"
          style="stroke: rgba(40, 40, 40, 0.9)"
          cx={s.x}
          cy={s.y}
          r="6"
        />
      {/if}
    </svg>
  {/if}
  {#if showPoints && overlay.body.length > 0}
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline
        stroke="rgba(180, 60, 60, 0.45)"
        stroke-dasharray="4 4"
        points={overlay.body
          .map((p) => {
            const s = ws(p);
            return `${s.x},${s.y}`;
          })
          .join(" ")}
      />
      {#each overlay.body as p, i}
        {@const s = ws(p)}
        <circle
          cx={s.x}
          cy={s.y}
          r={i === overlay.body.length - 1 ? 10 : 4}
          fill={i === 0
            ? "rgba(50, 180, 80, 0.95)"
            : i === overlay.body.length - 1
              ? "rgba(50, 100, 220, 0.95)"
              : "rgba(220, 50, 50, 0.85)"}
        />
      {/each}
      {#each [overlay.whiskerL, overlay.whiskerR] as chain}
        {#if chain.length >= 2}
          <polyline
            stroke="rgba(200, 120, 50, 0.55)"
            stroke-dasharray="2 3"
            points={chain
              .map((p) => {
                const s = ws(p);
                return `${s.x},${s.y}`;
              })
              .join(" ")}
          />
          {#each chain as p, i}
            {@const s = ws(p)}
            <circle
              cx={s.x}
              cy={s.y}
              r={i === 0 ? 5 : 3}
              fill={i === 0
                ? "rgba(255, 180, 60, 0.95)"
                : i === chain.length - 1
                  ? "rgba(160, 80, 200, 0.95)"
                  : "rgba(200, 120, 50, 0.85)"}
            />
          {/each}
        {/if}
      {/each}
    </svg>
  {/if}
</section>

<aside>
  <fieldset>
    <legend>brush</legend>
    <label>
      <span>width</span>
      <input
        type="range"
        min="0.01"
        max="0.4"
        step="0.001"
        bind:value={width}
      />
      <output>{width.toFixed(3)}</output>
    </label>
    <label>
      <span>tail width</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={widthEnd} />
      <output>{widthEnd.toFixed(2)}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>Body</legend>
    <label>
      <span>vertex count</span>
      <input type="range" min="2" max="40" step="1" bind:value={vertexCount} />
      <output>{vertexCount}</output>
    </label>
    <label>
      <span>length</span>
      <input
        type="range"
        min="0.1"
        max="2.5"
        step="0.01"
        bind:value={bodyLen}
      />
      <output>{bodyLen.toFixed(2)}</output>
    </label>
    <label>
      <span>prop. speed</span>
      <input
        type="range"
        min="0.01"
        max="1"
        step="0.01"
        bind:value={propagationSpeed}
      />
      <output>{propagationSpeed.toFixed(2)}</output>
    </label>
    <label>
      <span>max bend</span>
      <input type="range" min="0" max="180" step="1" bind:value={maxBendDeg} />
      <output>{maxBendDeg}&deg;</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>head</legend>
    <label>
      <span>dragon size</span>
      <input type="range" min="0" max="0.8" step="0.01" bind:value={headSize} />
      <output>{headSize.toFixed(2)}</output>
    </label>
    <label>
      <span>whisker width</span>
      <input
        type="range"
        min="0"
        max="0.05"
        step="0.001"
        bind:value={whiskerWidth}
      />
      <output>{whiskerWidth.toFixed(3)}</output>
    </label>
    <label>
      <span>whisker length</span>
      <input
        type="range"
        min="0.1"
        max="5.0"
        step="0.01"
        bind:value={whiskerLen}
      />
      <output>{whiskerLen.toFixed(2)}</output>
    </label>
    <label>
      <span>whisker segs</span>
      <input type="range" min="2" max="10" step="1" bind:value={whiskerSegs} />
      <output>{whiskerSegs}</output>
    </label>
    <label>
      <span>whisker damp</span>
      <input
        type="range"
        min="0.5"
        max="0.99"
        step="0.01"
        bind:value={whiskerDamping}
      />
      <output>{whiskerDamping.toFixed(2)}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>auto fly</legend>
    <label>
      <input type="checkbox" bind:checked={autoFly} />
      <span>enable</span>
    </label>
    <label>
      <span>speed</span>
      <input
        type="range"
        min="0.1"
        max="5"
        step="0.1"
        bind:value={autoSpeed}
      />
      <output>{autoSpeed.toFixed(2)}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>debug</legend>
    <label>
      <input type="checkbox" bind:checked={showPoints} />
      <span>show control points</span>
    </label>
    <label>
      <input type="checkbox" bind:checked={showPath} />
      <span>show auto-fly path</span>
    </label>
  </fieldset>
</aside>

<style>
  section > menu {
    bottom: 0.5rem;
    left: 0.5rem;
    align-items: center;
  }
  svg polyline {
    fill: none;
  }
  svg circle {
    stroke: white;
    stroke-width: 1.5;
  }
</style>
