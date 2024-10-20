<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    render,
    destroy,
    playAnimation,
  } from "$lib/scenes/taiji";

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

  export function performMagic() {
    playAnimation();
  }
</script>

<Canvas3D {ready} id={CANVAS_ID} {render} />
