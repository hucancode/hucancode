<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import { CANVAS_ID, init, render, destroy } from "$lib/scenes/rubik3";

  let ready = false;

  onMount(async () => {
    await init();
    ready = true;
  });

  onDestroy(() => {
    if (browser) {
      destroy();
    }
  });
</script>

<Canvas3D {ready} id={CANVAS_ID} {render} />
