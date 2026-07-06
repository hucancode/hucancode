<script>
  // Shared canvas host for playground modules ({ init, render, destroy, setConfig }):
  // owns the RAF loop, the async-init cancel guard, and offscreen pause.
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";

  let { scene, id = undefined } = $props();

  let canvas = $state();
  let frameID = 0;
  let running = false;
  let observer;
  let cancelled = false;

  function loop() {
    frameID = requestAnimationFrame(loop);
    scene.render();
  }
  function start() {
    if (running) return;
    running = true;
    frameID = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(frameID);
  }

  onMount(() => {
    scene.init(canvas).then(() => {
      if (cancelled) return;
      observer = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
      observer.observe(canvas);
    });
    return () => { cancelled = true; };
  });

  onDestroy(() => {
    if (!browser) return;
    stop();
    observer?.disconnect();
    scene.destroy();
  });

  export function apply(patch) {
    scene.setConfig?.(patch);
  }
</script>

<canvas {id} bind:this={canvas}></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
