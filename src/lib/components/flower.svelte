<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import {
    init,
    destroy,
    render,
    setConfig,
    setInkColor,
    setCoreColor,
    setBgColor,
  } from "$lib/playgrounds/flower";

  let canvasEl;
  let ready = $state(false);
  let frameID = 0;
  let observer;

  let petals = $state(6);
  let layers = $state(2);
  let length = $state(0.85);
  let width = $state(0.32);
  let tipSharp = $state(1.1);
  let baseBias = $state(0.7);
  let layerScale = $state(0.72);
  let layerTwist = $state(0.3);
  let swirl = $state(0.0);
  let wobble = $state(0.6);
  let core = $state(0.12);
  let inkFlow = $state(1.1);
  let waterFlow = $state(0.4);
  let strands = $state(0.6);
  let inkHex = $state("#120f17");
  let coreHex = $state("#0d0d12");
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
      petals, layers, length, width, tipSharp, baseBias,
      layerScale, layerTwist, swirl, wobble, core,
      inkFlow, waterFlow, strands,
    });
  });
  $effect(() => { if (ready) setInkColor(hexToRgba(inkHex)); });
  $effect(() => { if (ready) setCoreColor(hexToRgba(coreHex)); });
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

<div class="flower-demo">
  <div class="stage">
    <canvas bind:this={canvasEl}></canvas>
  </div>
  <div class="controls">
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
        <input type="range" min="0.3" max="1.1" step="0.001" bind:value={length} />
        <output>{length.toFixed(3)}</output>
      </label>
      <label>
        <span>Width</span>
        <input type="range" min="0.05" max="0.7" step="0.001" bind:value={width} />
        <output>{width.toFixed(3)}</output>
      </label>
      <label>
        <span>Core</span>
        <input type="range" min="0" max="0.4" step="0.001" bind:value={core} />
        <output>{core.toFixed(3)}</output>
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
        <span>Belly bias</span>
        <input type="range" min="0.2" max="2" step="0.01" bind:value={baseBias} />
        <output>{baseBias.toFixed(2)}</output>
      </label>
      <label>
        <span>Wobble</span>
        <input type="range" min="0" max="1.5" step="0.01" bind:value={wobble} />
        <output>{wobble.toFixed(2)}</output>
      </label>
    </fieldset>

    <fieldset>
      <legend>arrangement</legend>
      <label>
        <span>Layer scale</span>
        <input type="range" min="0.4" max="1" step="0.01" bind:value={layerScale} />
        <output>{layerScale.toFixed(2)}</output>
      </label>
      <label>
        <span>Layer twist</span>
        <input type="range" min="-1" max="1" step="0.01" bind:value={layerTwist} />
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
      <label>
        <span>Dry brush</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={strands} />
        <output>{strands.toFixed(2)}</output>
      </label>
    </fieldset>

    <fieldset>
      <legend>color</legend>
      <label class="color">
        <span>Petal</span>
        <input type="color" bind:value={inkHex} />
      </label>
      <label class="color">
        <span>Core</span>
        <input type="color" bind:value={coreHex} />
      </label>
      <label class="color">
        <span>Paper</span>
        <input type="color" bind:value={bgHex} />
      </label>
    </fieldset>
  </div>
</div>

<style>
  .flower-demo {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  @media(min-width: 768px) {
    .flower-demo {
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
  label.color { grid-template-columns: 6rem 1fr; }
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
</style>
