<script>
  import Lego from "$lib/components/story/lego.svelte";
  import Rubik from "$lib/components/story/rubik.svelte";
  import Dragon from "$lib/components/story/dragon.svelte";
  import Taiji from "$lib/components/story/taiji.svelte";
  import Warrior from "$lib/components/story/warrior.svelte";
</script>

<svelte:head>
  <title>hucancode</title>
</svelte:head>

<main class="container-lg">
  <Lego />
  <!-- <Rubik />
  <Dragon />
  <Taiji />
  <Warrior /> -->
</main>

<style>
  main {
    padding-top: 5vh;
  }
</style>
