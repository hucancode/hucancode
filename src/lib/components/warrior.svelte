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
  } from "$lib/scenes/warrior";

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

  export function performMagic() {
    playAction();
  }
</script>

<Canvas3D {ready} id={CANVAS_ID} {render} />
