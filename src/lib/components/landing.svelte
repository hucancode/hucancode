<script>
  import { _ } from "svelte-i18n";
  import MiniShowcase from "$lib/components/mini-showcase.svelte";
  import WavingHand from "~icons/twemoji/waving-hand";
</script>

<section
  class="relative
        my-10 flex
        w-full max-w-screen-lg flex-col items-center justify-around
        overflow-hidden
        px-10
        md:flex-row"
>
  <div
    class="flex
    w-full flex-col items-center
    pb-10 md:relative
    md:left-0 md:w-2/5
    md:items-start"
  >
    <div class="mb-4 flex select-none items-center gap-4 text-4xl font-bold">
      <h1
        class="text-fill-none animate-bg-pingpong bg-rainbow2 bg-double-width bg-clip-text"
      >
        {$_("home.landing.hello")}
      </h1>
      <WavingHand class="origin-[70%_70%] hover:animate-waving-hand" />
    </div>
    <p class="mb-4 text-center md:text-left">{$_("home.landing.about1")}</p>
  </div>
  <MiniShowcase />
</section>
