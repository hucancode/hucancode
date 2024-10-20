<script>
  /**
   * @typedef {Object} Props
   * @property {number} [page]
   * @property {number} [lastPage]
   * @property {string} [path]
   */

  /** @type {Props} */
  let { page, lastPage, path } = $props();
  const DISPLAY_NUM = 7;
  let pages = $derived.by(() => {
    if (lastPage <= DISPLAY_NUM) {
      return Array(lastPage)
        .fill(1)
        .map((_, i) => i + 1);
    }
    let halfLength = (DISPLAY_NUM - 3) / 2;
    let a = halfLength + 2;
    let b = lastPage - halfLength - 1;
    let pivot = Math.max(a, Math.min(b, page));
    let ret = [];
    ret.push(1);
    for (var i = pivot - halfLength; i <= pivot + halfLength; i++) {
      ret.push(i);
    }
    ret.push(lastPage);
    return ret;
  });
</script>

<!-- For some reason, the pagination wasn't re-rendering properly during navigation without the #key block -->
{#key page}
  {#if lastPage > 1}
    <div role="group" class="square">
      {#each pages as p}
        <a
          role="button"
          disabled={page && p == page}
          data-sveltekit-noscroll
          href="{path}/{p}"
        >
          {p}
        </a>
      {/each}
    </div>
  {/if}
{/key}

<style>
  div {
    margin-bottom: 10vh;
  }
</style>
