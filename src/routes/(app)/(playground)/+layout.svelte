<script>
  import "$styles/playground.css";
  import Return from "$icons/line-md/chevron-left.svg?raw";

  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { children } = $props();
</script>

<main>
  <nav><a href="/playgrounds">{@html Return} Playgrounds</a></nav>
  {@render children?.()}
</main>
