<script>
  import { base } from "$app/paths";
  import "$styles/playground.css";
  import Return from "$icons/line-md/chevron-left.svg?raw";

  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { children } = $props();
</script>

<main class="playground">
  <nav><a href="/playgrounds">{@html Return} Playgrounds</a></nav>
  {@render children?.()}
</main>
