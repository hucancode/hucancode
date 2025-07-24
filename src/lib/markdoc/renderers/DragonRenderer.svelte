<script>
  import Dragon from '$lib/components/dragon.svelte';
  
  /** @type {{ speed?: number, color?: string }} */
  let { speed = 1, color = '#ffffff' } = $props();
</script>

<Dragon {speed} {color} />