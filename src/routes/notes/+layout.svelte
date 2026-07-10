<script>
  import Nav from "$lib/components/nav.svelte";
  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { children } = $props();
</script>

<Nav />
<main>
  {@render children?.()}
</main>

<style>
  /* center children like body used to; rest comes from the global main rule */
  main {
    align-items: center;
    flex: 1;
  }
</style>
