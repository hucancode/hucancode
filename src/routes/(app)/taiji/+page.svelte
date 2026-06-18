<script>
  import Scene from "$lib/components/taiji.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";

  let scene = $state(null);
  let taijiSpin = $state(1);
  let cloudSpeed = $state(4);
  let bitCount = $state(3);
  let stroke = $state(0.04);
  let dot = $state(0.12);
  let color1 = $state("#ffffff");
  let color2 = $state("#000000");

  $effect(() => {
    scene?.apply({
      taijiSpin: taijiSpin / 100,
      cloudSpeed,
      bitCount,
      stroke,
      dot,
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
      <legend>symbol</legend>
      <label>
        <span>Bagua bars</span>
        <input type="range" min="1" max="5" step="1" bind:value={bitCount} />
        <output>{bitCount}</output>
      </label>
      <label>
        <span>Border size</span>
        <input type="range" min="0" max="0.15" step="0.005" bind:value={stroke} />
        <output>{stroke.toFixed(3)}</output>
      </label>
      <label>
        <span>Dot size</span>
        <input type="range" min="0.04" max="0.2" step="0.005" bind:value={dot} />
        <output>{dot.toFixed(3)}</output>
      </label>
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
