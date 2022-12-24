<script>
  import { _, locale } from "svelte-i18n";
  import { onMount } from "svelte";
  import {
    Chart,
    Colors,
    LineController,
    PointElement,
    LineElement,
    TimeScale,
    LinearScale,
    Tooltip,
  } from "chart.js";
  import { enGB, ja } from "date-fns/locale";
  import "chartjs-adapter-date-fns";
  import Leetcode from "~icons/simple-icons/leetcode";
  import DualTag from "$lib/components/dual-tag.svelte";
  let canvas;
  export let data;
  export let rating;
  export let topPercentage;
  let chart;

  locale.subscribe((value) => {
    if (!chart) {
      return;
    }
    let lang = enGB;
    switch (value) {
      case "en":
        lang = enGB;
        break;
      case "ja":
        lang = ja;
        break;
    }
    chart.options.scales.x.adapters.date.locale = lang;
    chart.update();
  });

  onMount(() => {
    Chart.register(
      Colors,
      LineController,
      LineElement,
      PointElement,
      LinearScale,
      TimeScale,
      Tooltip
    );
    let ratingData = data.map((e) => {
      return {
        y: e.rating,
        x: e.contest.startTime * 1000,
      };
    });
    let lang = enGB;
    switch ($locale) {
      case "en":
        lang = enGB;
        break;
      case "ja":
        lang = ja;
        break;
    }
    chart = new Chart(canvas, {
      type: "line",
      data: {
        datasets: [
          {
            data: ratingData,
          },
        ],
      },
      options: {
        scales: {
          x: {
            type: "time",
            time: {
              unit: "month",
            },
            adapters: {
              date: {
                locale: lang,
              },
            },
            grid: {
              color: "rgba(128,128,128,0.1)",
            },
          },
          y: {
            grid: {
              color: "rgba(128,128,128,0.1)",
            },
          },
        },
      },
    });
    return () => {
      chart.destroy();
      chart = null;
    };
  });
</script>

<div class="w-full max-w-screen-sm p-5 lg:w-1/2">
  <div class="mb-4 flex justify-center gap-2">
    <div class="flex flex-col items-center justify-center gap-2 md:flex-row">
      <Leetcode class="text-lg" />
      <span>Leetcode</span>
    </div>
    <DualTag title={$_("home.stats.rating")} value={Math.round(rating)} />
    <DualTag
      title={$_("home.stats.topPercentage")}
      value={topPercentage + "%"}
    />
  </div>
  <canvas bind:this={canvas} />
</div>
