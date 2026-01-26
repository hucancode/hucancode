<script>
  import Rubik from "$lib/components/rubik.svelte";
  import Rubik1 from "$lib/components/rubik-breakdown-1.svelte";
  import Rubik3 from "$lib/components/rubik-breakdown-3.svelte";
  import Rubik3R from "$lib/components/rubik-breakdown-3r.svelte";
  import RubikXR from "$lib/components/rubik-breakdown-xr.svelte";

  /** @type {{ size?: 'small' | 'medium' | 'large', cubes?: number, rotating?: boolean, showControls?: boolean, canvasId: string }} */
  let {
    canvasId,
    size = "medium",
    cubes = 5,
    rotating = false,
    showControls = true,
  } = $props();
</script>

{#if cubes === 1}
  <Rubik1 {canvasId} />
{:else if !rotating}
  <Rubik3 {canvasId} />
{:else if cubes == 3}
  <Rubik3R {canvasId} {showControls} size={cubes} />
{:else}
  <RubikXR {canvasId} {showControls} size={cubes} />
{/if}
