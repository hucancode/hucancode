<script>
  import RubikIcon from "~icons/arcticons/cubesolver";
  import DragonIcon from "~icons/game-icons/sea-dragon";
  import SwordIcon from "~icons/ri/sword-fill";
  import BoringIcon from "~icons/twemoji/face-with-rolling-eyes";

  let selected = 0;
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
        break;
      case 1:
        Scene = (await import("$lib/components/dragon.svelte")).default;
        break;
      case 2:
        Scene = (await import("$lib/components/sabor.svelte")).default;
        break;
    }
  }
  select(0);
</script>

<div
  class="flex aspect-square w-full flex-col-reverse
        items-center justify-start
        md:aspect-video
        md:grow
        md:flex-row-reverse"
>
  <div
    class="flex w-full justify-center gap-2 text-2xl text-white md:w-auto md:flex-col"
  >
    <button
      class="rounded-full bg-gray-700 p-4 dark:bg-black dark:text-white"
      on:click={performMagic}
    >
      <BoringIcon class="animate-waving-hand" />
    </button>
    <button
      class="bg-gray-500 p-4 aria-checked:bg-gray-700 aria-checked:text-white dark:bg-gray-700 dark:aria-checked:bg-black"
      aria-checked={selected == 0}
      on:click={() => select(0)}
    >
      <RubikIcon />
    </button>
    <button
      class="bg-gray-500 p-4 aria-checked:bg-gray-700 aria-checked:text-white dark:bg-gray-700 dark:aria-checked:bg-black"
      aria-checked={selected == 1}
      on:click={() => select(1)}
    >
      <DragonIcon />
    </button>
    <button
      class="bg-gray-500 p-4 aria-checked:bg-gray-700 aria-checked:text-white dark:bg-gray-700 dark:aria-checked:bg-black"
      aria-checked={selected == 2}
      on:click={() => select(2)}
    >
      <SwordIcon />
    </button>
  </div>
  <svelte:component this={Scene} bind:this={sceneInstance} />
</div>
