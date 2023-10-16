<script>
  import { onMount } from "svelte";

  onMount(async () => {
    await import("$shoelace/icon/icon");
  });
</script>

<svelte:head>
  <title>About</title>
</svelte:head>
<header>
  <div>
    <img alt="logo" src="/assets/logo-source.svg" />
  </div>
  <small>
    Welcome to my blog, I am a Vietnamese software engineer based in Japan and a <s
      >weaboo</s
    >
    anime fan. I go by the handle <strong>hucancode</strong> in most places you can
    find me. I write about programming, game and other random things, mostly random
    things
  </small>
  <small>
    Most illustration images on this blog are taken from <a
      href="https://freepik.com">freepik</a
    >, thanks to wonderful contribution by
    <strong
      >freepik, pressfoto, dcstudio, rawpixel, wirestock, starline<strong
      /></strong
    >
  </small>
  <a
    target="_blank"
    rel="noreferrer"
    href="https://www.buymeacoffee.com/hucancode"
  >
    <h2 rainbow>
      Buy me a coffee
      <sl-icon name="buy-me-a-coffee" library="line-md" />
    </h2></a
  >
</header>

<style>
  header {
    max-width: 640px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 4rem;
  }
  img {
    width: 100%;
    height: auto;
  }
  div {
    display: flex;
    aspect-ratio: 1/1;
    width: 6rem;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background-color: black;
  }
  h2 {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  sl-icon {
    font-size: larger;
    color: var(--sl-color-primary-800);
  }
</style>
