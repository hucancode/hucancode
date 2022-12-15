<script>
  import Rubik from "$lib/components/rubik.svelte";
  import Dragon from "$lib/components/dragon.svelte";
  import Sabor from "$lib/components/sabor.svelte";
  import RubikIcon from "~icons/arcticons/cubesolver";
  import DragonIcon from "~icons/game-icons/sea-dragon";
  import SwordIcon from "~icons/ri/sword-fill";
  let selected = 0;
</script>

<div
  class="flex aspect-square w-full flex-col-reverse
        items-center justify-start
        md:aspect-video
        md:grow
        md:flex-row-reverse"
>
  <div
    class="flex w-full justify-center
        md:w-auto md:flex-col"
  >
    <button class="p-4 aria-checked:bg-gray-700 aria-checked:text-white dark:aria-checked:bg-gray-300 dark:aria-checked:text-gray-800"
      aria-checked={selected == 0}
      on:click={() => {
        selected = 0;
      }}
    >
      <RubikIcon />
    </button>
    <button class="p-4 aria-checked:bg-gray-700 aria-checked:text-white dark:aria-checked:bg-gray-300 dark:aria-checked:text-gray-800"
      aria-checked={selected == 1}
      on:click={() => {
        selected = 1;
      }}
    >
      <DragonIcon />
    </button>
    <button class="p-4 aria-checked:bg-gray-700 aria-checked:text-white dark:aria-checked:bg-gray-300 dark:aria-checked:text-gray-800"
      aria-checked={selected == 2}
      on:click={() => {
        selected = 2;
      }}
    >
      <SwordIcon />
    </button>
  </div>
  {#if selected == 0}
    <Rubik />
  {:else if selected == 1}
    <Dragon />
  {:else if selected == 2}
    <Sabor />
  {/if}
</div>

