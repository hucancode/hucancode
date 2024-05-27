<script>
  import { _ } from "$lib/i18n";
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import ScrollObserver from "$lib/components/scroll-observer.svelte";
  import {
    CANVAS_ID,
    init,
    destroy,
    setCameraControl,
    animateCamera,
    render,
  } from "$lib/scenes/lego";

  let frameID;
  let canvas;
  let observer;

  function onScroll(e) {
    let r = e.detail;
    animateCamera(Math.max(1, r));
    if (r > 0 && frameID === 0) {
      frameID = requestAnimationFrame(loop);
    }
    if (r <= 0 || r >= 2) {
      cancelAnimationFrame(frameID);
      frameID = 0;
    }
  }
  onMount(async () => {
    if (!browser) return;
    if (!canvas) return;
    setCameraControl(false);
    await init();
    frameID = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    if (!browser) return;
    cancelAnimationFrame(frameID);
    frameID = 0;
    destroy();
  });

  function loop() {
    frameID = requestAnimationFrame(loop);
    render();
  }
</script>
<section>
  <div class="greetings">
    <h1 rainbow="1">
      {$_("home.landing.hello")}
    </h1>
    <p>I am Bang, a problem solver with a strong passion for computer graphics and animation</p>
  </div>
  <ScrollObserver bind:this={observer} on:scroll={onScroll} threshold={30}>
    <canvas id={CANVAS_ID} bind:this={canvas} />
  </ScrollObserver>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding-top: 2.5rem;
    padding-bottom: 2.5rem;
  }
  .greetings {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding-top: 2.5rem;
    padding-bottom: 2.5rem;
  }
  h1 {
    animation: bg-pingpong 2.5s ease infinite alternate;
    background-size: 200% 100%;
    cursor: default;
    display: flex;
    gap: 0.5em;
    align-items: center;
  }
  p {
    text-align: center;
    max-width: 640px;
    color: var(--color-neutral-400);
  }
  canvas {
    margin: auto;
    width: 100%;
    aspect-ratio: 4/3;
    max-width: 640px;
    max-height: 480px;
  }
</style>
