<script>
  import Nav from "$lib/components/nav.svelte";
  import Landing from "$lib/components/landing.svelte";
  import Skills from "$lib/components/skills.svelte";
  import Footer from "$lib/components/footer.svelte";
  import Copyright from "$lib/components/copyright.svelte";
export let data;
</script>

<Nav />
<Landing />
<Skills {data} />
<Footer />
<Copyright />
