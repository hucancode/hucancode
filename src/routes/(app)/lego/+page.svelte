<script>
  import Scene from "$lib/components/lego.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";

  let scene = $state(null);
  let width = $state(4);
  let height = $state(2);
  let depth = $state(1);
  let thickness = $state(0.2);
  let studRadius = $state(0.4);
  let studHeight = $state(0.3);
  let color = $state("#fab387");
  let spin = $state(1);

  $effect(() => {
    scene?.apply({ width, height, depth, thickness, studRadius, studHeight, color, spin });
  });
</script>

<svelte:head>
  <title>Lego</title>
</svelte:head>

<a class="back" href="/playgrounds">{@html Return}</a>

<main>
  <figure>
    <Scene bind:this={scene} />
  </figure>

  <aside>
    <fieldset>
      <legend>studs</legend>
      <label>
        <span>Width</span>
        <input type="range" min="1" max="8" step="1" bind:value={width} />
        <output>{width}</output>
      </label>
      <label>
        <span>Length</span>
        <input type="range" min="1" max="8" step="1" bind:value={height} />
        <output>{height}</output>
      </label>
      <label>
        <span>Stud radius</span>
        <input type="range" min="0.2" max="0.5" step="0.02" bind:value={studRadius} />
        <output>{studRadius.toFixed(2)}</output>
      </label>
      <label>
        <span>Stud height</span>
        <input type="range" min="0.1" max="0.6" step="0.05" bind:value={studHeight} />
        <output>{studHeight.toFixed(2)}</output>
      </label>
    </fieldset>

    <fieldset>
      <legend>body</legend>
      <label>
        <span>Depth</span>
        <input type="range" min="0.5" max="3" step="0.1" bind:value={depth} />
        <output>{depth.toFixed(1)}</output>
      </label>
      <label>
        <span>Wall</span>
        <input type="range" min="0.1" max="0.5" step="0.02" bind:value={thickness} />
        <output>{thickness.toFixed(2)}</output>
      </label>
    </fieldset>

    <fieldset>
      <legend>look</legend>
      <label>
        <span>Color</span>
        <input type="color" bind:value={color} />
        <output>{color}</output>
      </label>
      <label>
        <span>Spin</span>
        <input type="range" min="0" max="3" step="0.1" bind:value={spin} />
        <output>{spin.toFixed(1)}</output>
      </label>
    </fieldset>
  </aside>
</main>
