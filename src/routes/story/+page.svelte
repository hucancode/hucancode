<script>
  import Nav from "$lib/components/nav.svelte";
  import Greetings from "$lib/components/story/greetings.svelte";
  import Showcase from "$lib/components/story/Showcase.svelte";
  import Contact from "$lib/components/story/contact.svelte";
</script>

<svelte:head>
  <title>hucancode</title>
</svelte:head>
<Nav />
<main class="container-lg">
  <Greetings />
  <Showcase />
  <Contact />
</main>

<style>
  main {
    padding-top: 5vh;
  }
</style>
