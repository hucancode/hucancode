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
<section>
  <div class="explain">
    <h1 rainbow="1" class="xl">
      Greetings!
    </h1>
    <h1>
      My name is Bang, I am a creative software engineer
      <input type="checkbox" id="expander" />
      <label for="expander">...</label>
      <span>and I use Arch by the way 😎</span>
    </h1>
    <p>Here are something I do for fun. Hope you enjoy them as much as I enjoy making them</p>
  </div>
  <ScrollObserver bind:this={observer} on:scroll={onScroll} threshold={30}>
    <canvas id={CANVAS_ID} bind:this={canvas} />
  </ScrollObserver>
</section>

<style>
  input[type="checkbox"] {
    & + label {
      display: contents;
      cursor: pointer;
    }
    & + label:hover {
      color: var(--color-primary-500);
    }
    &:checked + label {
      display: none;
    }
    &:checked ~ span {
      display: contents;
    }
    & ~ span {
      display: none;
    }
    display: none;
  }
  section {
    height: auto;
    flex-direction: column;
    padding-top: 2.5rem;
    padding-bottom: 2.5rem;
  }
  h1.xl {
    font-size: 3.5rem;
  }
  h1 {
    animation: bg-pingpong 2.5s ease infinite alternate;
    background-size: 200% 100%;
    cursor: default;
    display: flex;
    gap: 0.5em;
    align-items: center;
    text-align: center;
  }
  p {
    text-align: center;
    max-width: 640px;
  }
</style>
