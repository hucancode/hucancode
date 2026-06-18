<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { init, destroy, render, setCubeSize, setConfig, step } from "$lib/playgrounds/rubik";

  /** @type {number} */
  let { size = 3 } = $props();

  const CANVAS_ID = "rubik";
  let canvas = $state();
  let frameID = 0;

  function loop() {
    frameID = requestAnimationFrame(loop);
    render();
  }

  onMount(() => {
    setCubeSize(size);
    init(canvas);
    loop();
  });

  onDestroy(() => {
    if (browser) {
      cancelAnimationFrame(frameID);
      destroy();
    }
  });

  // Playground API
  export function apply(patch) {
    setConfig(patch);
  }
  export function stepOnce() {
    step();
  }
</script>

<canvas class="scene-canvas" id={CANVAS_ID} bind:this={canvas}></canvas>
