<script>
  import Dragon from "$lib/components/dragon.svelte";
  import DragonStatic from "$lib/components/dragon-static.svelte";
  import DragonCurved from "$lib/components/dragon-curved.svelte";
  import DragonFigure8 from "$lib/components/dragon-figure8.svelte";

  /** @type {{ style?: string, speed?: number, color?: string }} */
  let { style = "animated", speed = 1, color = "#ffffff" } = $props();
</script>

{#if style === "static"}
  <DragonStatic />
{:else if style === "curved"}
  <DragonCurved />
{:else if style === "figure8"}
  <DragonFigure8 />
{:else}
  <Dragon {speed} {color} />
{/if}
