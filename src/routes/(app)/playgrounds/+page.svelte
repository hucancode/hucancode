<script>
  import Nav from "$lib/components/nav.svelte";

  const lessons = [
    { href: "/learn/calculus", name: "Intro to Calculus", thumb: "/assets/thumb/calculus.png" },
    { href: "/learn/collision", name: "Collision Detection", thumb: "/assets/thumb/collision.svg" },
  ];

  const playgrounds = [
    { href: "/dragon", name: "Dragon", thumb: "/assets/thumb/dragon.png" },
    { href: "/rubik", name: "Rubik", thumb: "/assets/thumb/rubik.png" },
    { href: "/taiji", name: "Taiji", thumb: "/assets/thumb/taiji.png" },
    { href: "/enso", name: "Ensō", thumb: "/assets/thumb/enso.png" },
    { href: "/ink-dragon", name: "Ink Dragon", thumb: "/assets/thumb/ink-dragon.png" },
    { href: "/caligraphy", name: "Caligraphy", thumb: "/assets/thumb/caligraphy.png" },
    { href: "/mech", name: "Mech", thumb: "/assets/thumb/mech.png" },
    { href: "/atlas", name: "Atlas", thumb: "/assets/thumb/atlas.png" },
    { href: "/poker", name: "Poker", thumb: "/assets/thumb/poker.png" },
    { href: "/radiance", name: "Radiance Cascades", thumb: "/assets/thumb/radiance.png" },
  ];
</script>

<svelte:head>
  <title>Playgrounds</title>
</svelte:head>

<header><Nav /></header>
<main>
  <section aria-labelledby="learn-heading">
    <h2 id="learn-heading">Learn</h2>
    <ul>
      {#each lessons as l}
        <li>
          <a href={l.href}>
            <figure>
              <img src={l.thumb} alt="" loading="lazy" />
              <figcaption>{l.name}</figcaption>
            </figure>
          </a>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="practice-heading">
    <h2 id="practice-heading">Practice</h2>
    <ul>
      {#each playgrounds as p}
        <li>
          <a href={p.href}>
            <figure>
              <img src={p.thumb} alt="" loading="lazy" />
              <figcaption>{p.name}</figcaption>
            </figure>
          </a>
        </li>
      {/each}
    </ul>
  </section>
</main>

<style>
  header {
    display: contents;
  }
  main {
    max-width: 1280px;
    padding: 1rem 1.5rem 4rem;
    gap: 2.5rem;
  }
  section {
    display: grid;
    gap: 1rem;
  }
  h2 {
    margin: 0;
    font-size: 1.75rem;
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
    display: block;
    padding: 0.75rem;
    color: var(--ink);
    background: color-mix(in srgb, var(--paper) 70%, transparent);
  }
  figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  figure img {
    aspect-ratio: 16/9;
    overflow: hidden;
    background: linear-gradient(135deg, color-mix(in srgb, var(--paper) 90%, var(--ink)), color-mix(in srgb, var(--paper) 80%, var(--ink)));
  }
  figure img {
    width: 100%;
    object-fit: cover;
  }
</style>
