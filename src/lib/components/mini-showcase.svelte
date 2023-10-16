<script>
  import { _ } from "$lib/i18n";
  import { onMount } from "svelte";
  let selected = 0;
  let link = "/rubik";
  let sceneInstance;
  let Scene;

  onMount(async () => {
    await import("$shoelace/button-group/button-group");
    await import("$shoelace/button/button");
    await import("$shoelace/animation/animation");
    await import("$shoelace/icon/icon");
    await import("$shoelace/radio-button/radio-button");
    await import("$shoelace/radio-group/radio-group");
  });

  function performMagic() {
    sceneInstance.performMagic();
  }
  async function select(value) {
    selected = value;
    switch (selected) {
      case 0:
        Scene = (await import("$lib/components/rubik.svelte")).default;
        link = "/rubik";
        break;
      case 1:
        Scene = (await import("$lib/components/dragon.svelte")).default;
        link = "/dragon";
        break;
      case 2:
        Scene = (await import("$lib/components/lego.svelte")).default;
        link = "/lego";
        break;
      case 3:
        Scene = (await import("$lib/components/taiji.svelte")).default;
        link = "/taiji";
        break;
      case 4:
        Scene = (await import("$lib/components/sabor.svelte")).default;
        link = "/sabor";
        break;
      default:
        console.log("unhandled value" + selected);
    }
  }
  select(Math.floor(Math.random() * 4));
</script>

<div>
  <sl-radio-group
    name="showcase"
    value={selected}
    on:sl-change={(e) => select(parseInt(e.target.value))}
  >
    <sl-radio-button value={0}>Rubik</sl-radio-button>
    <sl-radio-button value={1}>Dragon</sl-radio-button>
    <sl-radio-button value={2}>Lego</sl-radio-button>
    <sl-radio-button value={3}>Taiji</sl-radio-button>
    <sl-radio-button value={4}>Warrior</sl-radio-button>
  </sl-radio-group>
  <svelte:component this={Scene} bind:this={sceneInstance} />
  <sl-button-group>
    <sl-button on:click={performMagic}>
      <sl-animation
        duration={1000}
        keyframes={[
          {
            offset: 0,
            transform: "rotate(0)",
          },
          {
            offset: 1,
            transform: "rotate(360deg)",
          },
        ]}
        play
        slot="prefix"
      >
        <sl-icon name="brilliance" />
      </sl-animation>
      Surprise me!
    </sl-button>
    <sl-button data-sveltekit:prefetch href={link}>
      <sl-icon slot="prefix" name="eye" />
      Full screen
    </sl-button>
  </sl-button-group>
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    justify-content: flex-end;
    aspect-ratio: 16/9;
    width: 100%;
    max-width: 32rem;
  }
</style>
