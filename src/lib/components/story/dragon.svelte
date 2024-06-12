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
    <h1>Let's create something amazing together! 🚀</h1>
    <ul>
      <li>Github</li>
      <li>Email</li>
      <li>Blog</li>
      <li>Resume</li>
    </ul>
  </div>
  <ScrollObserver on:scroll={onScroll} threshold={30}>
    <canvas id={CANVAS_ID} />
  </ScrollObserver>
</section>

<style>
</style>
