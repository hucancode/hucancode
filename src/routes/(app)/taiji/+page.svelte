<script>
  import Scene from "$lib/components/taiji.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";

  let scene = $state(null);
  let dragonSpeed = $state(0.3);
  let taijiSpin = $state(1);
  let cloudSpeed = $state(4);
  let randomPath = $state(false);
  let radius = $state(34);
  let elevation = $state(8);
  let color1 = $state("#ffffff");
  let color2 = $state("#000000");

  $effect(() => {
    scene?.apply({
      dragonSpeed: dragonSpeed / 1000,
      taijiSpin: taijiSpin / 100,
      cloudSpeed,
    });
  });
  $effect(() => {
    scene?.colors(color1, color2);
  });
</script>

<svelte:head>
  <title>Taiji</title>
</svelte:head>

<a class="back" href="/playgrounds">{@html Return}</a>

<main>
  <figure>
    <Scene bind:this={scene} />
  </figure>

  <aside>
    <fieldset>
      <legend>motion</legend>
      <label>
        <span>Dragon</span>
        <input type="range" min="0" max="2" step="0.05" bind:value={dragonSpeed} />
        <output>{dragonSpeed.toFixed(2)}</output>
      </label>
      <label>
        <span>Disc spin</span>
        <input type="range" min="-4" max="4" step="0.1" bind:value={taijiSpin} />
        <output>{taijiSpin.toFixed(1)}</output>
      </label>
      <label>
        <span>Cloud drift</span>
        <input type="range" min="0" max="12" step="0.5" bind:value={cloudSpeed} />
        <output>{cloudSpeed.toFixed(1)}</output>
      </label>
    </fieldset>

    <fieldset>
      <legend>orbit</legend>
      <label>
        <input type="checkbox" bind:checked={randomPath}
          onchange={() => scene?.reshape({ randomPath })} />
        <span>Random path</span>
      </label>
      {#if !randomPath}
        <label>
          <span>Radius</span>
          <input type="range" min="12" max="44" step="1" bind:value={radius}
            onchange={() => scene?.reshape({ radius })} />
          <output>{radius}</output>
        </label>
        <label>
          <span>Rise</span>
          <input type="range" min="0" max="24" step="1" bind:value={elevation}
            onchange={() => scene?.reshape({ elevation })} />
          <output>{elevation}</output>
        </label>
      {/if}
      {#if randomPath}
        <div class="buttons">
          <button onclick={() => scene?.newPath()}>↻ New path</button>
        </div>
      {/if}
    </fieldset>

    <fieldset>
      <legend>colors</legend>
      <label>
        <span>Yang</span>
        <input type="color" bind:value={color1} />
        <output></output>
      </label>
      <label>
        <span>Yin</span>
        <input type="color" bind:value={color2} />
        <output></output>
      </label>
    </fieldset>
  </aside>
</main>
