<script>
  import { onMount } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    render,
    clearDragon,
    makeDragon,
  } from "$lib/scenes/dragon.js";

  onMount(() => {
    init();
  });

  let dragonCount = 1;
  let MAX_DRAGON = 8;

  export function performMagic() {
    if (dragonCount <= MAX_DRAGON) {
      dragonCount++;
    } else {
      dragonCount = 1;
      clearDragon();
    }
    makeDragon();
  }
</script>

<Canvas3D id={CANVAS_ID} {render} />
