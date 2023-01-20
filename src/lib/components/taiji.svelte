<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    render,
    destroy,
    playAnimation,
  } from "$lib/scenes/taiji";

  let canvas;
  onMount(async () => {
    await init();
    canvas.hideLoadingCircle();
  });

  onDestroy(() => {
    if (browser) {
      destroy();
    }
  });

  export function performMagic() {
    playAnimation();
  }
</script>

<Canvas3D bind:this={canvas} id={CANVAS_ID} {render} />
