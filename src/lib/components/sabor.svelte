<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    destroy,
    render,
    playAction,
  } from "$lib/scenes/sabor";

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
    playAction();
  }
</script>

<Canvas3D bind:this={canvas} id={CANVAS_ID} {render} />
