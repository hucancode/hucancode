<script>
  import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
</script>

<nav>
  <div>
    <a data-sveltekit:prefetch href="/blog">
      <h2 rainbow="1">Blog</h2>
    </a>
    <a data-sveltekit:prefetch href="/">
      <h2>Home</h2>
    </a>
    <a data-sveltekit:prefetch href="/blog/about">
      <h2>About</h2>
    </a>
  </div>
  <ThemeSwitcher />
</nav>

<style>
  div {
    display: flex;
    gap: 1rem;
  }
  h2 {
    font-weight: var(--sl-font-weight-semibold);
  }
</style>
