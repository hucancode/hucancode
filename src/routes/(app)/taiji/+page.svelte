<script>
  import Panel from "$lib/components/playground/panel.svelte";
  import Scene from "$lib/components/taiji.svelte";

  let scene = $state(null);

  let dragonSpeed = $state(0.3); // shown ×1000 of curve fraction/frame
  let taijiSpin = $state(1); // shown ×100 radians/frame
  let cloudSpeed = $state(4);
  let randomPath = $state(false);
  let radius = $state(34);
  let elevation = $state(8);
  let color1 = $state("#ffffff");
  let color2 = $state("#000000");

  // live knobs (no curve change)
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

<Panel title="Taiji">
  {#snippet stage()}
    <Scene bind:this={scene} />
  {/snippet}

  {#snippet controls()}
    <label class="row">
      <span>Dragon speed <span class="val">{dragonSpeed.toFixed(2)}</span></span>
      <input type="range" min="0" max="2" step="0.05" bind:value={dragonSpeed} />
    </label>

    <label class="row">
      <span>Disc spin <span class="val">{taijiSpin.toFixed(1)}</span></span>
      <input type="range" min="-4" max="4" step="0.1" bind:value={taijiSpin} />
    </label>

    <label class="row">
      <span>Cloud drift <span class="val">{cloudSpeed.toFixed(1)}</span></span>
      <input type="range" min="0" max="12" step="0.5" bind:value={cloudSpeed} />
    </label>

    <label class="row toggle-row">
      <span>Random flight path</span>
      <input
        type="checkbox"
        bind:checked={randomPath}
        onchange={() => scene?.reshape({ randomPath })}
      />
    </label>

    {#if !randomPath}
      <label class="row">
        <span>Orbit radius <span class="val">{radius}</span></span>
        <input
          type="range"
          min="12"
          max="44"
          step="1"
          bind:value={radius}
          onchange={() => scene?.reshape({ radius })}
        />
      </label>

      <label class="row">
        <span>Orbit rise <span class="val">{elevation}</span></span>
        <input
          type="range"
          min="0"
          max="24"
          step="1"
          bind:value={elevation}
          onchange={() => scene?.reshape({ elevation })}
        />
      </label>
    {/if}

    <label class="row toggle-row">
      <span>Yang color</span>
      <input type="color" bind:value={color1} />
    </label>
    <label class="row toggle-row">
      <span>Yin color</span>
      <input type="color" bind:value={color2} />
    </label>

    {#if randomPath}
      <button class="action" onclick={() => scene?.newPath()}>↻ New path</button>
    {/if}
  {/snippet}

  {#snippet notes()}
    <p>
      A dragon flies a closed <strong>Catmull-Rom</strong> loop above a spinning
      taiji disc, over an animated cloud shader. The default flight is an
      <em>orbit</em> — a circle (radius) modulated by a sine rise (rise), so it
      weaves up and down as it circles.
    </p>
    <p>
      <em>Disc spin</em> turns the yin/yang continuously (negative reverses).
      Switch to a <em>random</em> path for a fresh scattered route each time.
    </p>
  {/snippet}
</Panel>
