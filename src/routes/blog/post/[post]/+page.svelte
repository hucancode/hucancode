<script>
  import "$styles/markdown.css";
  import { onMount } from "svelte";
  import { formatDateRelative } from "$lib/i18n";
  import Nav from "$lib/components/blog/nav-bottom.svelte";

  /**
   * @typedef {Object} Props
   * @property {any} [data]
   */

  /** @type {Props} */  let { data } = $props();
  let { title, excerpt, cover, date, categories } = $derived(data.meta);
  let content = $derived(data.content);
  let dateString = $derived(date && formatDateRelative("en", new Date(date)));
  
  let Content = $derived(content?.render ? content.render().component : null);
  let contentProps = $derived(content?.render ? content.render().props : {});
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
          <a href="/blog/category/{category}/" rainbow="3">
            {category}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
  <h1 xl>{title}</h1>
  <time>
    Posted {dateString}
  </time>
  <hr />
  {#if cover}
    <img src={cover} alt="cover" />
  {/if}
  <div>
    {#if Content}
      <Content {...contentProps} />
    {/if}
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
  time {
    color: var(--color-neutral-400);
    font-size: small;
  }
</style>
