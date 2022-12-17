<script>
  import { onMount } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    render,
    getCurrentSize,
    remakeRubik,
  } from "$lib/scenes/rubik.js";

  let size = getCurrentSize() - 1;
  let MAX_SIZE = 6;
  onMount(async () => {
    await init();
  });

  export function performMagic() {
    size = (size + 1) % MAX_SIZE;
    remakeRubik(size + 1);
  }
</script>

<Canvas3D id={CANVAS_ID} {render} />
