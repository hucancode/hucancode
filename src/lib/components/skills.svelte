<script>
  import { _ } from "svelte-i18n";
  import { onMount } from "svelte";
  import Leetcode from "$lib/components/leetcode-chart.svelte";
  import Tech from "$lib/components/section-tech.svelte";

  export let data;
</script>

<section
  class="flex w-full
    max-w-screen-lg flex-col items-center
    overflow-hidden py-10 px-4
    text-center
    md:px-10"
>
  <div class="mb-6 h-1 w-full max-w-sm bg-gray-900/10 dark:bg-white/10" />
  <h1 class="mb-5 text-2xl font-bold">{$_("home.stats.title")}</h1>
  <div
    class="flex aspect-square w-full flex-col items-center md:aspect-[4/3] lg:aspect-[30/9] lg:flex-row lg:items-start"
  >
    <div class="flex h-full w-full flex-col rounded-md md:w-2/3 lg:w-1/2">
      <Tech />
    </div>
    <div class="flex h-full w-full flex-col items-center p-5 md:w-2/3 lg:w-1/2">
      <Leetcode
        rating={data.userContestRanking.rating}
        topPercentage={data.userContestRanking.topPercentage}
        data={data.userContestRankingHistory}
      />
    </div>
  </div>
</section>
