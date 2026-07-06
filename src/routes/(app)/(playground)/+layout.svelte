<script>
  import { base } from "$app/paths";
  import "$styles/playground.css";

  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { children } = $props();
</script>

<nav><a href="/playgrounds">Playgrounds</a></nav>
<main>
  {@render children?.()}
</main>
