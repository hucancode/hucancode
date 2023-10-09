<script>
  import Coffee from "~icons/simple-icons/buymeacoffee";
</script>

<svelte:head>
  <title>About</title>
</svelte:head>
<header>
  <div
  >
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
  <h2>
    <a
      target="_blank"
      rel="noreferrer"
      href="https://www.buymeacoffee.com/hucancode">Buy me a coffee</a
    >
    <Coffee />
  </h2>
</header>

<style>
  header {
    max-width: 640px;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 4rem;
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
</style>