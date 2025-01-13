<script>
  import { _ } from "$lib/i18n";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import init from "$lib/wasm/dragon/flying-dragon.js";
  import Return from "$icons/line-md/chevron-left.svg?raw";
  import Idea from "$icons/line-md/lightbulb.svg?raw";

  let loading = $state(true);
  let notSupported = $state(false);
  onMount(async () => {
    try {
      if (!navigator.gpu) {
        notSupported = true;
        throw Error("WebGPU not supported.");
      }
      await init();
    } catch (e) {
      console.error("Something wrong when initialize graphics: " + e);
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Dragon</title>
</svelte:head>

<section>
  <figure>
    {#if loading}
      <span class="spinner" transition:fade={{ duration: 300 }}></span>
    {/if}
    {#if notSupported}
      <h1>
        {$_("home.showcase.noWebGPU")}
      </h1>
      <p>
        {$_("home.showcase.dragonFallback")}
      </p>
      <video autoplay loop muted>
        <source
          src="/blog/post/animated-dragon/dragon-rust.webm"
          type="video/webm"
        />
      </video>
    {/if}
    <canvas> </canvas>
  </figure>
  <div role="group" class="square">
    <a role="button" href="/">
      {@html Return}
      {$_("home.showcase.goback")}
    </a>
    <button>
      {@html Idea}
      {$_("home.showcase.surprise")}
    </button>
  </div>
</section>

<style>
  section {
    flex-grow: 1;
    justify-content: space-around;
  }
  figure {
    aspect-ratio: 4/3;
    width: 100%;
    display: grid;
    place-items: center;
    position: relative;
    gap: 1rem;
  }
  canvas {
    outline: none;
  }
  h1 {
    font-size: 24px;
    text-align: center;
  }
  p {
    text-align: center;
    font-style: italic;
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
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
