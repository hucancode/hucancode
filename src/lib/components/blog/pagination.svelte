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
  const EDGE_NUM = Math.floor((DISPLAY_NUM - 3) / 2); // Number of pages to show at edges
  const SIBLING_NUM = Math.floor((DISPLAY_NUM - 5) / 2); // Number of pages to show around current
  
  let pages = $derived.by(() => {
    if (lastPage <= DISPLAY_NUM) {
      return Array(lastPage)
        .fill(1)
        .map((_, i) => i + 1);
    }
    
    let ret = [];
    
    // Calculate thresholds
    const nearStart = 1 + EDGE_NUM + 1;
    const nearEnd = lastPage - EDGE_NUM;
    
    if (page <= nearStart) {
      // Near start: show first DISPLAY_NUM-2 pages, ellipsis, last page
      const endPage = DISPLAY_NUM - 2;
      for (let i = 1; i <= endPage; i++) {
        ret.push(i);
      }
      ret.push('...');
      ret.push(lastPage);
    } else if (page >= nearEnd) {
      // Near end: first page, ellipsis, last DISPLAY_NUM-2 pages
      ret.push(1);
      ret.push('...');
      const startPage = lastPage - (DISPLAY_NUM - 3);
      for (let i = startPage; i <= lastPage; i++) {
        ret.push(i);
      }
    } else {
      // Middle: first, ellipsis, siblings around current, ellipsis, last
      ret.push(1);
      ret.push('...');
      
      // Add pages around current
      for (let i = page - SIBLING_NUM; i <= page + SIBLING_NUM; i++) {
        ret.push(i);
      }
      
      ret.push('...');
      ret.push(lastPage);
    }
    
    return ret;
  });
</script>

<!-- For some reason, the pagination wasn't re-rendering properly during navigation without the #key block -->
{#key page}
  {#if lastPage > 1}
    <div role="group" class="square">
      {#each pages as p}
        {#if p === '...'}
          <span class="ellipsis">...</span>
        {:else}
          <a
            role="button"
            disabled={page && p == page}
            data-sveltekit-noscroll
            href="{path}/{p}"
            aria-label="Page {p}"
            aria-current={page && p == page ? 'page' : undefined}
          >
            {p}
          </a>
        {/if}
      {/each}
    </div>
  {/if}
{/key}

<style>
  div[role="group"] {
    margin-bottom: 10vh;
    display: flex;
    gap: 0.25rem;
    justify-content: center;
    align-items: center;
  }
  
  a[role="button"] {
    text-decoration: none;
    transition: all 0.2s ease;
  }
  
  a[role="button"]:not([disabled]):hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  a[role="button"][disabled] {
    background-color: var(--color-primary-500);
    color: white;
    cursor: default;
    pointer-events: none;
  }
  
  .ellipsis {
    padding: 0.5rem 0.75rem;
    color: var(--color-neutral-400);
    user-select: none;
  }
  
  /* Dark mode support */
  :global(.dark) a[role="button"][disabled] {
    background-color: var(--color-primary-600);
  }
  
  /* Mobile adjustments */
  @media (max-width: 640px) {
    div[role="group"] {
      gap: 0.125rem;
    }
    
    a[role="button"] {
      padding: 0.375rem 0.625rem;
      font-size: 0.875rem;
    }
    
    .ellipsis {
      padding: 0.375rem 0.5rem;
    }
  }
</style>
