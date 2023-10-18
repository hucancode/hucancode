<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  export let id;
  export let render;
  let isInCamera = false;
  let frameID = 0;
  let canvas;
  let loadingCircle;
  let showLoadingCircle = true;
  let observer;
  function loop() {
    frameID = requestAnimationFrame(loop);
    render();
  }
  onMount(async () => {
    await import("$shoelace/spinner/spinner");
    observer = new IntersectionObserver(([entry]) => {
      isInCamera = entry.isIntersecting;
      cancelAnimationFrame(frameID);
      if (isInCamera) {
        frameID = requestAnimationFrame(loop);
      }
    });
    observer.observe(canvas);
    frameID = requestAnimationFrame(loop);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameID);
    };
  });
  export function hideLoadingCircle() {
    showLoadingCircle = false;
  }
</script>

<div class="container">
  <div class="backdrop" />
  {#if showLoadingCircle}
    <sl-spinner
      transition:fade={{ delay: 250, duration: 300 }}
      bind:this={loadingCircle}
    />
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
    background-image: radial-gradient(closest-side,var(--sl-color-neutral-200),transparent);
  }
  .container {
    position: relative;
    width: 100%;
    height: 100%;
  }
  sl-spinner {
    font-size: xxx-large;
    --track-width: 10px;
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
  }
  canvas {
    position: absolute;
    width: 100%;
    height: 100%;
  }
</style>
