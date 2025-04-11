<script>
  import { _ } from "$lib/i18n";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { gtag } from "$lib/ga";
  import init from "$lib/wasm/rubik/rubik.js";
  import Return from "$icons/line-md/chevron-left.svg?raw";
  import Idea from "$icons/line-md/lightbulb.svg?raw";

  const whiteList = ["This isn't actually an error!"];
  let loading = $state(true);
  let notSupported = $state(false);
  let error = $state(false);
  let canvas = $state();
  onMount(async () => {
    try {
      await init();
    } catch (e) {
      let real = whiteList.every((token) => e.message.indexOf(token) < 0);
      if (real) {
        error = true;
        throw e;
      }
    } finally {
      loading = false;
      canvas.style = undefined;
    }
  });
</script>

<svelte:head>
  <title>Rubik</title>
</svelte:head>

<section>
  <figure>
    {#if loading}
      <span class="spinner" transition:fade={{ duration: 300 }}></span>
    {/if}
    {#if notSupported || error}
      {#if notSupported}
        <h1>
          {$_("home.showcase.noWebGPU")}
        </h1>
      {:else if error}
        <h1>
          {$_("home.showcase.appError")}
        </h1>
      {/if}
      <p>
        {$_("home.showcase.rubikFallback")}
      </p>
      <video autoplay loop muted>
        <source
          <source
          src="/blog/post/how-did-i-build-the-rubiks-cube/rubik-rust.webm"
          type="video/webm"
        />
        type="video/webm" />
      </video>
    {/if}
    <canvas bind:this={canvas}> </canvas>
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
    display: flex;
    flex-direction: column;
    justify-items: center;
    align-items: center;
    gap: 1rem;
  }
  canvas {
    outline: none;
    width: 100%;
    height: auto;
  }
  h1 {
    font-size: 24px;
    text-align: center;
  }
  p {
    text-align: center;
    font-style: italic;
  }
</style>
