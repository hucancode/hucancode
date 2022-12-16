<script>
  import { onMount } from "svelte";
  export let id;
  export let render;
  let isInCamera = false;
  let frameID = 0;
  let canvas;
  let loadingCircle;
  let observer;
  function loop() {
    frameID = requestAnimationFrame(loop);
    render();
  }
  onMount(() => {
    observer = new IntersectionObserver(([entry]) => {
      isInCamera = entry.isIntersecting;
      cancelAnimationFrame(frameID);
      if (isInCamera) {
        frameID = requestAnimationFrame(loop);
      }
    });
    observer.observe(canvas);
    loadingCircle.classList.add("invisible");
    frameID = requestAnimationFrame(loop);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameID);
    };
  });
</script>

<div class="relative h-full w-full">
  <div
    bind:this={loadingCircle}
    class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
  >
    <svg
      class="h-10 w-10 animate-spin text-black dark:text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  </div>
  <canvas class="absolute h-full w-full" {id} bind:this={canvas} />
</div>
