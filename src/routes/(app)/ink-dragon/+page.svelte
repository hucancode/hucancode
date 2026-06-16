<script>  import Scene from "$lib/components/ink-dragon.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
</script>

<svelte:head>
  <title>Ink Dragon</title>
</svelte:head>

<section>
  <figure>
    <Scene />
  </figure>
  <div role="group" class="square">
    <a role="button" href="/">
      {@html Return}
      Go back
    </a>
  </div>
</section>

<style>
  section {
    flex-grow: 1;
    justify-content: space-around;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
  }
  figure {
    width: 100%;
  }
</style>
