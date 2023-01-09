<script>
  import { onMount } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import { CANVAS_ID, init, render, playAnimation } from "$lib/scenes/lego.js";

  let canvas;
  onMount(async () => {
    await init();
    canvas.hideLoadingCircle();
  });

  export function performMagic() {
    playAnimation();
  }
</script>

<Canvas3D bind:this={canvas} id={CANVAS_ID} {render} />
