<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { init, destroy, render, setConfig } from "$lib/playgrounds/lego";

  const CANVAS_ID = "lego";
  let canvas = $state();
  let frameID = 0;

  function loop() {
    frameID = requestAnimationFrame(loop);
    render();
  }

  let cancelled = false;
  onMount(() => {
    init(canvas).then(() => {
      if (cancelled) return;
      loop();
    });
    return () => { cancelled = true; };
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
</script>

<canvas class="scene-canvas" id={CANVAS_ID} bind:this={canvas}></canvas>
