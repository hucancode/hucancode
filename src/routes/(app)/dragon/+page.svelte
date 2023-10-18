<script>
  import { onMount } from "svelte";
  import { _ } from "$lib/i18n";
  import Scene from "$lib/components/dragon.svelte";
  let sceneInstance;
  function performMagic() {
    sceneInstance.performMagic();
  }
  onMount(async () => {
    await import("$shoelace/button/button");
    await import("$shoelace/button-group/button-group");
  });
</script>

<svelte:head>
  <title>Dragon</title>
</svelte:head>

<section>
  <div>
    <Scene bind:this={sceneInstance} />
  </div>
  <sl-button-group>
    <sl-button data-sveltekit:prefetch href="/">
      <sl-icon slot="prefix" name="arrow-return-left" />
      {$_("home.showcase.goback")}
    </sl-button>
    <sl-button on:click={performMagic}>
      <sl-icon slot="prefix" name="brilliance" />
      {$_("home.showcase.surprise")}
    </sl-button>
  </sl-button-group>
</section>

<style>
  section {
    flex-grow: 1;
    justify-content: space-around;
  }
  div {
    aspect-ratio: 4/3;
    width: 100%;
    max-width: 640px;
  }
</style>
