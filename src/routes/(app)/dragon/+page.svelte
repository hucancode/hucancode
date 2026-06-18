<script>
  import Scene from "$lib/components/dragon.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";

  let version = $state("webgl");
  let scene = $state(null);
  const PRESETS = [
    { id: "random", label: "Random" },
    { id: "circle", label: "Circle" },
    { id: "figure8", label: "Figure-8" },
    { id: "helix", label: "Helix" },
    { id: "wave", label: "Wave" },
  ];
  let preset = $state("random");
  let points = $state(20);
  let spread = $state(1);
  let speed = $state(0.8);
  let showLights = $state(true);
  let showPath = $state(false);
  let bodyFraction = $state(0.25);
  let girthFactor = $state(0.0012);

  $effect(() => {
    scene?.apply({ speed: speed / 1000, showLights, showPath });
  });

  const whiteList = ["This isn't actually an error!"];
  let error = $state(false);
  let rustCanvas = $state();
  let rustStarted = false;

  async function startRust() {
    if (rustStarted) return;
    rustStarted = true;
    error = false;
    try {
      const { default: init } = await import("$lib/wasm/dragon/flying-dragon.js");
      await init();
    } catch (e) {
      const msg = e?.message ?? String(e);
      if (whiteList.every((token) => msg.indexOf(token) < 0)) {
        error = true;
        throw e;
      }
    } finally {
      if (rustCanvas) rustCanvas.style = undefined;
    }
  }

  $effect(() => {
    if (version === "rust") startRust();
  });
</script>

<svelte:head>
  <title>Dragon</title>
</svelte:head>

<a class="back" href="/playgrounds">{@html Return} Playgrounds</a>

<main>
  <figure>
    {#if version === "webgl"}
      <Scene bind:this={scene} />
    {:else}
      <div class="rust">
        {#if error}
          <p class="fallback">Live render failed — here is a recording instead.</p>
          <video autoplay loop muted playsinline>
            <source src="/assets/video/dragon-rust.webm" type="video/webm" />
          </video>
        {/if}
        <canvas bind:this={rustCanvas}></canvas>
      </div>
    {/if}
  </figure>

  <aside>
    <fieldset>
      <legend>renderer</legend>
      <label>
        <span>Version</span>
        <select bind:value={version}>
          <option value="webgl">WebGL</option>
          <option value="rust">WebGPU · Rust/WASM</option>
        </select>
        <output></output>
      </label>
    </fieldset>

    {#if version === "webgl"}
      <fieldset>
        <legend>flight path</legend>
        <div class="square" role="group">
          {#each PRESETS as p}
            <label>
              <input type="radio" name="preset" value={p.id} bind:group={preset}
                onchange={() => scene?.reshape({ preset: p.id })} />
              {p.label}
            </label>
          {/each}
        </div>
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
          <input type="range" min="4" max="40" step="1" bind:value={points}
            onchange={() => scene?.reshape({ points })} />
          <output>{points}</output>
        </label>
        <label>
          <span>Path size</span>
          <input type="range" min="0.4" max="1.6" step="0.05" bind:value={spread}
            onchange={() => scene?.reshape({ spread })} />
          <output>{spread.toFixed(2)}</output>
        </label>
        <label>
          <span>Body length</span>
          <input type="range" min="0.05" max="0.6" step="0.01" bind:value={bodyFraction}
            onchange={() => scene?.reshape({ bodyFraction })} />
          <output>{bodyFraction.toFixed(2)}</output>
        </label>
        <label>
          <span>Girth</span>
          <input type="range" min="0.0004" max="0.004" step="0.0002" bind:value={girthFactor}
            onchange={() => scene?.reshape({ girthFactor })} />
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

      <div class="buttons">
        <button onclick={() => scene?.newPath()}>↻ New path</button>
        <button onclick={() => scene?.addDragon()}>＋ Add</button>
        <button onclick={() => scene?.reset()}>Reset</button>
      </div>
    {/if}
  </aside>
</main>

<style>
  .rust {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    gap: 1rem;
    overflow: hidden;
  }
  .rust canvas { outline: none; width: 100%; height: 100%; }
  .fallback { text-align: center; font-style: italic; }
  video { width: 100%; height: auto; }
</style>
