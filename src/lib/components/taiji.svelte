<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { init, destroy, render, setConfig, setColors } from "$lib/playgrounds/taiji";

  const CANVAS_ID = "taiji";
  let canvas = $state();
  let frameID = 0;

  function loop() {
    frameID = requestAnimationFrame(loop);
    render();
  }

  onMount(() => {
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
  export function colors(c1, c2) {
    setColors(c1, c2);
  }
</script>

<canvas class="scene-canvas" id={CANVAS_ID} bind:this={canvas}></canvas>
