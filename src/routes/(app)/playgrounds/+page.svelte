<script>
  import { onMount } from "svelte";
  import rough from "roughjs";
  import Dragon from "$icons/game-icons/dragon.svg?raw";
  import Cube from "$icons/mdi/cube.svg?raw";
  import Planet from "$icons/ph/planet.svg?raw";

  const playgrounds = [
    { href: "/dragon", name: "Dragon", icon: Dragon, thumb: null },
    { href: "/rubik", name: "Rubik", icon: Cube, thumb: null },
    { href: "/taiji", name: "Taiji", icon: Planet, thumb: null },
    { href: "/ink", name: "Ink", icon: Planet, thumb: null },
    { href: "/ink-dragon", name: "Ink Dragon", icon: Dragon, thumb: null },
    { href: "/caligraphy", name: "Caligraphy", icon: Planet, thumb: null },
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
    const g = rc.rectangle(pad, pad, w - pad * 2, h - pad * 2, {
      roughness: 1.6,
      stroke: "#3a3320",
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

<main class="playgrounds">
  <h1>Playgrounds</h1>
  <ul>
    {#each playgrounds as p, i}
      <li>
        <a href={p.href} bind:this={cardEls[i]} class="card">
          <svg class="card-border" bind:this={svgEls[i]} aria-hidden="true"></svg>
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
  @font-face {
    font-family: "Virgil";
    src: url("/fonts/Virgil.woff2") format("woff2");
    font-display: swap;
  }
  :global(body) {
    background: rgb(255, 252, 224);
  }
  .playgrounds {
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
  }
  h1 {
    font-family: "Virgil", "Comic Sans MS", cursive;
    font-size: 2.2rem;
    color: #3a3320;
    margin-bottom: 2rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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
    border-radius: 2px;
    background: rgba(255, 253, 240, 0.7);
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
    width: 320px;
    height: 180px;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: linear-gradient(135deg, #f0ece0, #e4dece);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .icon :global(svg) {
    width: 3rem;
    height: 3rem;
    fill: #3a3320;
    opacity: 0.45;
  }
  .name {
    font-family: "Virgil", "Comic Sans MS", cursive;
    font-size: 1.05rem;
    color: #3a3320;
    padding-left: 0.1rem;
  }
  .back {
    display: inline-block;
    margin-top: 2.5rem;
    font-family: "Virgil", "Comic Sans MS", cursive;
    color: #6b4e71;
    text-decoration: none;
  }
  .back:hover {
    text-decoration: underline;
  }
</style>
