<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import * as radiance from "$lib/playgrounds/radiance";

  let scene = $state(null);

  // brush / scene
  let color = $state("#ff6633");
  let brushSize = $state(12);
  let intensity = $state(6);
  let brush = $state("light");

  // cascade algorithm
  let baseRays = $state(4);
  let branching = $state(2);
  let probeSpacing = $state(4);
  let baseInterval = $state(6);
  let stepsPerRay = $state(24);

  // cascade levels
  let autoCascades = $state(true);
  let cascadeLevels = $state(8);

  // display
  let exposure = $state(1);
  let showProbes = $state(false);

  // hud stats, refreshed a few times a second off the canvas frame clock
  let stats = $state({ fps: 0, cascades: 0, emissive: 0, lights: 0, error: null });
  let lastStats = 0;

  $effect(() => {
    scene?.apply({
      color,
      brushSize,
      intensity,
      brush,
      baseRays,
      branching,
      probeSpacing0: probeSpacing,
      baseInterval,
      stepsPerRay,
      cascadeCount: autoCascades ? 0 : cascadeLevels,
      exposure,
      probeOverlay: showProbes,
    });
  });

  function clear() {
    radiance.clear();
  }

  function loadDefaultScene() {
    radiance.loadDefaultScene();
  }

  function spawnLights() {
    radiance.spawnRandomLights(100);
  }

  function frame() {
    const now = performance.now();
    if (now - lastStats > 250) {
      lastStats = now;
      stats = radiance.getStats();
    }
  }
</script>

<svelte:head>
  <title>Radiance Cascades</title>
</svelte:head>

<section data-stage="square" class="stage">
  <Scene bind:this={scene} scene={radiance} id="radiance" onFrame={frame} />
  <footer>
    <menu>
      <li>
        <output>
          {#if stats.error}
            {stats.error}
          {:else}
            {stats.fps} FPS · {stats.cascades} cascades · {stats.emissive.toLocaleString()} light px · {stats.lights} embers
          {/if}
        </output>
      </li>
    </menu>
  </footer>
</section>

<aside>
  <fieldset>
    <legend>brush</legend>
    <label>
      <span>color</span>
      <input type="color" bind:value={color} />
    </label>
    <label>
      <span>size</span>
      <input type="range" min="2" max="80" step="1" bind:value={brushSize} />
      <output>{brushSize}</output>
    </label>
    <label>
      <span>intensity</span>
      <input type="range" min="1" max="20" step="1" bind:value={intensity} />
      <output>{intensity}</output>
    </label>
    <menu role="group" aria-label="brush type">
      <li><label><input type="radio" name="brush" value="wall" bind:group={brush} />wall</label></li>
      <li><label><input type="radio" name="brush" value="light" bind:group={brush} />light</label></li>
      <li><label><input type="radio" name="brush" value="moving-light" bind:group={brush} />ember</label></li>
    </menu>
    <menu>
      <li><button type="button" onclick={loadDefaultScene}>Reset</button></li>
      <li><button type="button" onclick={spawnLights}>+100 embers</button></li>
      <li><button type="button" onclick={clear}>Clear</button></li>
    </menu>
  </fieldset>

  <fieldset>
    <legend>cascade grid</legend>
    <label>
      <span>base rays</span>
      <input type="range" min="2" max="8" step="1" bind:value={baseRays} />
      <output>{baseRays}</output>
    </label>
    <label>
      <span>branching</span>
      <input type="range" min="2" max="4" step="2" bind:value={branching} />
      <output>{branching}×</output>
    </label>
    <label>
      <span>probe spacing</span>
      <input type="range" min="4" max="16" step="1" bind:value={probeSpacing} />
      <output>{probeSpacing}px</output>
    </label>
    <label>
      <span>base interval</span>
      <input type="range" min="2" max="32" step="1" bind:value={baseInterval} />
      <output>{baseInterval}px</output>
    </label>
    <label>
      <span>steps / ray</span>
      <input type="range" min="4" max="48" step="1" bind:value={stepsPerRay} />
      <output>{stepsPerRay}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>cascade levels</legend>
    <label>
      <input type="checkbox" bind:checked={autoCascades} />
      <span>auto (fit screen)</span>
    </label>
    <label>
      <span>levels</span>
      <input
        type="range"
        min="2"
        max="12"
        step="1"
        bind:value={cascadeLevels}
        disabled={autoCascades}
      />
      <output>{autoCascades ? "auto" : cascadeLevels}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>display</legend>
    <label>
      <span>exposure</span>
      <input type="range" min="0.1" max="3" step="0.05" bind:value={exposure} />
      <output>{exposure.toFixed(2)}</output>
    </label>
    <label>
      <input type="checkbox" bind:checked={showProbes} />
      <span>show probes</span>
    </label>
  </fieldset>
  <fieldset>
    <legend>paper</legend>
      <a href="https://arxiv.org/abs/2408.14425" >Radiance Cascades: A Novel High-Resolution Formal Solution for Multidimensional Non-LTE Radiative Transfer</a>
  </fieldset>
</aside>

<style>
  .stage {
    cursor: crosshair;
    touch-action: none;
  }
</style>
