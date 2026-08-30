<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import * as dragon from "$lib/playgrounds/dragon";

  const PRESETS = [
    { id: "circle", label: "Circle" },
    { id: "figure8", label: "Fig8" },
    { id: "helix", label: "Helix" },
    { id: "random", label: "Random" },
  ];
  let scene = $state(null);
  let preset = $state("circle");
  let points = $state(20);
  let spread = $state(1);
  let speed = $state(0.8);
  let showLights = $state(false);
  let showPath = $state(true);
  let bodyFraction = $state(0.25);
  let girthFactor = $state(0.0012);

  // curve knobs rebuild the dragons, so they commit on change (not on every
  // drag tick); speed/lights/path are live and flow straight through
  let shape = $state({ preset, points, spread, bodyFraction, girthFactor });
  const reshape = () => (shape = { preset, points, spread, bodyFraction, girthFactor });

  function reset() {
    dragon.clearDragon();
    dragon.makeDragon();
  }

  $effect(() => {
    scene?.apply({ ...shape, speed: speed / 1000, showLights, showPath });
  });
</script>

<svelte:head>
  <title>Dragon</title>
</svelte:head>

<section>
  <Scene bind:this={scene} scene={dragon} id="dragon" />
</section>

<aside>
  <fieldset>
    <legend>flight path</legend>
    <menu role="group">
      {#each PRESETS as p}
        <li><label>
          <input type="radio" name="preset" value={p.id} bind:group={preset} onchange={reshape} />
          {p.label}
        </label></li>
      {/each}
    </menu>
  </fieldset>

  <fieldset>
    <legend>parameters</legend>
    <label>
      <span>Speed</span>
      <input type="range" min="0" max="4" step="0.1" bind:value={speed} />
      <output>{speed.toFixed(1)}</output>
    </label>
    <label>
      <span>Path detail</span>
      <input type="range" min="4" max="40" step="1" bind:value={points} onchange={reshape} />
      <output>{points}</output>
    </label>
    <label>
      <span>Path size</span>
      <input type="range" min="0.4" max="1.6" step="0.05" bind:value={spread} onchange={reshape} />
      <output>{spread.toFixed(2)}</output>
    </label>
    <label>
      <span>Body length</span>
      <input type="range" min="0.05" max="0.6" step="0.01" bind:value={bodyFraction} onchange={reshape} />
      <output>{bodyFraction.toFixed(2)}</output>
    </label>
    <label>
      <span>Girth</span>
      <input type="range" min="0.0004" max="0.004" step="0.0002" bind:value={girthFactor} onchange={reshape} />
      <output>{girthFactor.toFixed(4)}</output>
    </label>
    <label>
      <input type="checkbox" bind:checked={showLights} />
      <span>Animated lights</span>
    </label>
    <label>
      <input type="checkbox" bind:checked={showPath} />
      <span>Show flight path</span>
    </label>
  </fieldset>

  <menu>
    <li><button onclick={() => dragon.regenerate()}>New path</button></li>
    <li><button onclick={() => dragon.makeDragon()}>+ Add</button></li>
    <li><button onclick={reset}>Reset</button></li>
  </menu>
</aside>
