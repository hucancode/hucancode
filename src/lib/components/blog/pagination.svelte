<script>
  import { afterUpdate } from "svelte";
  export let page;
  export let lastPage;
  export let path;
  let DISPLAY_NUM = 6;
  let pages = [];
  function update() {
    pages = Array.from({ length: lastPage }, (_, i) => i + 1);
    if (lastPage > DISPLAY_NUM) {
      const k = DISPLAY_NUM / 2;
      const nearEnd = lastPage - page <= k;
      const nearStart = page < k;
      // console.log("page", page, "k",k,"near end", nearEnd, "near start", nearStart);
      if (!nearEnd && !nearStart) {
        pages.splice(1, page - k);
        pages.splice(DISPLAY_NUM - 1, page - k + 1);
      } else if (nearEnd) {
        pages.splice(1, lastPage - DISPLAY_NUM);
      } else if (nearStart) {
        pages.splice(DISPLAY_NUM - 1, lastPage - DISPLAY_NUM);
      }
    }
  }
  update();
  afterUpdate(update);
</script>

<!-- For some reason, the pagination wasn't re-rendering properly during navigation without the #key block -->
{#key page}
  {#if lastPage > 1}
    <ul class="flex gap-4 text-sm font-bold">
      {#each pages as p}
        <li
          class="aspect-square w-12 border-gray-500 bg-sky-200 p-2 text-gray-600 dark:border-gray-400 dark:bg-gray-700 dark:text-gray-200"
          class:border={p == page}
        >
          <a
            data-sveltekit-noscroll
            class:pointer-events-none={p == page}
            class="flex h-full w-full items-center justify-center"
            data-sveltekit:prefetch
            href="{path}/{p}"
          >
            {p}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
{/key}
