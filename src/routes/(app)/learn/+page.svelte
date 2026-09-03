<script>
  import Nav from "$lib/components/nav.svelte";

  const lessons = [
    { href: "/learn/calculus", name: "Intro to Calculus", thumb: "/assets/thumb/calculus.png" },
  ];
</script>

<svelte:head>
  <title>Learn</title>
</svelte:head>

<Nav />
<main>
  <ul>
    {#each lessons as l}
      <li>
        <a href={l.href}>
          <figure>
            <img src={l.thumb} alt={l.name} loading="lazy" />
          </figure>
          <span>{l.name}</span>
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
