<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    render,
    destroy,
  } from "$lib/scenes/dragon-static";

  let ready = $state(false);

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