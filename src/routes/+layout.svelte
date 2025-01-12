<script>
  import { afterNavigate } from "$app/navigation";
  import { initGA, gtag, GA_MEASUREMENT_ID } from "$lib/ga";
  import "$styles/app.css";
  import { onMount } from "svelte";
  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { children } = $props();
  onMount(() => {
    initGA();
  });
  afterNavigate(() => {
    gtag("event", "page_view", {
      page_path: window.location.pathname,
    });
  });
</script>

<svelte:head>
  <script
    async
    src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
  ></script>
</svelte:head>

{@render children?.()}
