<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
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
  } from "$lib/playgrounds/dragon";

  let canvas = $state();
  let frameID = 0;
  let cancelled = false;

  function loop() {
    frameID = requestAnimationFrame(loop);
    render();
  }

  onMount(() => {
    init().then(() => {
      if (cancelled) return;
      loop();
    });
    return () => { cancelled = true; };
  });

  onDestroy(() => {
    if (browser) {
      cancelAnimationFrame(frameID);
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

<canvas class="scene-canvas" id={CANVAS_ID} bind:this={canvas}></canvas>
