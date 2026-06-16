<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    CANVAS_ID,
    init,
    render,
    destroy,
    getCurrentDragonCount,
    clearDragon,
    makeDragon,
    regenerate,
    setConfig,
  } from "$lib/scenes/dragon";

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

  const MAX_DRAGON = 8;

  export function performMagic() {
    if (getCurrentDragonCount() > MAX_DRAGON) {
      clearDragon();
    }
    makeDragon();
  }

  // Playground API ---------------------------------------------------------
  // change a knob that only affects the live render (speed, lights)
  export function apply(patch) {
    setConfig(patch);
  }
  // change a knob that reshapes the curve -> rebuild onto a new path
  export function reshape(patch) {
    setConfig(patch);
    regenerate();
  }
  export function newPath() {
    regenerate();
  }
  export function addDragon() {
    if (getCurrentDragonCount() >= MAX_DRAGON) return;
    makeDragon();
  }
  export function reset() {
    clearDragon();
    makeDragon();
  }
  export function count() {
    return getCurrentDragonCount();
  }
</script>

<Canvas3D {ready} id={CANVAS_ID} {render} />
