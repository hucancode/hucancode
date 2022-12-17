<script>
  import { onMount } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import { CANVAS_ID, init, render, playAction } from "$lib/scenes/sabor.js";

  onMount(() => {
    init();
  });

  export function performMagic() {
    playAction();
  }
</script>

<Canvas3D id={CANVAS_ID} {render} />
