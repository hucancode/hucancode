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

  onMount(async () => {
    await init();
  });

  let MAX_DRAGON = 5;

  export function performMagic() {
    if (getCurrentDragonCount() > MAX_DRAGON) {
      clearDragon();
    }
    makeDragon();
  }
</script>

<Canvas3D id={CANVAS_ID} {render} />
