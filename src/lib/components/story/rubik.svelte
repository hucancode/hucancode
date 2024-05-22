
<script>
  import { _ } from "$lib/i18n";
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import {
    CANVAS_ID,
    init,
    destroy,
    setCameraControl,
    animateCamera,
    render,
  } from "$lib/scenes/rubik";

  const OBSERVATION_RESOLUTION = 30;
  let frameID;
  let canvas;
  let observer;
  onMount(async () => {
    if(!browser) return;
    if(!canvas) return;
    setCameraControl(false);
    await init();
    frameID = requestAnimationFrame(loop);
    observer = new IntersectionObserver(([entry]) => {
      // console.log(entry.intersectionRatio);
      animateCamera(entry.intersectionRatio);
      canvas.style.opacity = Math.sin(entry.intersectionRatio * Math.PI/2);
      if(entry.intersectionRatio > 0 && frameID === 0) {
        frameID = requestAnimationFrame(loop);
      } if(entry.intersectionRatio <= 0) {
        cancelAnimationFrame(frameID);
        frameID = 0;
      }
    }, {
      threshold: Array.from({ length: OBSERVATION_RESOLUTION + 1 }, (_, i) => i/OBSERVATION_RESOLUTION)
    });
    observer.observe(canvas);
    loop();
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

<div class="blueprint">
  <div class="greetings">
    <h1 rainbow="1">
      {$_("home.landing.hello")}
    </h1>
  </div>
  <canvas id={CANVAS_ID} bind:this={canvas} />
</div>

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
</style>