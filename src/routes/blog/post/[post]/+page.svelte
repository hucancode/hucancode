<script>
  import { onMount } from "svelte";
  import { formatDateRelative } from "$lib/i18n";
  import { afterUpdate } from "svelte";
  import Nav from "$lib/components/blog/nav-bottom.svelte";

  export let data;
  let title, excerpt, date, cover, categories, dateString;
  function update() {
    title = data.meta.title;
    excerpt = data.meta.excerpt;
    cover = data.meta.cover;
    date = data.meta.date;
    categories = data.meta.categories;
    if (!date) return;
    dateString = formatDateRelative("en", new Date(date));
  }
  update();
  afterUpdate(update);

  onMount(async () => {
    await import("$shoelace/relative-time/relative-time");
    await import("$shoelace/divider/divider");
  });
</script>

<svelte:head>
  <!-- Be sure to add your image files and un-comment the lines below -->
  <title>{title}</title>
  <meta data-key="description" name="description" content={excerpt} />
  <meta property="og:type" content="article" />
  <meta property="og:title" content={title} />
  <meta name="twitter:title" content={title} />
  <meta property="og:description" content={excerpt} />
  <meta name="twitter:description" content={excerpt} />
  <!-- <meta property="og:image" content="https://yourdomain.com/image_path" /> -->
  <!-- <meta name="twitter:image" content="https://yourdomain.com/image_path" /> -->
</svelte:head>

<article class="container">
  {#if categories}
    <ul>
      {#each categories as category}
        <li>
          <a
            data-sveltekit:prefetch
            href="/blog/category/{category}/"
            rainbow="3"
          >
            {category}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
  <h1 xl>{title}</h1>
  <small>
    Posted <sl-relative-time {date} lang="en-US" />
  </small>
  <sl-divider />
  {#if cover}
    <img src={cover} alt="cover" />
  {/if}
  <div>
    <svelte:component this={data.content} />
  </div>
</article>
<Nav />

<style>
  img {
    margin-top: 2rem;
    margin-bottom: 2rem;
  }
  article {
    margin-top: 5rem;
    margin-bottom: 5rem;
    max-width: 768px;
    padding: 0 1.5rem;
  }
  article :global(small img) {
    margin: 0 auto;
    display: inline-block;
  }
  article :global(img) {
    margin: 0 auto;
    display: block;
  }
  article :global(img + em) {
    margin: 0 auto;
    display: block;
    text-align: center;
  }
  article :global(div img) {
    max-width: 80%;
  }
  article :global(div p img:only-of-type) {
    max-width: 80%;
  }
  @media (min-width: 640px) {
    article :global(div p img:only-of-type) {
      max-width: 50%;
    }
  }
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    list-style-type: none;
    padding-left: 0;
    font-weight: var(--sl-font-weight-bold);
  }
  li a:before {
    content: "#";
  }
  img {
    aspect-ratio: 16/9;
    width: 100%;
    border-radius: 0.5rem;
  }
</style>
