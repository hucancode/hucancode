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
  } from "$lib/scenes/taiji";

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
    <h1>
      It's a good day to create something great!
    </h1>
    <p>
      This is a Taiji, a symbol of the philosophy of yin and yang.
      It represents the idea that everything in the universe consists of two forces that are opposing but complementary.
    </p>
  </div>
  <ScrollObserver on:scroll={onScroll} threshold={30}>
    <canvas id={CANVAS_ID} bind:this={canvas} />
  </ScrollObserver>
</section>

<style>
</style>
