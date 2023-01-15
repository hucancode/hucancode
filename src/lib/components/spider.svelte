<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import { CANVAS_ID, init, destroy, render } from "$lib/scenes/spider.js";

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

  export function performMagic() {}
</script>

<Canvas3D bind:this={canvas} id={CANVAS_ID} {render} />
