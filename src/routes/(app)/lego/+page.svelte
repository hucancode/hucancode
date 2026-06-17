<script>
  import Scene from "$lib/components/lego.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
</script>

<svelte:head>
  <title>Lego</title>
</svelte:head>

<a class="back" href="/playgrounds">{@html Return}</a>

<main>
  <figure>
    <Scene />
  </figure>
</main>
