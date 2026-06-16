<script>
  import { fade } from "svelte/transition";
  import Panel from "$lib/components/playground/panel.svelte";
  import Scene from "$lib/components/rubik.svelte";

  // version: "webgl" (Three.js playground, default) | "rust" (WebGPU/WASM)
  let version = $state("webgl");

  // --- WebGL playground knobs -------------------------------------------
  let scene = $state(null);
  let size = $state(3); // cube order N (NxNxN); change remounts the scene
  let speed = $state(1);
  let autoplay = $state(true);
  let randomEase = $state(true);

  // live knobs (re-applied after a remount because `scene` changes)
  $effect(() => {
    scene?.apply({ speed, autoplay, randomEase });
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
      const { default: init } = await import("$lib/wasm/rubik/rubik.js");
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
  <title>Rubik</title>
</svelte:head>

<Panel title="Rubik's Cube">
  {#snippet stage()}
    {#if version === "webgl"}
      {#key size}
        <Scene bind:this={scene} {size} />
      {/key}
    {:else}
      <div class="rust">
        {#if loading}
          <span class="spinner" transition:fade={{ duration: 300 }}></span>
        {/if}
        {#if error}
          <p class="fallback">Live render failed — here is a recording instead.</p>
          <video autoplay loop muted playsinline>
            <source src="/assets/video/rubik-rust.webm" type="video/webm" />
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
      <label class="row">
        <span>Cube size <span class="val">{size}×{size}×{size}</span></span>
        <input type="range" min="2" max="6" step="1" bind:value={size} />
      </label>

      <label class="row">
        <span>Turn speed <span class="val">{speed.toFixed(1)}×</span></span>
        <input type="range" min="0.25" max="3" step="0.25" bind:value={speed} />
      </label>

      <label class="row toggle-row">
        <span>Auto-shuffle</span>
        <input type="checkbox" bind:checked={autoplay} />
      </label>

      <label class="row toggle-row">
        <span>Random easing</span>
        <input type="checkbox" bind:checked={randomEase} />
      </label>

      {#if !autoplay}
        <button class="action" onclick={() => scene?.stepOnce()}>▶ One move</button>
      {/if}
    {/if}
  {/snippet}

  {#snippet notes()}
    {#if version === "webgl"}
      <p>
        Each turn grabs every cubelet on a face into a temporary pivot, rotates
        it 90°, then bakes the result back. <em>Cube size</em> rebuilds the
        whole stack as an N×N×N puzzle.
      </p>
      <p>
        <em>Turn speed</em> scales the animation; <em>Random easing</em> picks a
        different easing curve every move (turn it off for a clean ease). With
        <em>Auto-shuffle</em> off you can step one move at a time.
      </p>
    {:else}
      <p>
        The same cube, rendered by a <strong>Rust</strong> program compiled to
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
