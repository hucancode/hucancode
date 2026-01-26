<script>
  import { _ } from "$lib/i18n";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { gtag } from "$lib/ga";
  import init from "$lib/wasm/dragon/flying-dragon.js";
  import Return from "$icons/line-md/chevron-left.svg?raw";
  import Idea from "$icons/line-md/lightbulb.svg?raw";
  const whiteList = ["This isn't actually an error!"];
  let loading = $state(true);
  let notSupported = $state(false);
  let error = $state(false);
  let canvas = $state();
  onMount(async () => {
    try {
      if (!navigator.gpu) {
        notSupported = true;
        gtag("event", "error", {
          event_category: "WebGPU",
          event_label: "Not Supported",
        });
        throw Error("WebGPU not supported.");
      }
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
  <title>Dragon</title>
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
        {$_("home.showcase.dragonFallback")}
      </p>
      <video autoplay loop muted>
        <source
          src="/blog/post/animated-dragon/dragon-rust.webm"
          type="video/webm"
        />
      </video>
    {/if}
    <canvas bind:this={canvas}> </canvas>
  </figure>
  <div role="group" class="square">
    <a role="button" href="/">
      {@html Return}
      {$_("home.showcase.goback")}
    </a>
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
    position: relative;
    gap: 1rem;
    overflow: hidden;
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
