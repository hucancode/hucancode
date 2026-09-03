<script>
  let { open = $bindable(true), label = "controls" } = $props();
</script>

<button
  type="button"
  class="controls-toggle"
  aria-expanded={open}
  aria-label={open ? `Hide ${label}` : `Show ${label}`}
  title={open ? `Hide ${label}` : `Show ${label}`}
  onpointerdown={(e) => e.stopPropagation()}
  onclick={() => (open = !open)}
>
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {#if open}
      <path d="m13 17 5-5-5-5" />
      <path d="m6 17 5-5-5-5" />
    {:else}
      <path d="m11 17-5-5 5-5" />
      <path d="m18 17-5-5 5-5" />
    {/if}
  </svg>
</button>
