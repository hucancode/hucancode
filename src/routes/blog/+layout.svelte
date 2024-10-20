<script>
  import Nav from "$lib/components/blog/nav.svelte";
  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { children } = $props();
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&family=Fira+Code:wght@400&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<Nav />
{@render children?.()}
