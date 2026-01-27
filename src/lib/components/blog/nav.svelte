<script>
  // import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
</script>

<nav>
  <div>
    <a href="/blog">
      <h2 rainbow>Blog</h2>
    </a>
    <a href="/blog/category/graphics">
      <h2 rainbow="2">Graphics</h2>
    </a>
    <a href="/blog/category/algorithm">
      <h2 rainbow>Algorithm</h2>
    </a>
    <a href="/">
      <h2 rainbow>About</h2>
    </a>
  </div>
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
