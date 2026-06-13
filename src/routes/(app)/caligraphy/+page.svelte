<script>
  import { _ } from "$lib/i18n";
  import Playground from "$lib/components/caligraphy.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
</script>

<svelte:head>
  <title>Caligraphy</title>
</svelte:head>

<section>
  <figure>
    <Playground />
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
</style>
