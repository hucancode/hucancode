<script>
  import Scene from "$lib/components/rubik.svelte";

  let scene = $state(null);
  let size = $state(3);
  let speed = $state(1);
  let autoplay = $state(true);
  let randomEase = $state(true);

  $effect(() => {
    scene?.apply({ speed, autoplay, randomEase });
  });
</script>

<svelte:head>
  <title>Rubik</title>
</svelte:head>

  <section>
    {#key size}
      <Scene bind:this={scene} {size} />
    {/key}
  </section>

  <aside>
    <fieldset>
      <legend>parameters</legend>
      <label>
        <span>Cube size</span>
        <input type="range" min="2" max="6" step="1" bind:value={size} />
        <output>{size}</output>
      </label>
      <label>
        <span>Turn speed</span>
        <input type="range" min="0.25" max="3" step="0.25" bind:value={speed} />
        <output>{speed.toFixed(2)}</output>
      </label>
      <label>
        <input type="checkbox" bind:checked={autoplay} />
        <span>Auto-shuffle</span>
      </label>
      <label>
        <input type="checkbox" bind:checked={randomEase} />
        <span>Random easing</span>
      </label>
    </fieldset>

    {#if !autoplay}
      <menu>
        <li><button onclick={() => scene?.stepOnce()}>▶ One move</button></li>
      </menu>
    {/if}
  </aside>
