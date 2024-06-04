<script>
  import { _ } from "$lib/i18n";
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import ScrollObserver from "$lib/components/scroll-observer.svelte";
  import {
    CANVAS_ID,
    init,
    destroy,
    animateCamera,
    render,
  } from "$lib/scenes/dragon";

  let frameID;
  let canvas;
  let observer;

  function onScroll(e) {
    let r = e.detail;
    animateCamera(Math.min(1, r));
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

<section class="-blueprint">
  <div class="explain">
    <h1>
      It's a good day to create something great!
    </h1>
    <p>
      This is a dragon, a creature that is both feared and revered in many cultures.
      It is a symbol of power, strength, and wisdom.
    </p>
  </div>
  <ScrollObserver bind:this={observer} on:scroll={onScroll} threshold={30}>
    <canvas id={CANVAS_ID} bind:this={canvas} />
  </ScrollObserver>
</section>

<style>
  .explain {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding-top: 2.5rem;
    padding-bottom: 2.5rem;
  }
  .explain p {
    color: var(--color-neutral-600);
  }
  section {
    width: 100%;
    height: 80vh;
    display: flex;
    gap: 1rem;
    justify-content: center;
    align-items: center;
  }
  section {
    flex-direction: row-reverse;
    text-align: right;
  }
  canvas {
    width: 100%;
    aspect-ratio: 4/3;
    max-width: 640px;
    max-height: 480px;
    margin: auto;
  }
  @media (max-width: 768px) {
    section {
      flex-direction: column;
    }
  }
</style>
