<script>
  import RubikIcon from "~icons/arcticons/cubesolver";
  import DragonIcon from "~icons/game-icons/sea-dragon";
  import SwordIcon from "~icons/ri/sword-fill";
  import MagicIcon  from '~icons/fa-solid/hand-sparkles'

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
    class="flex gap-2 w-full justify-center
        text-2xl md:w-auto md:flex-col"
  >
    <button
      class="p-4 rounded-full bg-sky-600/20 dark:text-white text-gray-800"
      on:click={performMagic}
    >
      <MagicIcon class="animate-waving-hand" />
    </button>
    <button
      class="p-4 aria-checked:bg-gray-700 aria-checked:text-white dark:aria-checked:bg-gray-300 dark:aria-checked:text-gray-800"
      aria-checked={selected == 0}
      on:click={() => select(0)}
    >
      <RubikIcon />
    </button>
    <button
      class="p-4 aria-checked:bg-gray-700 aria-checked:text-white dark:aria-checked:bg-gray-300 dark:aria-checked:text-gray-800"
      aria-checked={selected == 1}
      on:click={() => select(1)}
    >
      <DragonIcon />
    </button>
    <button
      class="p-4 aria-checked:bg-gray-700 aria-checked:text-white dark:aria-checked:bg-gray-300 dark:aria-checked:text-gray-800"
      aria-checked={selected == 2}
      on:click={() => select(2)}
    >
      <SwordIcon />
    </button>
  </div>
  <svelte:component bind:this={sceneInstance} this={Scene} />
</div>
