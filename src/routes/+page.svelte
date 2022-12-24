<script>
  import Nav from "$lib/components/nav.svelte";
  import Landing from "$lib/components/landing.svelte";
  import Skills from "$lib/components/skills.svelte";
  import Footer from "$lib/components/footer.svelte";
  export let data;
</script>

<svelte:head>
  <title>hucancode</title>
</svelte:head>
<Nav />
<Landing />
<Skills {data} />
<Footer />
