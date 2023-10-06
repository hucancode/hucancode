<script>
  import { _ } from "$lib/i18n";
  import RubikIcon from "~icons/arcticons/cubesolver";
  import DragonIcon from "~icons/game-icons/sea-dragon";
  import PlanetIcon from "~icons/ph/planet-fill";
  import YinYangIcon from "~icons/bi/yin-yang";
  import SwordIcon from "~icons/ri/sword-fill";
  import FullScreenIcon from "~icons/zondicons/screen-full";
  import FireIcon from "~icons/twemoji/fire";
  import "@shoelace-style/shoelace/dist/components/button-group/button-group.js?client";
  import "@shoelace-style/shoelace/dist/components/button/button.js?client";
  import "@shoelace-style/shoelace/dist/components/icon/icon.js?client";
  import "@shoelace-style/shoelace/dist/components/radio-button/radio-button.js?client";
  import "@shoelace-style/shoelace/dist/components/radio-group/radio-group.js?client";
  let selected = 0;
  let link = "/rubik";
  let sceneInstance;
  let Scene;
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

<div
  class="flex aspect-video w-full max-w-lg flex-col items-center justify-end gap-2"
>
  <sl-radio-group
    name="showcase"
    value="1"
    on:sl-change={(e) => select(parseInt(e.target.value))}
  >
    <sl-radio-button value="0">Rubik</sl-radio-button>
    <sl-radio-button value="1">Dragon</sl-radio-button>
    <sl-radio-button value="2">Lego</sl-radio-button>
    <sl-radio-button value="3">Taiji</sl-radio-button>
    <sl-radio-button value="4">Warrior</sl-radio-button>
  </sl-radio-group>
  <svelte:component this={Scene} bind:this={sceneInstance} />
  <sl-button-group>
    <sl-button on:click={performMagic}>
      <sl-icon slot="prefix" name="star-fill" library="system" />
      Surprise me!
    </sl-button>
    <sl-button data-sveltekit:prefetch href={link}>
      <sl-icon slot="prefix" name="eye" library="system" />
      Full screen
    </sl-button>
  </sl-button-group>
</div>
