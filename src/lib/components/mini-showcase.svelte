<script>
  import { _ } from "$lib/i18n";
  import { onMount } from "svelte";
  let selected = "";
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
      case "rubik":
        Scene = (await import("$lib/components/rubik.svelte")).default;
        break;
      case "dragon":
        Scene = (await import("$lib/components/dragon.svelte")).default;
        break;
      case "lego":
        Scene = (await import("$lib/components/lego.svelte")).default;
        break;
      case "taiji":
        Scene = (await import("$lib/components/taiji.svelte")).default;
        break;
      case "sabor":
        Scene = (await import("$lib/components/sabor.svelte")).default;
        break;
      default:
        selected = "";
        console.log("unhandled value" + selected);
    }
  }
  select("rubik");
</script>

<div>
  <sl-radio-group
    name="showcase"
    value={selected}
    on:sl-change={(e) => select(e.target.value)}
  >
    <sl-radio-button value="rubik">{$_("home.showcase.rubik")}</sl-radio-button>
    <sl-radio-button value="dragon"
      >{$_("home.showcase.dragon")}</sl-radio-button
    >
    <sl-radio-button value="lego">{$_("home.showcase.lego")}</sl-radio-button>
    <sl-radio-button value="taiji">{$_("home.showcase.taiji")}</sl-radio-button>
    <sl-radio-button value="sabor"
      >{$_("home.showcase.warrior")}</sl-radio-button
    >
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
      {$_("home.showcase.surprise")}
    </sl-button>
    <sl-button data-sveltekit:prefetch href={"/" + selected}>
      <sl-icon slot="prefix" name="eye" />
      {$_("home.showcase.fullscreen")}
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
