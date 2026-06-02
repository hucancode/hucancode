<script>
  import { _ } from "$lib/i18n";
  import Scene from "$lib/components/brush.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
</script>

<svelte:head>
  <title>Brush</title>
</svelte:head>

<section>
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
  section {
    flex-grow: 1;
    justify-content: space-around;
  }
  figure {
    width: 100%;
    max-width: 720px;
  }
</style>
