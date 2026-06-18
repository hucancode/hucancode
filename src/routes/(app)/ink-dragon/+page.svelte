<script>
  import Scene from "$lib/components/ink-dragon.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
</script>

<svelte:head>
  <title>Ink Dragon</title>
</svelte:head>

<a class="back" href="/playgrounds">{@html Return} Playgrounds</a>
<main>
  <Scene />
</main>
