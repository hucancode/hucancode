<script>
  import Nav from "$lib/components/nav.svelte";

  const playgrounds = [
    { href: "/dragon", name: "Dragon", thumb: "/assets/thumb/dragon.png" },
    { href: "/rubik", name: "Rubik", thumb: "/assets/thumb/rubik.png" },
    { href: "/taiji", name: "Taiji", thumb: "/assets/thumb/taiji.png" },
    { href: "/enso", name: "Ensō", thumb: "/assets/thumb/enso.png" },
    { href: "/ink-dragon", name: "Ink Dragon", thumb: "/assets/thumb/ink-dragon.png" },
    { href: "/caligraphy", name: "Caligraphy", thumb: "/assets/thumb/caligraphy.png" },
    { href: "/lego", name: "Lego", thumb: "/assets/thumb/lego.png" },
    { href: "/mech", name: "Mech", thumb: "/assets/thumb/mech.png" },
    { href: "/atlas", name: "Atlas", thumb: "/assets/thumb/atlas.png" },
    { href: "/sculpt", name: "Sculpt", thumb: "/assets/thumb/sculpt.png" },
    { href: "/poker", name: "Poker", thumb: "/assets/thumb/poker.png" },
  ];
</script>

<svelte:head>
  <title>Playgrounds</title>
</svelte:head>

<Nav />
<main>
  <ul>
    {#each playgrounds as p}
      <li>
        <a href={p.href}>
          <figure>
            <img src={p.thumb} alt={p.name} loading="lazy" />
          </figure>
          <span>{p.name}</span>
        </a>
      </li>
    {/each}
  </ul>
</main>

<style>
  main {
    max-width: 1280px;
    padding: 1rem 1.5rem 4rem;
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
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.75rem;
    color: var(--ink);
    background: color-mix(in srgb, var(--paper) 70%, transparent);
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
</style>
