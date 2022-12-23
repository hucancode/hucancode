<script>
  export let page;
  export let lastPage;
</script>

<!-- For some reason, the pagination wasn't re-rendering properly during navigation without the #key block -->
{#key page}
  {#if lastPage > 1}
    <nav aria-label="Pagination navigation" class="pagination">
      <ul>
        {#each Array.from({ length: lastPage }, (_, i) => i + 1) as p}
          <li>
            <a href="/blog/{page}">
              {p}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  {/if}
{/key}
