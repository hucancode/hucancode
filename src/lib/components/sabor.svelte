<script>
  import { onMount } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import { CANVAS_ID, init, render, playIntro } from "$lib/scenes/sabor.js";

  onMount(() => {
    init();
  });

  export function performMagic() {
    playIntro();
  }
</script>

<Canvas3D id={CANVAS_ID} {render} />
