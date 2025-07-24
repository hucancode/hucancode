<script>
  import Dragon from '$lib/components/dragon.svelte';
  import DragonStatic from '$lib/components/dragon-static.svelte';
  import DragonCurved from '$lib/components/dragon-curved.svelte';
  
  /** @type {{ style?: string, speed?: number, color?: string }} */
  let { style = 'animated', speed = 1, color = '#ffffff' } = $props();
</script>

<div class="dragon-container">
  {#if style === 'static'}
    <DragonStatic />
  {:else if style === 'curved'}
    <DragonCurved />
  {:else}
    <Dragon {speed} {color} />
  {/if}
</div>

<style>
  .dragon-container {
    width: 100%;
    height: 400px;
    margin: 2rem 0;
  }
</style>