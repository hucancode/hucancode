<script>
  import { onMount } from "svelte";
  import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
</script>

<nav>
  <h1
    class="text-fill-none whitespace-nowrap bg-rainbow5 bg-clip-text pb-1 text-2xl font-bold dark:bg-rainbow4"
  >
    <a data-sveltekit:prefetch href="/blog">Little Corner</a>
  </h1>
  <ThemeSwitcher />
</nav>
