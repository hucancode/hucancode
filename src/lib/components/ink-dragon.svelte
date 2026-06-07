<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import {
    init,
    destroy,
    render,
    resize,
    setWidth,
    setInkFlow,
    setStrands,
    setWaterFlow,
    setWobble,
    setWidthEnd,
    setWidthOffset,
    setWidthRange,
    setHead,
    setWhiskerWidth,
    setPhysicsParam,
    setTipTarget,
    resetBaseline,
    resetWhiskers,
    step,
    getOverlay,
    eventToWorld,
    worldToScreen,
  } from "$lib/scenes/ink-dragon";

  let canvasEl;
  let ready = $state(false);
  let frameID = 0;
  let observer;

  let width = $state(0.05);
  let inkFlow = $state(2.0);
  let strands = $state(3.0);
  let waterFlow = $state(0.8);
  let wobble = $state(0.9);
  let showPoints = $state(true);
  let showHead = $state(true);
  let headSize = $state(0.15);
  let whiskerWidth = $state(0.01);
  let whiskerSegs = $state(5);
  let whiskerLen = $state(1.2);
  let whiskerDamping = $state(0.88);

  let widthPreset = $state('custom');
  let widthEnd = $state(0.1);
  let widthOffset = $state(0.2);
  let widthRange = $state(0.6);

  const widthPresets = {
    uniform:    { end: 1.0,  offset: 0.5,  range: 1.0 },
    linear:     { end: 0.0,  offset: 0.5,  range: 1.0 },
    easeOut:    { end: 0.0,  offset: 0.75, range: 0.5 },
    easeIn:     { end: 0.0,  offset: 0.25, range: 0.5 },
    custom:     null,
  };

  $effect(() => {
    if (widthPreset === "custom") return;
    const p = widthPresets[widthPreset];
    if (!p) return;
    widthEnd = p.end;
    widthOffset = p.offset;
    widthRange = p.range;
  });

  let vertexCount = $state(16);
  let bodyLen = $state(1.2);
  let propagationSpeed = $state(0.6);
  let maxBendDeg = $state(60);

  let canvasSize = $state({ w: 1, h: 1 });
  let overlayView = $state({ body: [], whiskerL: [], whiskerR: [] });

  // shader params
  $effect(() => { if (ready) setWidth(width); });
  $effect(() => { if (ready) setInkFlow(inkFlow); });
  $effect(() => { if (ready) setStrands(strands); });
  $effect(() => { if (ready) setWaterFlow(waterFlow); });
  $effect(() => { if (ready) setWobble(wobble); });
  $effect(() => { if (ready) setWidthEnd(widthEnd); });
  $effect(() => { if (ready) setWidthOffset(widthOffset); });
  $effect(() => { if (ready) setWidthRange(widthRange); });
  $effect(() => { if (ready) setHead(null, null, headSize, showHead); });
  $effect(() => { if (ready) setWhiskerWidth(whiskerWidth); });

  // physics params
  $effect(() => { if (ready) setPhysicsParam("vertexCount", vertexCount); });
  $effect(() => { if (ready) setPhysicsParam("bodyLen", bodyLen); });
  $effect(() => { if (ready) setPhysicsParam("propagationSpeed", propagationSpeed); });
  $effect(() => { if (ready) setPhysicsParam("maxBendDeg", maxBendDeg); });
  $effect(() => { if (ready) setPhysicsParam("whiskerSegs", whiskerSegs); });
  $effect(() => { if (ready) setPhysicsParam("whiskerLen", whiskerLen); });
  $effect(() => { if (ready) setPhysicsParam("whiskerDamping", whiskerDamping); });
  $effect(() => { if (ready) setPhysicsParam("headSize", headSize); });

  let dragging = false;

  function loop() {
    frameID = requestAnimationFrame(loop);
    step();
    render();
    if (showPoints) overlayView = getOverlay();
  }

  function onResize() {
    if (!canvasEl) return;
    const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
    resize(w, h);
    canvasSize = { w, h };
  }

  function onPointerDown(e) {
    dragging = true;
    setTipTarget(eventToWorld(canvasEl, e));
    canvasEl.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    setTipTarget(eventToWorld(canvasEl, e));
  }
  function onPointerUp(e) {
    dragging = false;
    setTipTarget(null);
    try { canvasEl.releasePointerCapture(e.pointerId); } catch {}
  }

  function ws(p) {
    return worldToScreen(p, canvasSize.w, canvasSize.h);
  }

  onMount(() => {
    init(canvasEl);
    resetBaseline();
    resetWhiskers();
    ready = true;
    onResize();
    window.addEventListener("resize", onResize);
    observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        frameID = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(frameID);
      }
    });
    observer.observe(canvasEl);
  });

  onDestroy(() => {
    if (!browser) return;
    cancelAnimationFrame(frameID);
    window.removeEventListener("resize", onResize);
    observer?.disconnect();
    destroy();
  });
