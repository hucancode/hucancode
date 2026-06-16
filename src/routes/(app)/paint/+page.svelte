<script>
  import { _ } from "$lib/i18n";
  import Scene from "$lib/components/paint.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
</script>

<svelte:head>
  <title>Paint</title>
</svelte:head>

<section class="paint-page">
  <figure>
    <Scene />
  </figure>
  <div role="group" class="square">
    <a role="button" href="/">
      {@html Return}
      {$_("home.showcase.goback")}
    </a>
  </div>
</section>

<style>
  /* match canvas paper color (PAPER in webgl-renderer.js) */
  :global(body:has(.paint-page)) {
    background: rgb(255, 252, 224);
  }
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
