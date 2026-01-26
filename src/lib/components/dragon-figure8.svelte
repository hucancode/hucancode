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
    setOffset(offset);
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

<Canvas3D {ready} id={CANVAS_ID} {render} />
<label for="offset-slider">
  Position on curve:
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
  {(offset * 100).toFixed(0)}%
</label>

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
