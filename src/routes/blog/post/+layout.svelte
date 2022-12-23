<script>
  import "$lib/styles/app.css";
  //import "prismjs/themes/prism-twilight.css";
  import "$lib/styles/prism.css";
  import "katex/dist/katex.css";
</script>

<svelte:head>
  <title>hucancode's blog</title>
</svelte:head>
<div class="dark:prose-dark dark:lg:prose-xl-dark prose lg:prose-xl">
  <slot />
</div>
