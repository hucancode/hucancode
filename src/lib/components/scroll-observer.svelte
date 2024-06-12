<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { createEventDispatcher } from "svelte";
  export let threshold = 1;
  let className;
  export { className as class };
  let container;
  let observer;
  let dispatch = createEventDispatcher();
  onMount(() => {
    if (!browser) return;
    observer = new IntersectionObserver(
      ([entry]) => {
        let towardTop = entry.boundingClientRect.top < 0;
        let r = towardTop
          ? 2 - entry.intersectionRatio
          : entry.intersectionRatio;
        dispatch("scroll", r);
      },
      {
        threshold: Array.from(
          { length: threshold + 1 },
          (_, i) => i / threshold
        ),
      }
    );
    observer.observe(container);
  });
  onDestroy(() => {
    if (!browser) return;
    observer.disconnect();
  });
</script>

<div bind:this={container} class={className}>
  <slot />
</div>

<style>
  div {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
  }
</style>
