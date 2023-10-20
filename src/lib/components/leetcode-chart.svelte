<script>
  import { _, locale } from "$lib/i18n";
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
  import { enGB, ja, vi } from "date-fns/locale";
  import "chartjs-adapter-date-fns";
  import DualTag from "$lib/components/dual-tag.svelte";
  import Leetcode from "$icons/simple-icons/leetcode.svg?raw";
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
      case "vi":
        lang = vi;
        break;
      default:
        lang = enGB;
        break;
    }
    chart.options.scales.x.adapters.date.locale = lang;
    chart.update();
  });

  onMount(async () => {
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
      case "vi":
        lang = vi;
        break;
      default:
        lang = enGB;
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

<figure>
  <div class="summary">
    <small class="heading">
      {@html Leetcode}
      <span>Leetcode</span>
    </small>
    <DualTag title={$_("home.stats.rating")} value={Math.round(rating)} />
    <DualTag
      title={$_("home.stats.topPercentage")}
      value={topPercentage + "%"}
    />
  </div>
  <canvas bind:this={canvas} />
</figure>

<style>
  figure {
    width: 100%;
    max-width: 640px;
    padding: 1.25rem;
  }
  .summary {
    margin-bottom: 1rem;
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }
  .heading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  @media (min-width: 768px) {
    .heading {
      flex-direction: row;
    }
  }
</style>
