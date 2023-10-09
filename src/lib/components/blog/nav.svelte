<script>
  import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
</script>

<nav>
  <div>
    <h2 rainbow>
      <a data-sveltekit:prefetch href="/blog">Blog</a>
    </h2>
    <h2>
      <a data-sveltekit:prefetch href="/">Home</a>
    </h2>
    <h2>
      <a data-sveltekit:prefetch href="/blog/about">About</a>
    </h2>
  </div>
  <ThemeSwitcher />
</nav>
<style>
  div {
    display: flex;
    gap: 1rem;
  }
</style>