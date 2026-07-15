<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import * as enso from "$lib/playgrounds/enso";

  let scene = $state(null);
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

  $effect(() => {
    scene?.apply({
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
      brushColor: brushHex,
      bgColor: bgHex,
    });
  });
</script>
<svelte:head>
  <title>Ensō</title>
</svelte:head>


<section data-stage="square">
  <Scene bind:this={scene} scene={enso} id="enso" />
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
    <label>
      <span>Ink</span>
      <input type="color" bind:value={brushHex} />
    </label>
    <label>
      <span>Paper</span>
      <input type="color" bind:value={bgHex} />
    </label>
  </fieldset>
</aside>

<style>
  section { max-width: 640px; }
</style>
