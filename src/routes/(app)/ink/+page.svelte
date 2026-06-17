<script>
  import Scene from "$lib/components/ink.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
</script>

<svelte:head>
  <title>Ink</title>
</svelte:head>

<a class="back" href="/playgrounds">{@html Return}</a>
<main>
  <Scene />
</main>
