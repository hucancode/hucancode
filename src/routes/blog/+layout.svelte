<script>
  import Nav from "$lib/components/blog/nav.svelte";
  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { children } = $props();
</script>

<Nav />
{@render children?.()}
