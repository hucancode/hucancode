<script>
  import { onMount } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import { CANVAS_ID, init, render } from "$lib/scenes/dragon.js";

  onMount(() => {
    init();
  });
</script>

<Canvas3D id={CANVAS_ID} {render} />
