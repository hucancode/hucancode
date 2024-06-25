<script>
  import { _ } from "$lib/i18n";
  import Nav from "$lib/components/nav.svelte";
  import Greetings from "$lib/components/story/greetings.svelte";
  import Showcase from "$lib/components/story/showcase.svelte";
</script>

<svelte:head>
  <title>hucancode</title>
  <meta name="description" content={$_("home.landing.about")} />
</svelte:head>
<Nav />
<main class="container-lg">
  <Greetings />
  <Showcase />
</main>

<style>
  main {
    padding-top: 5vh;
  }
</style>
