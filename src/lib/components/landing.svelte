<script>
  import { _ } from "svelte-i18n";
  import MiniShowcase from "$lib/components/mini-showcase.svelte";
  import WavingHand from "~icons/twemoji/waving-hand";
</script>

<section class="flex-col md:flex-row">
  <div
    class="flex w-full flex-col
    items-center gap-4 py-10
    md:w-2/5 md:items-start md:py-0"
  >
    <div class="flex items-center gap-4 text-4xl font-bold">
      <h1
        class="text-fill-none animate-bg-pingpong bg-rainbow2 bg-double-width bg-clip-text p-1"
      >
        {$_("home.landing.hello")}
      </h1>
      <WavingHand class="origin-[70%_70%] hover:animate-waving-hand" />
    </div>
    <p class="text-center md:text-left">{$_("home.landing.about1")}</p>
  </div>
  <MiniShowcase />
</section>
