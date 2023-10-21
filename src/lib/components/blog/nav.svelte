<script>
  import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
</script>

<nav>
  <div>
    <a href="/blog">
      <h2 rainbow="1">Blog</h2>
    </a>
    <a href="/">
      <h2>Home</h2>
    </a>
    <a href="/blog/about">
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
    font-weight: bold;
  }
</style>
