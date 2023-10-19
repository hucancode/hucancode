<script>
  import "$styles/markdown.css";
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
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-left: 0;
    list-style-type: none;
    font-weight: bold;
  }
  li a:before {
    content: "#";
  }
  img {
    aspect-ratio: 16/9;
    width: 100%;
    border-radius: 0.5rem;
    margin-bottom: 2rem;
  }
</style>
