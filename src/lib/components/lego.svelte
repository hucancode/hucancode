<script>
  import { onMount } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    render,
  } from "$lib/scenes/lego.js";

  let canvas;
  onMount(async () => {
    await init();
    canvas.hideLoadingCircle();
  });

  export function performMagic() {
  }
</script>

<Canvas3D bind:this={canvas} id={CANVAS_ID} {render} />
