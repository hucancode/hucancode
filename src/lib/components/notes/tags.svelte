<script>
  /** @type {{ categories: Array<{name: string, count: number}>, base?: string }} */
  let { categories = [], base = "/notes" } = $props();

  let expanded = $state(false);
  const TOP_COUNT = 3;

  const displayedCategories = $derived(
    expanded ? categories : categories.slice(0, TOP_COUNT)
  );
  const hasMore = $derived(categories.length > TOP_COUNT);
</script>

{#if categories.length > 0}
  <section>
    <h2>Popular Topics</h2>
    <div class="tags-wrapper">
      <div class="tags-container">
        {#each displayedCategories as category}
          <a
            href="{base}/category/{category.name}"
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
  section {
    padding: 2rem;
    margin-bottom: 3rem;
    background: color-mix(in srgb, var(--ink) 5%, var(--paper));
  }

  h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.25rem;
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
    background: var(--paper);
    border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
    border-radius: 0;
    text-decoration: none;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .tag:hover {
    background: color-mix(in srgb, var(--link) 10%, var(--paper));
    border-color: color-mix(in srgb, var(--link) 40%, transparent);
    opacity: 1;
  }

  .tag-name {
    color: var(--ink);
    font-weight: 500;
  }

  .tag-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.375rem;
    background: color-mix(in srgb, var(--ink) 12%, transparent);
    color: color-mix(in srgb, var(--ink) 70%, transparent);
    border-radius: 0;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .tag:hover .tag-name {
    color: var(--link);
  }

  .tag:hover .tag-count {
    background: color-mix(in srgb, var(--link) 20%, transparent);
    color: var(--link);
  }

  button {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--ink) 25%, transparent);
    border-radius: 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--ink) 60%, transparent);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  button:hover {
    background: color-mix(in srgb, var(--ink) 8%, transparent);
    border-color: color-mix(in srgb, var(--ink) 35%, transparent);
    color: var(--ink);
  }

  .expand-button { min-width: 3rem; }
  .collapse-button { align-self: flex-start; }

  /* Responsive */
  @media (max-width: 640px) {
    section {
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
