<script>
  import { onMount } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import { CANVAS_ID, init, render, remakeRubik } from "$lib/scenes/rubik.js";

  let size = 3;
  let MAX_SIZE = 8;
  onMount(() => {
    init();
  });

  export function performMagic() {
    size = Math.max(1,(size+1)%MAX_SIZE);
    remakeRubik(size);
  }
</script>

<Canvas3D id={CANVAS_ID} {render} />
