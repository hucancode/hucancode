<script>
  import { fade } from "svelte/transition";
  import Panel from "$lib/components/playground/panel.svelte";
  import Scene from "$lib/components/dragon.svelte";

  // version: "webgl" (Three.js playground, default) | "rust" (WebGPU/WASM)
  let version = $state("webgl");

  // --- WebGL playground knobs -------------------------------------------
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
  let speed = $state(0.8); // shown ×1000 of curve fraction/frame
  let showLights = $state(true);

  function setPreset(id) {
    preset = id;
    scene?.reshape({ preset: id });
  }
  // live knobs
  $effect(() => {
    scene?.apply({ speed: speed / 1000, showLights });
  });

  // --- Rust / WebGPU version --------------------------------------------
  const whiteList = ["This isn't actually an error!"];
  let loading = $state(true);
  let error = $state(false);
  let rustCanvas = $state();
  let rustStarted = false;

  async function startRust() {
    if (rustStarted) return;
    rustStarted = true;
    loading = true;
    error = false;
    try {
      const { default: init } = await import(
        "$lib/wasm/dragon/flying-dragon.js"
      );
      await init();
    } catch (e) {
      const msg = e?.message ?? String(e);
      if (whiteList.every((token) => msg.indexOf(token) < 0)) {
        error = true;
        throw e;
      }
    } finally {
      loading = false;
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

<Panel title="Dragon">
  {#snippet stage()}
    {#if version === "webgl"}
      <Scene bind:this={scene} />
    {:else}
      <div class="rust">
        {#if loading}
          <span class="spinner" transition:fade={{ duration: 300 }}></span>
        {/if}
        {#if error}
          <p class="fallback">Live render failed — here is a recording instead.</p>
          <video autoplay loop muted playsinline>
            <source src="/assets/video/dragon-rust.webm" type="video/webm" />
          </video>
        {/if}
        <canvas bind:this={rustCanvas}></canvas>
      </div>
    {/if}
  {/snippet}

  {#snippet controls()}
    <label class="row">
      <span>Version</span>
      <select bind:value={version}>
        <option value="webgl">WebGL · Three.js</option>
        <option value="rust">WebGPU · Rust/WASM</option>
      </select>
    </label>

    {#if version === "webgl"}
      <div class="row">
        <span>Flight path</span>
        <div class="seg">
          {#each PRESETS as p}
            <button aria-pressed={preset === p.id} onclick={() => setPreset(p.id)}>
              {p.label}
            </button>
          {/each}
        </div>
      </div>

      <label class="row">
        <span>Speed <span class="val">{speed.toFixed(1)}</span></span>
        <input type="range" min="0" max="4" step="0.1" bind:value={speed} />
      </label>

      <label class="row">
        <span>Path detail <span class="val">{points} pts</span></span>
        <input
          type="range"
          min="4"
          max="40"
          step="1"
          bind:value={points}
          onchange={() => scene?.reshape({ points })}
        />
      </label>

      <label class="row">
        <span>Path size <span class="val">{spread.toFixed(2)}×</span></span>
        <input
          type="range"
          min="0.4"
          max="1.6"
          step="0.05"
          bind:value={spread}
          onchange={() => scene?.reshape({ spread })}
        />
      </label>

      <label class="row toggle-row">
        <span>Animated lights</span>
        <input type="checkbox" bind:checked={showLights} />
      </label>

      <button class="action" onclick={() => scene?.newPath()}>↻ New path</button>
      <button class="action" onclick={() => scene?.addDragon()}>＋ Add dragon</button>
      <button class="action" onclick={() => scene?.reset()}>Reset</button>
    {/if}
  {/snippet}

  {#snippet notes()}
    {#if version === "webgl"}
      <p>
        The dragon follows a <strong>Catmull-Rom spline</strong> through a set of
        control points. <em>Flight path</em> swaps the point pattern — Random scatters
        them for a new flight each time; the others trace analytic curves.
      </p>
      <p>
        <em>Path detail</em> is how many points feed the spline,
        <em>Path size</em> scales the whole curve, and <em>Speed</em> is the
        fraction of the curve advanced per frame.
      </p>
    {:else}
      <p>
        The same dragon, rendered by a <strong>Rust</strong> program compiled to
        WebAssembly and drawn with <strong>WebGPU</strong>. Needs a
        WebGPU-capable browser; otherwise a recording plays.
      </p>
    {/if}
  {/snippet}
</Panel>

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
  .rust canvas {
    outline: none;
    width: 100%;
    height: 100%;
  }
  .fallback {
    text-align: center;
    font-style: italic;
  }
  video {
    width: 100%;
    height: auto;
  }
  .spinner {
    position: absolute;
    width: 4rem;
    aspect-ratio: 1;
    border: 0.8rem solid var(--color-primary-500);
    border-bottom-color: transparent;
    border-radius: 50%;
    animation: rotation 1s linear infinite;
  }
  @keyframes rotation {
    to {
      transform: rotate(360deg);
    }
  }
</style>
