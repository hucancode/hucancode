<script>
  // Shared canvas host for playground modules ({ init, render, destroy, setConfig }):
  // owns the RAF loop, the async-init cancel guard, and offscreen pause.
  //
  // The scene module can be SWAPPED at runtime (the atlas toggles its ray tracer):
  // an effect tears down the old renderer and boots the new one, then re-applies
  // every patch the page has sent so the new renderer is framed and fed at once.
  //
  // onFrame(dt) fires once per rendered frame with the engine's clamped dt. Pages
  // with their own clocks (autoplay, build scrub, scroll scrubbing) hook it rather
  // than starting a second RAF, so those clocks pause offscreen too.
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";

  let { scene, id = undefined, onFrame = undefined, onError = undefined } = $props();

  let canvas = $state();
  let frameID = 0;
  let running = false;
  let observer;
  let current;
  let pending = null;        // merged patches; re-applied to a swapped-in scene
  let initGen = 0;

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

  async function initScene(sc) {
    const gen = ++initGen;
    current = sc;
    try {
      await sc.init(canvas);
    } catch (err) {
      console.error("[playground] init failed", err);
      onError?.(err);
      return;
    }
    if (gen !== initGen || !browser) return;
    if (pending) sc.setConfig?.(pending);
    observer = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
    observer.observe(canvas);
  }

  onMount(() => {
    initScene(scene);
    return () => { initGen++; };
  });

  $effect(() => {
    if (!canvas) return;
    if (current === undefined) { current = scene; return; }
    if (scene === current) return;
    // swap the renderer: stop the old one, boot the new one
    stop();
    observer?.disconnect();
    current?.destroy?.();
    initScene(scene);
  });

  onDestroy(() => {
    if (!browser) return;
    stop();
    observer?.disconnect();
    initGen++;
    current?.destroy?.();
  });

  export function apply(patch) {
    pending = pending ? { ...pending, ...patch } : { ...patch };
    scene.setConfig?.(patch);
  }
</script>

<canvas {id} bind:this={canvas}></canvas>
