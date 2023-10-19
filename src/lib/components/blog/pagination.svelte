<script>
  import { onMount, afterUpdate } from "svelte";
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
    <div role="group">
      {#each pages as p}
        <a
          role="button"
          disabled={page && p == page}
          data-sveltekit:prefetch
          href="{path}/{p}"
        >
          {p}
        </a>
      {/each}
    </div>
  {/if}
{/key}
