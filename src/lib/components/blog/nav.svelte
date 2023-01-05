<script>
  import { onMount } from "svelte";
  import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
</script>

<nav>
  <div class="flex gap-4">
    <h1
      class="text-fill-none whitespace-nowrap bg-rainbow5 bg-clip-text text-2xl font-bold hover:bg-rainbow3 dark:bg-rainbow4 dark:hover:bg-rainbow3"
    >
      <a data-sveltekit:prefetch href="/blog">Blog</a>
    </h1>
    <h1 class="text-2xl hover:text-purple-800 hover:dark:text-blue-300">
      <a data-sveltekit:prefetch href="/">Home</a>
    </h1>
    <h1 class="text-2xl hover:text-purple-800 hover:dark:text-blue-300">
      <a data-sveltekit:prefetch href="/blog/about">About</a>
    </h1>
  </div>
  <ThemeSwitcher />
</nav>
