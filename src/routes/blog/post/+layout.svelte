<script>
  //import "prismjs/themes/prism-twilight.css";
  import "$styles/prism.css";
  import "$styles/prism-light.css";
  import "katex/dist/katex.css";
  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { children } = $props();
</script>

{@render children?.()}
