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
    <ul>
      {#each displayedCategories as category}
        <li>
          <a href="{base}/category/{category.name}">
            {category.name}
            <span>{category.count}</span>
          </a>
        </li>
      {/each}
      {#if hasMore && !expanded}
        <li>
          <button onclick={() => (expanded = true)} aria-label="Show more topics">
            ...
          </button>
        </li>
      {/if}
    </ul>
    {#if hasMore && expanded}
      <button onclick={() => (expanded = false)} aria-label="Show less topics">
        Show less
      </button>
    {/if}
  </section>
{/if}

<style>
  section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
    max-width: 1024px;
    padding: 2rem;
    margin-bottom: 3rem;
    background: color-mix(in srgb, var(--ink) 5%, var(--paper));
  }

  h2 {
    margin-bottom: 0.5rem;
    font-size: 1.25rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--paper);
    border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--ink);
    transition: all 0.2s ease;
  }

  a span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.375rem;
    background: color-mix(in srgb, var(--ink) 12%, transparent);
    color: color-mix(in srgb, var(--ink) 70%, transparent);
    font-size: 0.75rem;
    font-weight: 600;
  }

  a:hover {
    background: color-mix(in srgb, var(--link) 10%, var(--paper));
    border-color: color-mix(in srgb, var(--link) 40%, transparent);
    color: var(--link);
    opacity: 1;
  }

  a:hover span {
    background: color-mix(in srgb, var(--link) 20%, transparent);
    color: var(--link);
  }

  button {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--ink) 25%, transparent);
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

  li button { min-width: 3rem; }
  section > button { align-self: flex-start; }

  @media (max-width: 640px) {
    section {
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    ul {
      gap: 0.5rem;
    }
    a {
      padding: 0.375rem 0.75rem;
      font-size: 0.8125rem;
    }
  }
</style>
