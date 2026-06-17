<script>
  import { fade } from "svelte/transition";
  import Scene from "$lib/components/rubik.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";

  let version = $state("webgl");
  let scene = $state(null);
  let size = $state(3);
  let speed = $state(1);
  let autoplay = $state(true);
  let randomEase = $state(true);

  $effect(() => {
    scene?.apply({ speed, autoplay, randomEase });
  });

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

<a class="back" href="/playgrounds">{@html Return}</a>

<main>
  <figure>
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
  </figure>

  <aside>
    <fieldset>
      <legend>renderer</legend>
      <label>
        <span>Version</span>
        <select bind:value={version}>
          <option value="webgl">WebGL · Three.js</option>
          <option value="rust">WebGPU · Rust/WASM</option>
        </select>
        <output></output>
      </label>
    </fieldset>

    {#if version === "webgl"}
      <fieldset>
        <legend>parameters</legend>
        <label>
          <span>Cube size</span>
          <input type="range" min="2" max="6" step="1" bind:value={size} />
          <output>{size}³</output>
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
        <div class="buttons">
          <button onclick={() => scene?.stepOnce()}>▶ One move</button>
        </div>
      {/if}
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
  .spinner {
    position: absolute;
    width: 4rem;
    aspect-ratio: 1;
    border: 0.3rem solid rgba(107, 78, 113, 0.2);
    border-top-color: #6b4e71;
    animation: rotation 1s linear infinite;
  }
  @keyframes rotation {
    to { transform: rotate(360deg); }
  }
</style>
