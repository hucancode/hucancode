<script>
  import Scene from "$lib/components/enso.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
</script>

<svelte:head>
  <title>Ensō</title>
</svelte:head>

<a class="back" href="/playgrounds">{@html Return}</a>
<main>
  <Scene />
</main>
