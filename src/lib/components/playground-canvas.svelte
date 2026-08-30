<script>
  // Shared canvas host for playground modules ({ init, render, destroy, setConfig }):
  // owns the RAF loop, the async-init cancel guard, and offscreen pause.
  //
  // onFrame(dt) fires once per rendered frame with the engine's clamped dt. Pages
  // with their own clocks (autoplay, build scrub, scroll scrubbing) hook it rather
  // than starting a second RAF, so those clocks pause offscreen too.
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";

  let { scene, id = undefined, onFrame = undefined } = $props();

  let canvas = $state();
  let frameID = 0;
  let running = false;
  let observer;
  let cancelled = false;

  function loop() {
    frameID = requestAnimationFrame(loop);
    // render() must run every frame; ?. would short-circuit the arg when no onFrame
    const dt = scene.render();
    onFrame?.(dt);
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
