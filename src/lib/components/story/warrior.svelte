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
  } from "$lib/scenes/warrior";

  let frameID;
  let canvas;

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

<section class="-blueprint">
  <div class="explain">
    <h1>It's a good day to create something great!</h1>
    <p>
      This is a warrior, a fighter who is skilled in combat and warfare. They
      are known for their courage, strength, and honor.
    </p>
  </div>
  <ScrollObserver class="relative" on:scroll={onScroll} threshold={30}>
    <canvas id={CANVAS_ID} bind:this={canvas} />
    <div class="backdrop" />
  </ScrollObserver>
</section>

<style>
  .backdrop {
    position: absolute;
    z-index: -1;
    aspect-ratio: 1.2;
    top: 44.5%;
    width: 55%;
    background: rgba(136, 125, 151, 0.5);
    border: 1em solid rgba(215, 187, 255, 0.5);
  }
</style>
