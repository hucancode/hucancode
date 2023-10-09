<script>
  import { _ } from "$lib/i18n";
  import Leetcode from "$lib/components/leetcode-chart.svelte";
  import Tech from "$lib/components/tech.svelte";

  export let data;

  import { onMount } from "svelte";
  onMount(async () => {
    await import("$shoelace/divider/divider");
  });
</script>

<section>
  <sl-divider />
  <h2>{$_("home.stats.title")}</h2>
  <div>
    <Tech />
    <Leetcode
      rating={data.userContestRanking.rating}
      topPercentage={data.userContestRanking.topPercentage}
      data={data.userContestRankingHistory}
    />
  </div>
</section>

<style>
  div {
    display: flex;
    aspect-ratio: 1 / 1;
    width: 100%;
    flex-direction: column;
    align-items: center;
  }
  @media (min-width: 768px) {
    div {
      aspect-ratio: 4/3;
    }
  }
  @media (min-width: 1024px) {
    div {
      aspect-ratio: 30/9;
      flex-direction: row;
      align-items: flex-start;
    }
  }
</style>
