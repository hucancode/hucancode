<script>
  import { onMount } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import { CANVAS_ID, init, render, playAction } from "$lib/scenes/sabor.js";

  let canvas;

  onMount(async () => {
    await init();
    canvas.hideLoadingCircle();
  });

  export function performMagic() {
    playAction();
  }
</script>

<Canvas3D bind:this={canvas} id={CANVAS_ID} {render} />
