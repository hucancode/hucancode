<script>
  import Nav from "$lib/components/nav.svelte";
  import "$styles/playground.css";

  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { children } = $props();
</script>

<Nav current="/playgrounds" />
<main>
  {@render children?.()}
</main>
