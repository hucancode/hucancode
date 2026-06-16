<script>
  import Dragon from "$icons/game-icons/dragon.svg?raw";
  import Cube from "$icons/mdi/cube.svg?raw";
  import Planet from "$icons/ph/planet.svg?raw";

  // thumb: path to a preview image (added later). Until then the icon shows
  // centered on a placeholder tile.
  const playgrounds = [
    { href: "/dragon", name: "Dragon", icon: Dragon, thumb: null },
    { href: "/rubik", name: "Rubik", icon: Cube, thumb: null },
    { href: "/taiji", name: "Taiji", icon: Planet, thumb: null },
    { href: "/ink", name: "Ink", icon: Planet, thumb: null },
    { href: "/ink-dragon", name: "Ink Dragon", icon: Dragon, thumb: null },
    { href: "/caligraphy", name: "Caligraphy", icon: Planet, thumb: null },
  ];
</script>

<svelte:head>
  <title>Playgrounds</title>
</svelte:head>

<main class="playgrounds">
  <h1>Playgrounds</h1>
  <ul>
    {#each playgrounds as p}
      <li>
        <a href={p.href}>
          <div class="thumb">
            {#if p.thumb}
              <img src={p.thumb} alt={p.name} loading="lazy" />
            {:else}
              <span class="icon">{@html p.icon}</span>
            {/if}
          </div>
          <span class="name">{p.name}</span>
        </a>
      </li>
    {/each}
  </ul>
  <a class="back" href="/">← back</a>
</main>

<style>
  .playgrounds {
    max-width: 1100px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
  }
  h1 {
    margin-bottom: 2rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1.25rem;
  }
  li a {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    text-decoration: none;
    color: inherit;
  }
  .thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 0.6rem;
    background: linear-gradient(135deg, #f4f1ea, #e7e2d6);
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  li a:hover .thumb {
    transform: translateY(-3px);
    border-color: #6b4e71;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .icon :global(svg) {
    width: 3rem;
    height: 3rem;
    fill: currentColor;
    opacity: 0.55;
  }
  .name {
    font-size: 1rem;
    font-weight: 500;
    padding-left: 0.15rem;
  }
  .back {
    display: inline-block;
    margin-top: 2.5rem;
    color: #6b4e71;
    text-decoration: none;
  }
  .back:hover {
    text-decoration: underline;
  }
</style>
