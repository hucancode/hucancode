<script>
  import Rubik from '$lib/components/rubik.svelte';
  import Rubik1 from '$lib/components/rubik-breakdown-1.svelte';
  import Rubik3 from '$lib/components/rubik-breakdown-3.svelte';
  import Rubik3R from '$lib/components/rubik-breakdown-3r.svelte';

  /** @type {{ size?: 'small' | 'medium' | 'large', cubes?: 1 | 3 | 5, rotating?: boolean }} */
  let { size = 'medium', cubes = 3, rotating = false } = $props();
</script>

<div class="rubik-wrapper" class:small={size === 'small'} class:large={size === 'large'}>
  {#if cubes === 1}
    <Rubik1 />
  {:else if cubes === 3 && rotating}
    <Rubik3R />
  {:else if cubes === 3 && !rotating}
    <Rubik3 />
  {:else}
    <Rubik bind:size={cubes} />
  {/if}
</div>

<style>
  .rubik-wrapper {
    width: 100%;
    height: 400px;
    margin: 2rem 0;
  }

  .rubik-wrapper.small {
    height: 300px;
  }

  .rubik-wrapper.large {
    height: 500px;
  }
</style>
