<script>
  import init from "$lib/wasm/rubik/rubik.js";
  import { onMount } from "svelte";

  let loading = $state(true);
  let message = $state("Loading...");
  onMount(async () => {
    if (!navigator.gpu) {
      message =
        "WebGPU not supported in this browser. Please use Chrome Canary with --enable-unsafe-webgpu flag.";
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
<div>
  {#if loading}
    <h1>{message}</h1>
  {/if}
  <canvas></canvas>
</div>

<style>
  div {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: grid;
    place-items: center;
  }
  canvas {
    display: block;
    margin: auto;
  }
  h1 {
    font-size: 24px;
  }
</style>
