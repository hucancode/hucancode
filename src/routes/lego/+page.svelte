<script>
  import "$styles/tailwind.css";
  import { _ } from "$lib/i18n";
  import Nav from "$lib/components/nav.svelte";
  import GoBack from "~icons/ri/arrow-left-line";
  import Coffee from "~icons/simple-icons/buymeacoffee";
  import Scene from "$lib/components/lego.svelte";

  import FireIcon from "~icons/twemoji/fire";

  let sceneInstance;
  function performMagic() {
    sceneInstance.performMagic();
  }
</script>

<svelte:head>
  <title>Lego Planet</title>
</svelte:head>
<Nav />
<section class="flex max-w-screen-lg grow flex-col items-center justify-center">
  <div class="aspect-square w-full md:aspect-video">
    <Scene bind:this={sceneInstance} />
  </div>
  <button
    class="group bg-gray-700 p-4 px-12 text-2xl dark:bg-black dark:text-white"
    on:click={performMagic}
  >
    <FireIcon class="group-active:scale-150" />
  </button>
</section>

<nav class="mb-10">
  <h1
    class="text-fill-none bg-rainbow5 dark:bg-rainbow4 flex items-center gap-2 whitespace-nowrap bg-clip-text text-base font-bold md:text-xl"
  >
    <GoBack />
    <a data-sveltekit:prefetch href="/">
      {$_("creative.return")}
    </a>
  </h1>
  <h1
    class="text-fill-none bg-rainbow5 dark:bg-rainbow4 flex items-center gap-2 whitespace-nowrap bg-clip-text text-base font-bold md:text-xl"
  >
    <a
      target="_blank"
      rel="noreferrer"
      href="https://www.buymeacoffee.com/hucancode"
    >
      {$_("creative.buymeacoffee")}
    </a>
    <Coffee />
  </h1>
</nav>
