<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import { init, render, destroy } from "$lib/scenes/rubik1";

  let { canvasId = "rubik1" } = $props();
  let ready = $state(false);

  onMount(async () => {
    await init(canvasId);
    ready = true;
  });

  onDestroy(() => {
    if (browser) {
      destroy();
    }
  });
</script>

<Canvas3D {ready} id={canvasId} {render} />
