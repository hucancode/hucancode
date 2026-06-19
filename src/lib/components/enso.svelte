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
  let sweep = $state(1.0);
  let opacityBleed = $state(1.0);
  let opacityWet = $state(1.0);
  let opacityDry = $state(1.0);
  let inkFlow = $state(2.0);
  let waterFlow = $state(0.5);
  let strands = $state(2.5);
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
      radius,
      angleStart,
      lineWidth,
      clockwise,
      sweep,
      opacityBleed,
      opacityWet,
      opacityDry,
      inkFlow,
      waterFlow,
      strands,
      wobble,
      widthEnd,
      widthOffset,
      widthRange,
      widthAnchor,
    });
  });
  $effect(() => {
    if (ready) setBrushColor(hexToRgba(brushHex));
  });
  $effect(() => {
    if (ready) setBgColor(hexToRgba(bgHex));
  });

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

<section>
  <canvas bind:this={canvasEl}></canvas>
</section>
<aside>
  <fieldset>
    <legend>circle</legend>
    <label>
      <span>Radius</span>
      <input
        type="range"
        min="0.1"
        max="0.95"
        step="0.001"
        bind:value={radius}
      />
      <output>{radius.toFixed(3)}</output>
    </label>
    <label>
      <span>Start angle</span>
      <input
        type="range"
        min="-3.14159"
        max="3.14159"
        step="0.001"
        bind:value={angleStart}
      />
      <output>{angleStart.toFixed(2)}</output>
    </label>
    <label>
      <input type="checkbox" bind:checked={clockwise} />
      <span>clockwise</span>
    </label>
    <label>
      <span>Sweep</span>
      <input type="range" min="0" max="1" step="0.001" bind:value={sweep} />
      <output>{sweep.toFixed(2)}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>layers</legend>
    <label>
      <span>Bleed</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        bind:value={opacityBleed}
      />
      <output>{opacityBleed.toFixed(2)}</output>
    </label>
    <label>
      <span>Wet</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={opacityWet} />
      <output>{opacityWet.toFixed(2)}</output>
    </label>
    <label>
      <span>Dry</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={opacityDry} />
      <output>{opacityDry.toFixed(2)}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>brush</legend>
    <label>
      <span>Line Width</span>
      <input
        type="range"
        min="0.01"
        max="1.0"
        step="0.001"
        bind:value={lineWidth}
      />
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
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        bind:value={widthOffset}
      />
      <output>{widthOffset.toFixed(2)}</output>
    </label>
    <label>
      <span>Step range</span>
      <input
        type="range"
        min="0"
        max="1.5"
        step="0.01"
        bind:value={widthRange}
      />
      <output>{widthRange.toFixed(2)}</output>
    </label>
    <label>
      <span>Anchor</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.001"
        bind:value={widthAnchor}
      />
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
</aside>

<style>
  /* layout (main > section / aside) + fieldset/label styling come from global app.css */
  section {
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
  label.color {
    grid-template-columns: 6rem 1fr;
  }
</style>
