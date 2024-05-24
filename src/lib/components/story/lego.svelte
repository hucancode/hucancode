
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
    animateCamera(r);
    if(r > 0 && frameID === 0) {
      frameID = requestAnimationFrame(loop);
    } if(r <= 0 || r >= 2) {
      cancelAnimationFrame(frameID);
      frameID = 0;
    }
  }
  onMount(async () => {
    if(!browser) return;
    if(!canvas) return;
    setCameraControl(false);
    await init();
    frameID = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    if(!browser) return;
    cancelAnimationFrame(frameID);
    frameID = 0;
    destroy();
  });

  function loop() {
    frameID = requestAnimationFrame(loop);
    render();
  }
</script>

      <div class="greetings">
        <h1 rainbow="1">
          {$_("home.landing.hello")}
        </h1>
      </div>
<div class="blueprint">
  <div class="card">
    <div class="icons">
      <div class="icon-container">
        <div class="halo">
          <div class="icon">
            <img src="https://api.iconify.design/simple-icons:grafana.svg" />
          </div>
        </div>
      </div>

      <div class="icon-container">
        <div class="halo">
          <div class="icon">
            <img src="https://api.iconify.design/simple-icons:firefox.svg" />
          </div>
        </div>
      </div>
      <div class="icon-container" active>
        <div class="halo">
          <div class="icon">
            <img src="https://api.iconify.design/simple-icons:apachekylin.svg" />
          </div>
        </div>
      </div>
      <div class="icon-container">
        <div class="halo">
          <div class="icon">
            <img src="https://api.iconify.design/simple-icons:paperlessngx.svg" />
          </div>
        </div>
      </div>
      <div class="icon-container">
        <div class="halo">
          <div class="icon">
            <img src="https://api.iconify.design/simple-icons:reactivex.svg" />
          </div>
        </div>
      </div>
    </div>
  </div>
  <ScrollObserver bind:this={observer} on:scroll={onScroll} threshold={30} >
    <canvas id={CANVAS_ID} bind:this={canvas} />
  </ScrollObserver>
</div>
<svg>
  <defs>
    <pattern id="pattern-stripe"
      width="4" height="4"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)">
      <rect width="2" height="4" transform="translate(0,0)" fill="white"></rect>
    </pattern>
    <mask id="mask-stripe">
      <rect x="0" y="0" width="9999px" height="9999px" fill="url(#pattern-stripe)" />
    </mask>
  </defs>
</svg>
<style>
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
  .blueprint {
    width: 100%;
    display: flex;
    gap: 1rem;
    justify-content: center;
    align-items: center;
    flex: 1;
  }
  canvas {
    width: 100%;
    aspect-ratio: 4/3;
    max-width: 640px;
    max-height: 480px;
  }
  @media (max-width: 768px) {
    .blueprint {
      flex-direction: column;
    }
  }
  .card {
    mask: url(#mask-stripe);
  }
</style>