<script>
  import { _ } from "$lib/i18n";
  import Idea from "$icons/line-md/lightbulb.svg?raw";
  import Watch from "$icons/fluent/eye-48.svg?raw";
  let sceneInstance;
  let scene;
  let showcases = ["rubik", "dragon", "lego", "taiji", "warrior"];
  let selected =
    showcases[Math.floor(Math.random() * showcases.length) % showcases.length];

  function performMagic() {
    sceneInstance.performMagic();
  }

  $: {
    switch (selected) {
      case "rubik":
        import("$lib/components/rubik.svelte").then((m) => (scene = m.default));
        break;
      case "dragon":
        import("$lib/components/dragon.svelte").then(
          (m) => (scene = m.default)
        );
        break;
      case "lego":
        import("$lib/components/lego.svelte").then((m) => (scene = m.default));
        break;
      case "taiji":
        import("$lib/components/taiji.svelte").then((m) => (scene = m.default));
        break;
      case "warrior":
        import("$lib/components/warrior.svelte").then(
          (m) => (scene = m.default)
        );
        break;
      default:
      // console.log("unhandled value", selected);
    }
  }
</script>

<figure>
  <div role="group">
    {#each showcases as showcase}
      <label>
        <input
          bind:group={selected}
          type="radio"
          name="showcase"
          value={showcase}
        />
        {$_(`home.showcase.${showcase}`)}
      </label>
    {/each}
  </div>
  <svelte:component this={scene} bind:this={sceneInstance} />
  <div role="group">
    <button on:click={performMagic}>
      {@html Idea}
      {$_("home.showcase.surprise")}
    </button>
    <a role="button" href={"/" + selected}>
      {@html Watch}
      {$_("home.showcase.fullscreen")}
    </a>
  </div>
</figure>

<style>
  figure {
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
    figure {
      aspect-ratio: 16/9;
    }
  }
</style>
