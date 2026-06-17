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
    { href: "/ink", name: "Ink", icon: Planet, thumb: "/assets/thumb/ink.png" },
    { href: "/ink-dragon", name: "Ink Dragon", icon: Dragon, thumb: "/assets/thumb/ink-dragon.png" },
    { href: "/caligraphy", name: "Caligraphy", icon: Planet, thumb: "/assets/thumb/caligraphy.png" },
    { href: "/lego", name: "Lego", icon: Cube, thumb: "/assets/thumb/lego.png" },
  ];

  let cardEls = $state([]);
  let svgEls = $state([]);

  function drawCard(svgEl, w, h, seed) {
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    svgEl.setAttribute("width", w);
    svgEl.setAttribute("height", h);
    svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const rc = rough.svg(svgEl);
    const pad = 3;
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
    const g = rc.rectangle(pad, pad, w - pad * 2, h - pad * 2, {
      roughness: 1.6,
      stroke: ink || "#16161D",
      strokeWidth: 1.5,
      fill: "none",
      seed,
    });
    svgEl.appendChild(g);
  }

  function redrawAll() {
    svgEls.forEach((svgEl, i) => {
      if (!svgEl || !cardEls[i]) return;
      const r = cardEls[i].getBoundingClientRect();
      drawCard(svgEl, r.width, r.height, i + 1);
    });
  }

  onMount(() => {
    redrawAll();
    const ro = new ResizeObserver(redrawAll);
    cardEls.forEach(el => el && ro.observe(el));
    return () => ro.disconnect();
  });
</script>

<svelte:head>
  <title>Playgrounds</title>
</svelte:head>

<main>
  <a class="back" href="/">{@html Return} Home</a>
  <h1>Playgrounds</h1>
  <ul>
    {#each playgrounds as p, i}
      <li>
        <a href={p.href} bind:this={cardEls[i]} class="card">
          <svg class="card-border" bind:this={svgEls[i]} aria-hidden="true"></svg>
          <div class="thumb">
            <img
              src={p.thumb}
              alt={p.name}
              loading="lazy"
              onerror={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling.style.display = "grid";
              }}
            />
            <span class="icon" style="display:none">{@html p.icon}</span>
          </div>
          <span class="name">{p.name}</span>
        </a>
      </li>
    {/each}
  </ul>
</main>

<style>
  @font-face {
    font-family: "Virgil";
    src: url("/fonts/Virgil.woff2") format("woff2");
    font-display: swap;
  }
  :global(body) {
    background: var(--paper);
  }
  main {
    position: relative;
    flex-direction: column;
    max-width: 1100px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
  }
  h1 {
    font-family: "Virgil", "Comic Sans MS", cursive;
    font-size: 2.2rem;
    color: var(--ink);
    margin-bottom: 2rem;
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
    display: flex;
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    text-decoration: none;
    color: inherit;
    padding: 0.75rem;
    background: color-mix(in srgb, var(--paper) 70%, transparent);
    transition: transform 0.15s ease;
  }
  .card:hover {
    transform: translateY(-4px) rotate(-0.4deg);
  }
  .card-border {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }
  .thumb {
    width: 18rem;
    aspect-ratio: 16/9;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: linear-gradient(135deg, color-mix(in srgb, var(--paper) 90%, var(--ink)), color-mix(in srgb, var(--paper) 80%, var(--ink)));
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .icon :global(svg) {
    width: 3rem;
    height: 3rem;
    fill: var(--ink);
    opacity: 0.45;
  }
  .name {
    font-family: "Virgil", "Comic Sans MS", cursive;
    font-size: 1.05rem;
    color: var(--ink);
    padding-left: 0.1rem;
  }
  a.back {
    position: absolute;
    top: 1rem;
    left: 1.5rem;
    z-index: 10;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0;
    background: none;
    border: none;
    font-family: "Virgil", "Comic Sans MS", cursive;
    color: var(--link);
    text-decoration: none;
  }
  a.back:hover { opacity: 0.7; }
  a.back :global(svg) { width: 1.2rem; height: 1.2rem; }
</style>