</script>

<div class="brush-demo">
  <div class="stage">
    <canvas
      bind:this={canvasEl}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
    ></canvas>
    {#if showPoints && overlayView.body.length > 0}
      <svg
        class="overlay"
        viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}
        preserveAspectRatio="none"
      >
        <polyline
          points={overlayView.body.map(p => { const s = ws(p); return `${s.x},${s.y}`; }).join(" ")}
        />
        {#each overlayView.body as p, i}
          {@const s = ws(p)}
          <circle
            cx={s.x} cy={s.y} r={i === overlayView.body.length - 1 ? 6 : 4}
            class={i === 0 ? "first" : i === overlayView.body.length - 1 ? "last" : "mid"}
          />
        {/each}
        {#each [overlayView.whiskerL, overlayView.whiskerR] as chain}
          {#if chain.length >= 2}
            <polyline
              class="whisker"
              points={chain.map(p => { const s = ws(p); return `${s.x},${s.y}`; }).join(" ")}
            />
            {#each chain as p, i}
              {@const s = ws(p)}
              <circle
                cx={s.x} cy={s.y} r={i === 0 ? 5 : 3}
                class={i === 0 ? "whisker-anchor" : i === chain.length - 1 ? "whisker-tip" : "whisker-mid"}
              />
            {/each}
          {/if}
        {/each}
      </svg>
    {/if}
  </div>

  <div class="controls">
    <fieldset>
      <legend>brush</legend>
      <label>
        <span>width</span>
        <input type="range" min="0.01" max="0.4" step="0.001" bind:value={width} />
        <output>{width.toFixed(3)}</output>
      </label>
      <label>
        <span>ink flow</span>
        <input type="range" min="0.2" max="3" step="0.01" bind:value={inkFlow} />
        <output>{inkFlow.toFixed(2)}</output>
      </label>
      <label>
        <span>water flow</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={waterFlow} />
        <output>{waterFlow.toFixed(2)}</output>
      </label>
      <label>
        <span>strands</span>
        <input type="range" min="0.1" max="4" step="0.01" bind:value={strands} />
        <output>{strands.toFixed(2)}</output>
      </label>
      <label>
        <span>wobble</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={wobble} />
        <output>{wobble.toFixed(2)}</output>
      </label>
      <label>
        <span>width shape</span>
        <select bind:value={widthPreset}>
          <option value="uniform">Uniform</option>
          <option value="linear">Linear</option>
          <option value="easeOut">Ease-out</option>
          <option value="easeIn">Ease-in</option>
          <option value="custom">Custom</option>
        </select>
        <output></output>
      </label>
      <label>
        <span>tail width</span>
        <input
          type="range" min="0" max="1" step="0.01"
          bind:value={widthEnd}
          oninput={() => (widthPreset = "custom")}
        />
        <output>{widthEnd.toFixed(2)}</output>
      </label>
      <label>
        <span>step offset</span>
        <input
          type="range" min="0" max="1" step="0.01"
          bind:value={widthOffset}
          oninput={() => (widthPreset = "custom")}
        />
        <output>{widthOffset.toFixed(2)}</output>
      </label>
      <label>
        <span>step range</span>
        <input
          type="range" min="0" max="1.5" step="0.01"
          bind:value={widthRange}
          oninput={() => (widthPreset = "custom")}
        />
        <output>{widthRange.toFixed(2)}</output>
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
        <input type="range" min="0.1" max="2.5" step="0.01" bind:value={bodyLen} />
        <output>{bodyLen.toFixed(2)}</output>
      </label>
      <label>
        <span>prop. speed</span>
        <input type="range" min="0.01" max="1" step="0.01" bind:value={propagationSpeed} />
        <output>{propagationSpeed.toFixed(2)}</output>
      </label>
      <label>
        <span>max bend</span>
        <input type="range" min="0" max="180" step="1" bind:value={maxBendDeg} />
        <output>{maxBendDeg}&deg;</output>
      </label>
      <div class="buttons">
        <button type="button" onclick={() => resetBaseline()}>reset chain</button>
      </div>
    </fieldset>

    <fieldset>
      <legend>head</legend>
      <label class="check">
        <input type="checkbox" bind:checked={showHead} />
        <span>show</span>
      </label>
      <label>
        <span>dragon size</span>
        <input type="range" min="0" max="0.8" step="0.01" bind:value={headSize} />
        <output>{headSize.toFixed(2)}</output>
      </label>
      <label>
        <span>whisker width</span>
        <input type="range" min="0" max="0.05" step="0.001" bind:value={whiskerWidth} />
        <output>{whiskerWidth.toFixed(3)}</output>
      </label>
      <label>
        <span>whisker length</span>
        <input type="range" min="0.1" max="1.2" step="0.01" bind:value={whiskerLen} />
        <output>{whiskerLen.toFixed(2)}</output>
      </label>
      <label>
        <span>whisker segs</span>
        <input type="range" min="2" max="10" step="1" bind:value={whiskerSegs} />
        <output>{whiskerSegs}</output>
      </label>
      <label>
        <span>whisker damp</span>
        <input type="range" min="0.5" max="0.99" step="0.01" bind:value={whiskerDamping} />
        <output>{whiskerDamping.toFixed(2)}</output>
      </label>
    </fieldset>

    <fieldset>
      <legend>debug</legend>
      <label class="check">
        <input type="checkbox" bind:checked={showPoints} />
        <span>show control points</span>
      </label>
      <p class="hint">drag on canvas: tip follows mouse, chain pulls along when stretched</p>
    </fieldset>
  </div>
</div>

<style>
  .brush-demo {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  @media(min-width: 768px) {
    .brush-demo {
      flex-direction: row;
    }
  }
  .stage {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
  }
  canvas {
    width: 100%;
    height: 100%;
    background: #fffce0;
    border-radius: 0.25rem;
    touch-action: none;
    cursor: grab;
    display: block;
  }
  canvas:active { cursor: grabbing; }
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    width: 100%;
    height: 100%;
  }
  .overlay circle {
    fill: rgba(220, 50, 50, 0.85);
    stroke: white;
    stroke-width: 1.5;
  }
  .overlay circle.first { fill: rgba(50, 180, 80, 0.95); }
  .overlay circle.last  { fill: rgba(50, 100, 220, 0.95); }
  .overlay circle.whisker-mid    { fill: rgba(200, 120, 50, 0.85); }
  .overlay circle.whisker-anchor { fill: rgba(255, 180, 60, 0.95); }
  .overlay circle.whisker-tip    { fill: rgba(160, 80, 200, 0.95); }
  .overlay polyline.whisker {
    stroke: rgba(200, 120, 50, 0.55);
    stroke-dasharray: 2 3;
  }
  .overlay polyline {
    fill: none;
    stroke: rgba(180, 60, 60, 0.45);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }
  .controls {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }
  label {
    display: grid;
    grid-template-columns: 6rem 1fr 3rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  label.check {
    grid-template-columns: auto 1fr;
  }
  input[type="range"] { width: 100%; }
  .buttons {
    display: flex;
    gap: 0.5rem;
  }
  button {
    padding: 0.3rem 0.8rem;
    font-size: 0.9rem;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
    opacity: 0.7;
  }
</style>
