<script>
  import { onMount } from 'svelte';
  import Dragon from '$lib/components/dragon.svelte';
  import Rubik from '$lib/components/rubik.svelte';
  import Taiji from '$lib/components/taiji.svelte';
  import Lego from '$lib/components/lego.svelte';
  
  /** @type {{ name: string, props?: any }} */
  let { name, props = {} } = $props();
  
  const componentMap = {
    dragon: Dragon,
    rubik: Rubik,
    taiji: Taiji,
    lego: Lego,
  };
  
  let component = $derived(componentMap[name]);
</script>

{#if component}
  {@const Component = component}
  <Component {...props} />
{:else}
  <div class="error">Component "{name}" not found</div>
{/if}

<style>
  .error {
    color: var(--color-error, red);
    background: var(--color-error-bg, #fee);
    padding: 1rem;
    border-radius: 0.25rem;
    margin: 1rem 0;
  }
</style>