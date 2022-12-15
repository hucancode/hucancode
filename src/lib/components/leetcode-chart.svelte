<script>
  import { _ } from "svelte-i18n";
  import { onMount } from "svelte";
  import Chart from "chart.js/auto";
  import DualTag from "$lib/components/dual-tag.svelte";
  let canvas;
  export let data;
  export let rating;
  export let topPercentage;

  onMount(() => {
    let labels = data.map((e) => {
      let format = { year: "numeric", month: "short" };
      let date = new Date(e.contest.startTime * 1000);
      return date.toLocaleDateString("en", format);
    });
    if (data.length != 0) {
      let lastLabel = labels[0];
      for (let i = 1; i < labels.length; i++) {
        if (labels[i] == lastLabel) {
          labels[i] = "";
        } else {
          lastLabel = labels[i];
        }
      }
    }
    let ratingData = data.map((e) => e.rating);
    let chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: $_("home.stats.lcRating"),
            data: ratingData,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
    return () => {
      chart.destroy();
    };
  });
</script>

<div class="h-full w-full">
  <div class="mb-4 flex justify-center gap-2">
    <DualTag title={$_("home.stats.lcRating")} value={Math.round(rating)} />
    <DualTag
      title={$_("home.stats.topPercentage")}
      value={topPercentage + "%"}
    />
  </div>
  <canvas bind:this={canvas} />
</div>
