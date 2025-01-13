<script>
  import { _ } from "$lib/i18n";
  import init from "$lib/wasm/rubik/rubik.js";
  import { onMount } from "svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
  import Idea from "$icons/line-md/lightbulb.svg?raw";

  let loading = $state(true);
  let notSupported = $state(false);
  let message = $state("Loading...");
  onMount(async () => {
    if (!navigator.gpu) {
      message =
        $_("home.showcase.noWebGPU") + $_("home.showcase.rubikFallback");
      notSupported = true;
      throw Error("WebGPU not supported.");
    }
    try {
      await init();
    } catch (e) {
      console.error("Something wrong when initialize graphics: " + e);
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Rubik</title>
</svelte:head>

<section>
  <figure>
    {#if loading}
      <h1>{message}</h1>
    {/if}
    <video autoplay loop controls muted class:enabled={notSupported}>
      <source
        <source
        src="/blog/post/how-did-i-build-the-rubiks-cube/rubik-rust.webm"
        type="video/webm"
      />
      type="video/webm" />
    </video>
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
  .enabled {
    display: block;
  }
  video {
    display: none;
  }
  section {
    flex-grow: 1;
    justify-content: space-around;
  }
  figure {
    aspect-ratio: 4/3;
    width: 100%;
    display: grid;
    place-items: center;
  }
  canvas {
    outline: none;
  }
  h1 {
    font-size: 24px;
    text-align: center;
    margin-bottom: 1rem;
  }
</style>
