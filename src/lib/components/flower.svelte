<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import {
    init,
    destroy,
    render,
    setConfig,
    setInkColor,
    setBgColor,
  } from "$lib/playgrounds/flower";

  let canvasEl;
  let ready = $state(false);
  let frameID = 0;
  let observer;

  let petals = $state(8);
  let layers = $state(1);
  let length = $state(1.0);
  let width = $state(0.2);
  let tipSharp = $state(1.5);
  let tipNotch = $state(0.1);
  let baseBias = $state(1.4);
  let layerScale = $state(0.66);
  let layerTwist = $state(0.4);
  let swirl = $state(0.0);
  let inkFlow = $state(1.0);
  let waterFlow = $state(0.6);
  let inkHex = $state("#120f17");
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
      petals,
      layers,
      length,
      width,
      tipSharp,
      tipNotch,
      baseBias,
      layerScale,
      layerTwist,
      swirl,
      inkFlow,
      waterFlow,
    });
  });
  $effect(() => {
    if (ready) setInkColor(hexToRgba(inkHex));
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
    <legend>bloom</legend>
    <label>
      <span>Petals</span>
      <input type="range" min="3" max="12" step="1" bind:value={petals} />
      <output>{petals}</output>
    </label>
    <label>
      <span>Layers</span>
      <input type="range" min="1" max="5" step="1" bind:value={layers} />
      <output>{layers}</output>
    </label>
    <label>
      <span>Length</span>
      <input
        type="range"
        min="0.3"
        max="1.1"
        step="0.001"
        bind:value={length}
      />
      <output>{length.toFixed(3)}</output>
    </label>
    <label>
      <span>Width</span>
      <input
        type="range"
        min="0.05"
        max="0.7"
        step="0.001"
        bind:value={width}
      />
      <output>{width.toFixed(3)}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>petal shape</legend>
    <label>
      <span>Tip taper</span>
      <input type="range" min="0.3" max="3" step="0.01" bind:value={tipSharp} />
      <output>{tipSharp.toFixed(2)}</output>
    </label>
    <label>
      <span>Tip notch</span>
      <input type="range" min="0" max="0.5" step="0.01" bind:value={tipNotch} />
      <output>{tipNotch.toFixed(2)}</output>
    </label>
    <label>
      <span>Belly bias</span>
      <input type="range" min="0.2" max="2" step="0.01" bind:value={baseBias} />
      <output>{baseBias.toFixed(2)}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>arrangement</legend>
    <label>
      <span>Layer scale</span>
      <input
        type="range"
        min="0.4"
        max="1"
        step="0.01"
        bind:value={layerScale}
      />
      <output>{layerScale.toFixed(2)}</output>
    </label>
    <label>
      <span>Layer twist</span>
      <input
        type="range"
        min="-1"
        max="1"
        step="0.01"
        bind:value={layerTwist}
      />
      <output>{layerTwist.toFixed(2)}</output>
    </label>
    <label>
      <span>Swirl</span>
      <input type="range" min="-1.5" max="1.5" step="0.01" bind:value={swirl} />
      <output>{swirl.toFixed(2)}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>brush</legend>
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
  </fieldset>

  <fieldset>
    <legend>color</legend>
    <label class="color">
      <span>Petal</span>
      <input type="color" bind:value={inkHex} />
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
