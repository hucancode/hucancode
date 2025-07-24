<script>
  import Lego from '$lib/components/lego.svelte';
  
  /** @type {{ model?: string }} */
  let { model = 'default' } = $props();
</script>

<Lego {model} />