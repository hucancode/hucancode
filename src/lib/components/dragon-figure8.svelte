<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    render,
    destroy,
    setOffset,
  } from "$lib/scenes/dragon-figure8";

  let ready = $state(false);
  let offset = $state(0.66);

  onMount(async () => {
    await init();
    setOffset(offset)
    ready = true;
  });

  onDestroy(() => {
    if (browser) {
      destroy();
    }
  });

  function handleSliderChange(event) {
    offset = parseFloat(event.target.value);
    setOffset(offset);
  }

  $effect(() => {
    if (browser) {
      const slider = document.getElementById("offset-slider");
      if (slider) {
        slider.style.setProperty("--slider-progress", `${offset * 100}%`);
      }
    }
  });
</script>

<div class="container">
    <Canvas3D {ready} id={CANVAS_ID} {render} />
  <div class="controls">
    <label for="offset-slider">
      Position on curve: {(offset * 100).toFixed(0)}%
    </label>
    <input
      id="offset-slider"
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={offset}
      oninput={handleSliderChange}
      style="--slider-progress: {offset * 100}%"
    />
  </div>
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    max-width: 100%;
  }

  label {
    font-size: 0.9rem;
    color: var(--text-secondary, #666);
  }

  input[type="range"] {
    width: 100%;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(
      to right,
      #00ff88 0%,
      #00ff88 var(--slider-progress, 0%),
      #ddd var(--slider-progress, 0%),
      #ddd 100%
    );
    outline: none;
    -webkit-appearance: none;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #00ff88;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  input[type="range"]::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #00ff88;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  input[type="range"]::-webkit-slider-thumb:hover {
    background: #00cc6a;
  }

  input[type="range"]::-moz-range-thumb:hover {
    background: #00cc6a;
  }
</style>
