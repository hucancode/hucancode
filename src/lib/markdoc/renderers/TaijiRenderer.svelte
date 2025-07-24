<script>
  import Taiji from '$lib/components/taiji.svelte';
  
  /** @type {{ speed?: number }} */
  let { speed = 1 } = $props();
</script>

<Taiji {speed} />