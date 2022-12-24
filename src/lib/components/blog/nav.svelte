<script>
  import { onMount } from "svelte";
  import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
</script>

<nav>
  <div class="flex gap-4">
    <h1
      class="text-fill-none whitespace-nowrap bg-rainbow5 bg-clip-text text-2xl font-bold dark:bg-rainbow4"
    >
      <a data-sveltekit:prefetch href="/blog">Blog</a>
    </h1>
    <h1 class="text-2xl">
      <a data-sveltekit:prefetch href="/">Home</a>
    </h1>
    <h1 class="text-2xl">
      <a data-sveltekit:prefetch href="/blog/about">About</a>
    </h1>
  </div>
  <ThemeSwitcher />
</nav>
