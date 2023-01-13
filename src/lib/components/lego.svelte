<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    destroy,
    render,
    playAnimation,
  } from "$lib/scenes/lego.js";

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
