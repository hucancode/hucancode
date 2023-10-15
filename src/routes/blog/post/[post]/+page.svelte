<script>
  import { onMount } from 'svelte';
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
    dateString = formatDateRelative('en', new Date(date));
  }
  update();
  afterUpdate(update);
  
  onMount(async () => {
    await import("$shoelace/relative-time/relative-time")
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
          <a data-sveltekit:prefetch href="/blog/category/{category}/" rainbow>
            {category}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
  <h1 class="xl">{title}</h1>
  <sl-relative-time {date} lang="en-US"></sl-relative-time>
  {#if cover}
    <img src={cover} alt="" />
  {/if}
  <div>
    <svelte:component this={data.content} />
  </div>
</article>
<Nav />

<style global>
  article {
    margin-top: 5rem;
    margin-bottom: 5rem;
    max-width: 768px;
    padding: 0 1.5rem;
  }
  article :global(img) {
    margin: 0 auto;
    display: block;
  }
  article :global(div img) {
    max-width: 80%;
  }
  article :global(div p img:only-child) {
    max-width: 80%;
  }
  @media (min-width: 640px) {
    article :global(div p img:only-child) {
      max-width: 50%;
    }
  }
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    list-style-type: none;
  }
  li a:before {
    content: '#';
  }
  sl-relative-time {
    margin-bottom: 1rem;
  }
  img {
    aspect-ratio: 16/9;
    width: 100%;
    border-radius: 0.5rem;
  }
</style>
