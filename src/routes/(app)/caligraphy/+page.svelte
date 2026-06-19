<script>
  import Scene from "$lib/components/caligraphy.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
</script>

<svelte:head>
  <title>Caligraphy</title>
</svelte:head>

<nav><a class="back" href="/playgrounds">{@html Return} Playgrounds</a></nav>
<main>
  <Scene />
</main>
