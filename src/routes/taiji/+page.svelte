<script>
  import { onMount } from "svelte";
  import { _ } from "$lib/i18n";
  import Nav from "$lib/components/nav.svelte";
  import Scene from "$lib/components/taiji.svelte";
  let sceneInstance;
  function performMagic() {
    sceneInstance.performMagic();
  }
  onMount(async () => {
    await import("$shoelace/button/button");
    await import(
      "$shoelace/button-group/button-group"
    );
  });
</script>

<svelte:head>
  <title>Taiji</title>
</svelte:head>
<Nav />
<section>
  <div>
    <Scene bind:this={sceneInstance} />
  </div>
  <sl-button-group>
    <sl-button data-sveltekit-reload href="/">
      <sl-icon slot="prefix" name="arrow-return-left" />
      Go back
    </sl-button>
    <sl-button on:click={performMagic}>
      <sl-icon slot="prefix" name="brilliance" />
      Surprise me!
    </sl-button>
  </sl-button-group>
</section>

<style>
  section {
    flex-grow: 1;
    justify-content: space-around;
  }
  div {
    aspect-ratio: 1/1;
    width: 100%;
    max-width: 640px;
  }
</style>
