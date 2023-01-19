<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    render,
    destroy,
    getCurrentSize,
    remakeRubik,
  } from "$lib/scenes/rubik";

  let canvas;
  export let size = getCurrentSize() - 1;
  let MAX_SIZE = 6;

  onMount(async () => {
    await init();
    remakeRubik(size);
    canvas.hideLoadingCircle();
  });

  onDestroy(() => {
    if (browser) {
      destroy();
    }
  });

  export function performMagic() {
    size = (size + 1) % MAX_SIZE;
    remakeRubik(size + 1);
  }
</script>

<Canvas3D bind:this={canvas} id={CANVAS_ID} {render} />
