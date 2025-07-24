<script>
  /** @type {{ categories: Array<{name: string, count: number}> }} */
  let { categories = [] } = $props();

  let expanded = $state(false);
  const TOP_COUNT = 3;

  const displayedCategories = $derived(
    expanded ? categories : categories.slice(0, TOP_COUNT)
  );
  const hasMore = $derived(categories.length > TOP_COUNT);
</script>

{#if categories.length > 0}
  <section class="tags-section">
    <h2>Popular Topics</h2>
    <div class="tags-wrapper">
      <div class="tags-container">
        {#each displayedCategories as category}
          <a
            href="/blog/category/{category.name}"
            class="tag"
            data-count={category.count}
          >
            <span class="tag-name">{category.name}</span>
            <span class="tag-count">{category.count}</span>
          </a>
        {/each}
        {#if hasMore && !expanded}
          <button
            class="expand-button"
            onclick={() => expanded = true}
            aria-label="Show more topics"
          >
            ...
          </button>
        {/if}
      </div>
      {#if hasMore && expanded}
        <button
          class="collapse-button"
          onclick={() => expanded = false}
          aria-label="Show less topics"
        >
          Show less
        </button>
      {/if}
    </div>
  </section>
{/if}

<style>
  .tags-section {
    padding: 2rem;
    margin-bottom: 3rem;
    background: var(--color-neutral-100);
  }

  .tags-section h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.25rem;
    color: var(--color-neutral-900);
  }

  .tags-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-neutral-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: 0;
    text-decoration: none;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .tag:hover {
    background: var(--color-primary-100);
    border-color: var(--color-primary-300);
  }

  .tag-name {
    color: var(--color-neutral-700);
    font-weight: 500;
  }

  .tag-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.375rem;
    background: var(--color-neutral-200);
    color: var(--color-neutral-600);
    border-radius: 0;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .tag:hover .tag-name {
    color: var(--color-primary-700);
  }

  .tag:hover .tag-count {
    background: var(--color-primary-200);
    color: var(--color-primary-700);
  }

  .expand-button,
  .collapse-button {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--color-neutral-300);
    border-radius: 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-neutral-600);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .expand-button {
    min-width: 3rem;
  }

  .expand-button:hover,
  .collapse-button:hover {
    background: var(--color-neutral-200);
    border-color: var(--color-neutral-400);
    color: var(--color-neutral-700);
  }

  .collapse-button {
    align-self: flex-start;
  }

  /* Dark mode */
  :global(.dark) .tags-section {
    background: var(--color-neutral-800);
  }

  :global(.dark) .tags-section h2 {
    color: var(--color-neutral-100);
  }

  :global(.dark) .tag {
    background: var(--color-neutral-900);
    border-color: var(--color-neutral-700);
  }

  :global(.dark) .tag:hover {
    background: var(--color-primary-900);
    border-color: var(--color-primary-700);
  }

  :global(.dark) .tag-name {
    color: var(--color-neutral-300);
  }

  :global(.dark) .tag-count {
    background: var(--color-neutral-700);
    color: var(--color-neutral-300);
  }

  :global(.dark) .tag:hover .tag-name {
    color: var(--color-primary-300);
  }

  :global(.dark) .tag:hover .tag-count {
    background: var(--color-primary-800);
    color: var(--color-primary-300);
  }

  :global(.dark) .expand-button,
  :global(.dark) .collapse-button {
    border-color: var(--color-neutral-600);
    color: var(--color-neutral-400);
  }

  :global(.dark) .expand-button:hover,
  :global(.dark) .collapse-button:hover {
    background: var(--color-neutral-700);
    border-color: var(--color-neutral-500);
    color: var(--color-neutral-300);
  }

  /* Responsive */
  @media (max-width: 640px) {
    .tags-section {
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .tags-container {
      gap: 0.5rem;
    }

    .tag {
      padding: 0.375rem 0.75rem;
      font-size: 0.8125rem;
    }
  }
</style>
