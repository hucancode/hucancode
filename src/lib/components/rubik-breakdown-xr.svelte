<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    init,
    render,
    destroy,
    setCubeSize,
    remakeRubik,
  } from "$lib/scenes/rubikxr";

  let { canvasId = "rubikxr", showControls = true, size = 3 } = $props();
  let ready = $state(false);
  let currentDimension = $state(size);

  function updateDimension() {
    currentDimension = Math.max(1, Math.min(10, currentDimension));
    if (ready) {
      setCubeSize(currentDimension);
      remakeRubik(currentDimension);
    }
  }

  onMount(async () => {
    setCubeSize(currentDimension);
    await init(canvasId);
    ready = true;
  });

  onDestroy(() => {
    if (browser) {
      destroy();
    }
  });
</script>

<Canvas3D {ready} id={canvasId} {render} />
{#if showControls}
  <label for="dimension-slider">
    Dimension:
    <input
      id="dimension-slider"
      type="range"
      min="1"
      max="10"
      bind:value={currentDimension}
      onchange={updateDimension}
    />
    {currentDimension}×{currentDimension}×{currentDimension}
  </label>
{/if}

<style>
  label {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.9rem;
    margin: 1.5rem 0;
  }

  input[type="range"] {
    flex: 1;
  }
</style>
