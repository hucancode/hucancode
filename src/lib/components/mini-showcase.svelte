<script>
  import { _ } from "$lib/i18n";
  import { onMount } from "svelte";
  import Idea from "$icons/line-md/lightbulb.svg?raw";
  import Watch from "$icons/line-md/watch.svg?raw";
  let selected = "";
  let sceneInstance;
  let Scene;

  let showcases = ["rubik", "dragon", "lego", "taiji", "warrior"];

  onMount(async () => {
    selected = showcases[0];
  });

  function performMagic() {
    sceneInstance.performMagic();
  }

  $: {
    switch (selected) {
      case "rubik":
        import("$lib/components/rubik.svelte").then((m) => Scene = m.default);
        break;
      case "dragon":
        import("$lib/components/dragon.svelte").then((m) => Scene = m.default);
        break;
      case "lego":
        import("$lib/components/lego.svelte").then((m) => Scene = m.default);
        break;
      case "taiji":
        import("$lib/components/taiji.svelte").then((m) => Scene = m.default);
        break;
      case "warrior":
        import("$lib/components/warrior.svelte").then((m) => Scene = m.default);
        break;
      default:
        console.log("unhandled value" + selected);
    }
  }
</script>

<article>
  <div role="group">
    {#each showcases as showcase}
      <label>
        <input bind:group={selected} type="radio" name="showcase" value={showcase} />
        {$_(`home.showcase.${showcase}`)}
      </label>
    {/each}
  </div>
  <svelte:component this={Scene} bind:this={sceneInstance} />
  <div role="group">
    <button on:click={performMagic}>
      {@html Idea}
      {$_("home.showcase.surprise")}
    </button>
    <a role="button" data-sveltekit:prefetch href={"/" + selected}>
      {@html Watch}
      {$_("home.showcase.fullscreen")}
    </a>
  </div>
</article>

<style>
  article {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
    aspect-ratio: 4/3;
    width: 100%;
    max-width: 32rem;
  }
  @media (min-width: 768px) {
    article {
      aspect-ratio: 16/9;
    }
  }
</style>
