<script>
  import Landing from "$lib/components/landing.svelte";
  import Skills from "$lib/components/skills.svelte";
  export let data;
</script>

<svelte:head>
  <title>hucancode</title>
</svelte:head>

<Landing />
<Skills {data} />
