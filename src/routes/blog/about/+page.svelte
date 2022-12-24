<script>
  import Coffee from "~icons/simple-icons/buymeacoffee";

  export const prerender = true;
</script>

<svelte:head>
  <title>About</title>
</svelte:head>
<header class="flex flex max-w-screen-sm flex-col items-center gap-6 p-16">
  <div
    class="flex aspect-square w-24 items-center justify-center rounded-full bg-black"
  >
    <img alt="logo" src="/assets/logo-source.svg" />
  </div>
  <p class="text-center text-sm text-gray-600 dark:text-gray-400">
    Welcome to my blog, I am a Vietnamese software engineer based in Japan and a <s>weaboo</s> anime fan. I go by the handle <strong>hucancode</strong> in most places you can find me. I write about programming, game and other random things,
    mostly random things
  </p>
  <h1
    class="flex items-center gap-2 font-bold text-xl"
  >
    <a
      target="_blank"
      rel="noreferrer"
      href="https://www.buymeacoffee.com/hucancode">Buy me a coffee</a
    >
    <Coffee />
  </h1>
</header>
