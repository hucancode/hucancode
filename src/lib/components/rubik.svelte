<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    render,
    destroy,
    getCurrentSize,
    remakeRubik,
  } from "$lib/scenes/rubik";

  let ready = $state(false);

  /**
   * @typedef {Object} Props
   * @property {any} [size]
   */

  /** @type {Props} */
  let { size = $bindable(getCurrentSize()) } = $props();
  const MAX_SIZE = 6;
  const MIN_SIZE = 2;

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
    const n = MAX_SIZE - MIN_SIZE;
    size = ((size - MIN_SIZE + 1) % n) + MIN_SIZE;
    remakeRubik(size);
  }
</script>

<Canvas3D {ready} id={CANVAS_ID} {render} />
