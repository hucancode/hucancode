<script>
  import { _ } from "$lib/i18n";
  import Leetcode from "$lib/components/leetcode-chart.svelte";
  import Tech from "$lib/components/tech.svelte";

  export let data;
</script>

<section>
  <div class="mb-6 h-1 w-full max-w-sm bg-gray-900/10 dark:bg-white/10" />
  <h1 class="mb-5 text-2xl font-bold">{$_("home.stats.title")}</h1>
  <div
    class="flex aspect-square w-full flex-col items-center md:aspect-[4/3] lg:aspect-[30/9] lg:flex-row lg:items-start"
  >
    <Tech />
    <Leetcode
      rating={data.userContestRanking.rating}
      topPercentage={data.userContestRanking.topPercentage}
      data={data.userContestRankingHistory}
    />
  </div>
</section>
