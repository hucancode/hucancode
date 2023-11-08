<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  export let id;
  export let render;
  let frameID = 0;
  let canvas;
  export let ready = false;
  let observer;
  function loop() {
    frameID = requestAnimationFrame(loop);
    render();
  }
  onMount(() => {
    observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        frameID = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(frameID);
      }
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameID);
    };
  });
</script>

<div class="container">
  <div class="backdrop" />
  {#if !ready}
    <span class="spinner" transition:fade={{ duration: 300 }} />
  {/if}
  <canvas {id} bind:this={canvas} />
</div>

<style>
  .backdrop {
    position: absolute;
    left: 50%;
    top: 50%;
    margin-left: auto;
    margin-right: auto;
    aspect-ratio: 1 / 1;
    height: 90%;
    translate: -50% -50%;
    background-size: contain;
    background-image: radial-gradient(
      closest-side,
      var(--color-neutral-200),
      transparent
    );
  }
  .container {
    position: relative;
    width: 100%;
    height: 100%;
  }
  .container .spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    width: 4rem;
  }
  canvas {
    position: absolute;
    width: 100%;
    height: 100%;
  }
  .spinner {
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
