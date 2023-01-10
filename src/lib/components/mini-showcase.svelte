<script>
  import { _ } from "svelte-i18n";
  import RubikIcon from "~icons/arcticons/cubesolver";
  import DragonIcon from "~icons/game-icons/sea-dragon";
  import PlanetIcon from "~icons/ph/planet-fill";
  import SwordIcon from "~icons/ri/sword-fill";
  import FullScreenIcon from "~icons/zondicons/screen-full";
  import FireIcon from "~icons/twemoji/fire";

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
        Scene = (await import("$lib/components/sabor.svelte")).default;
        link = "/sabor";
        break;
    }
  }
  select(Math.floor(Math.random() * 3));
</script>

<div
  class="flex aspect-square w-full flex-col-reverse
        items-center justify-start
        gap-2
        md:aspect-video
        md:grow
        md:flex-row-reverse md:gap-0"
>
  <div
    class="flex w-full justify-center gap-2 text-2xl text-white md:w-auto md:flex-col"
  >
    <button
      class="bg-gray-500 p-4 disabled:bg-gray-700 disabled:text-white dark:bg-gray-700 dark:disabled:bg-black"
      disabled={selected == 0}
      on:click={() => select(0)}
    >
      <RubikIcon />
    </button>
    <button
      class="bg-gray-500 p-4 disabled:bg-gray-700 disabled:text-white dark:bg-gray-700 dark:disabled:bg-black"
      disabled={selected == 1}
      on:click={() => select(1)}
    >
      <DragonIcon />
    </button>
    <button
      class="bg-gray-500 p-4 disabled:bg-gray-700 disabled:text-white dark:bg-gray-700 dark:disabled:bg-black"
      disabled={selected == 2}
      on:click={() => select(2)}
    >
      <PlanetIcon />
    </button>
    <button
      class="bg-gray-500 p-4 disabled:bg-gray-700 disabled:text-white dark:bg-gray-700 dark:disabled:bg-black"
      disabled={selected == 3}
      on:click={() => select(3)}
    >
      <SwordIcon />
    </button>
  </div>
  <div class="flex h-full w-full flex-col items-center">
    <svelte:component this={Scene} bind:this={sceneInstance} />
    <div class="flex w-full items-center justify-center gap-2">
      <button
        class="group rounded-full bg-gray-700 p-4 dark:bg-black dark:text-white"
        on:click={performMagic}
      >
        <FireIcon class="group-active:scale-150" />
      </button>
      <a data-sveltekit:prefetch href={link}>
        <button class="rounded-full bg-gray-700 p-4 text-white dark:bg-black">
          <FullScreenIcon class="group-active:scale-150" />
        </button>
      </a>
    </div>
  </div>
</div>
