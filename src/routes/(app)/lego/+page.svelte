<script>
  import { _ } from "$lib/i18n";
  import Scene from "$lib/components/lego.svelte";
  import Idea from "$icons/line-md/lightbulb.svg?raw";
  import Return from "$icons/line-md/chevron-left.svg?raw";
  let sceneInstance;
  function performMagic() {
    sceneInstance.performMagic();
  }
</script>

<svelte:head>
  <title>Lego</title>
</svelte:head>

<section>
  <figure>
    <Scene bind:this={sceneInstance} />
  </figure>
  <div role="group" class="square">
    <a role="button" href="/">
      {@html Return}
      {$_("home.showcase.goback")}
    </a>
    <button on:click={performMagic}>
      {@html Idea}
      {$_("home.showcase.surprise")}
    </button>
  </div>
</section>

<style>
  section {
    flex-grow: 1;
    justify-content: space-around;
  }
  figure {
    aspect-ratio: 4/3;
    width: 100%;
    max-width: 640px;
  }
</style>
