<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import {
    init,
    destroy,
    render,
    setConfig,
    setBrushColor,
    setBgColor,
  } from "$lib/playgrounds/enso";

  let canvasEl;
  let ready = $state(false);
  let frameID = 0;
  let observer;

  let radius = $state(0.55);
  let angleStart = $state(0.0);
  let lineWidth = $state(0.28);
  let clockwise = $state(true);
  let autoSweep = $state(true);
  let sweep = $state(1.0);
  let inkFlow = $state(1.0);
  let waterFlow = $state(0.7);
  let strands = $state(1.5);
  let wobble = $state(0.5);
  let widthEnd = $state(0.15);
  let widthOffset = $state(0.55);
  let widthRange = $state(1.5);
  let widthAnchor = $state(1.0);
  let brushHex = $state("#0d0d12");
  let bgHex = $state("#f5eddc");

  function hexToRgba(hex) {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
      1.0,
    ];
  }

  $effect(() => {
    if (!ready) return;
    setConfig({
      radius, angleStart, lineWidth, clockwise, autoSweep, sweep,
      inkFlow, waterFlow, strands, wobble,
      widthEnd, widthOffset, widthRange, widthAnchor,
    });
  });
  $effect(() => { if (ready) setBrushColor(hexToRgba(brushHex)); });
  $effect(() => { if (ready) setBgColor(hexToRgba(bgHex)); });

  function loop() {
    frameID = requestAnimationFrame(loop);
    render();
  }

  onMount(() => {
    init(canvasEl);
    ready = true;
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
    observer?.disconnect();
    destroy();
  });
</script>

<div class="enso-demo">
  <div class="stage">
    <canvas bind:this={canvasEl}></canvas>
  </div>
  <div class="controls">
    <fieldset>
      <legend>circle</legend>
      <label>
        <span>Radius</span>
        <input type="range" min="0.1" max="0.95" step="0.001" bind:value={radius} />
        <output>{radius.toFixed(3)}</output>
      </label>
      <label>
        <span>Start angle</span>
        <input type="range" min="-3.14159" max="3.14159" step="0.001" bind:value={angleStart} />
        <output>{angleStart.toFixed(2)}</output>
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={clockwise} />
        <span>clockwise</span>
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={autoSweep} />
        <span>auto sweep</span>
      </label>
      <label>
        <span>Sweep</span>
        <input type="range" min="0" max="1" step="0.001" bind:value={sweep} disabled={autoSweep} />
        <output>{sweep.toFixed(2)}</output>
      </label>
    </fieldset>

    <fieldset>
      <legend>brush</legend>
      <label>
        <span>Line Width</span>
        <input type="range" min="0.01" max="0.6" step="0.001" bind:value={lineWidth} />
        <output>{lineWidth.toFixed(3)}</output>
      </label>
      <label>
        <span>Ink Flow</span>
        <input type="range" min="0.2" max="3" step="0.01" bind:value={inkFlow} />
        <output>{inkFlow.toFixed(2)}</output>
      </label>
      <label>
        <span>Water Flow</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={waterFlow} />
        <output>{waterFlow.toFixed(2)}</output>
      </label>
      <label>
        <span>Strands</span>
        <input type="range" min="0.1" max="4" step="0.01" bind:value={strands} />
        <output>{strands.toFixed(2)}</output>
      </label>
      <label>
        <span>Wobble</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={wobble} />
        <output>{wobble.toFixed(2)}</output>
      </label>
    </fieldset>

    <fieldset>
      <legend>stroke shape</legend>
      <label>
        <span>Tail width</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={widthEnd} />
        <output>{widthEnd.toFixed(2)}</output>
      </label>
      <label>
        <span>Step offset</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={widthOffset} />
        <output>{widthOffset.toFixed(2)}</output>
      </label>
      <label>
        <span>Step range</span>
        <input type="range" min="0" max="1.5" step="0.01" bind:value={widthRange} />
        <output>{widthRange.toFixed(2)}</output>
      </label>
      <label>
        <span>Anchor</span>
        <input type="range" min="0" max="1" step="0.001" bind:value={widthAnchor} />
        <output>{widthAnchor.toFixed(2)}</output>
      </label>
    </fieldset>

    <fieldset>
      <legend>color</legend>
      <label class="color">
        <span>Ink</span>
        <input type="color" bind:value={brushHex} />
      </label>
      <label class="color">
        <span>Paper</span>
        <input type="color" bind:value={bgHex} />
      </label>
    </fieldset>
  </div>
</div>

<style>
  .enso-demo {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  @media(min-width: 768px) {
    .enso-demo {
      flex-direction: row;
      align-items: flex-start;
    }
    .stage { flex: 1 1 auto; min-width: 0; }
    .controls { flex: 0 0 18rem; }
  }
  .stage {
    position: relative;
    width: 100%;
    max-width: 640px;
    aspect-ratio: 1 / 1;
  }
  canvas {
    width: 100%;
    height: 100%;
    background: #f5eddc;
    border-radius: 0.25rem;
    touch-action: none;
    display: block;
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
  label.check { grid-template-columns: auto 1fr; }
  label.color { grid-template-columns: 6rem 1fr; }
  input[type="range"] { width: 100%; }
  input[type="range"]:disabled { opacity: 0.4; }
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
</style>
