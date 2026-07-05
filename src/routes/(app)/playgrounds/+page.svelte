<script>
  import { onMount } from "svelte";
  import rough from "roughjs";
  import Dragon from "$icons/game-icons/dragon.svg?raw";
  import Cube from "$icons/mdi/cube.svg?raw";
  import Planet from "$icons/ph/planet.svg?raw";
  import Return from "$icons/line-md/chevron-left.svg?raw";

  const playgrounds = [
    { href: "/dragon", name: "Dragon", icon: Dragon, thumb: "/assets/thumb/dragon.png" },
    { href: "/rubik", name: "Rubik", icon: Cube, thumb: "/assets/thumb/rubik.png" },
    { href: "/taiji", name: "Taiji", icon: Planet, thumb: "/assets/thumb/taiji.png" },
    { href: "/enso", name: "Ensō", icon: Planet, thumb: "/assets/thumb/enso.png" },
    { href: "/flower", name: "Ink Flower", icon: Planet, thumb: "/assets/thumb/flower.png" },
    { href: "/ink-dragon", name: "Ink Dragon", icon: Dragon, thumb: "/assets/thumb/ink-dragon.png" },
    { href: "/caligraphy", name: "Caligraphy", icon: Planet, thumb: "/assets/thumb/caligraphy.png" },
    { href: "/lego", name: "Lego", icon: Cube, thumb: "/assets/thumb/lego.png" },
    { href: "/mech", name: "Mech", icon: Cube, thumb: "/assets/thumb/mech.png" },
  ];

</script>

<svelte:head>
  <title>Playgrounds</title>
</svelte:head>

<main>
  <nav><a class="back" href="/">{@html Return} Home</a></nav>
  <ul>
    {#each playgrounds as p, i}
      <li>
        <a href={p.href}>
          <figure>
            <img
              src={p.thumb}
              alt={p.name}
              loading="lazy"
              onerror={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling.style.display = "grid";
              }}
            />
            <span style="display:none">{@html p.icon}</span>
          </figure>
          <span>{p.name}</span>
        </a>
      </li>
    {/each}
  </ul>
</main>

<style>
  main {
    position: relative;
    flex-direction: column;
    max-width: 1100px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
    gap: 1.5rem;
  }
  li {
    border: 1px dashed var(--color-neutral-500);
  }
  li > a {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.75rem;
    color: var(--ink);
    background: color-mix(in srgb, var(--paper) 70%, transparent);
    transition: transform 0.15s ease;
  }
  li > a > svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
    opacity: 0.15;
  }
  figure {
    margin: 0;
    aspect-ratio: 16/9;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: linear-gradient(135deg, color-mix(in srgb, var(--paper) 90%, var(--ink)), color-mix(in srgb, var(--paper) 80%, var(--ink)));
  }
  figure img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  figure span :global(svg) {
    width: 3rem;
    height: 3rem;
    fill: var(--ink);
    opacity: 0.45;
  }
</style>
