<script>
  import GoBack from "~icons/ri/arrow-left-line";
  import Coffee from "~icons/simple-icons/buymeacoffee";
</script>

<p class="mx-4 text-center text-gray-400 dark:text-gray-600">
  That's all! Thank you for reading all the way here 😊
</p>
<nav class="mb-10">
  <h1
    class="text-fill-none bg-rainbow5 dark:bg-rainbow4 flex items-center gap-2 whitespace-nowrap bg-clip-text text-base font-bold md:text-xl"
  >
    <GoBack />
    <a data-sveltekit:prefetch href="/blog">Return to blog</a>
  </h1>
  <h1
    class="text-fill-none bg-rainbow5 dark:bg-rainbow4 flex items-center gap-2 whitespace-nowrap bg-clip-text text-base font-bold md:text-xl"
  >
    <a
      target="_blank"
      rel="noreferrer"
      href="https://www.buymeacoffee.com/hucancode">Buy me a coffee</a
    >
    <Coffee />
  </h1>
</nav>
