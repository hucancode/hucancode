<script>
  import { onMount } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    render,
    getCurrentDragonCount,
    clearDragon,
    makeDragon,
  } from "$lib/scenes/dragon.js";

  let canvas;

  onMount(async () => {
    await init();
    canvas.hideLoadingCircle();
  });

  let MAX_DRAGON = 5;

  export function performMagic() {
    if (getCurrentDragonCount() > MAX_DRAGON) {
      clearDragon();
    }
    makeDragon();
  }
</script>

<Canvas3D bind:this={canvas} id={CANVAS_ID} {render} />
