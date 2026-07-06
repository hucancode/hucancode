<script>
  import "$styles/markdown.css";
  import Nav from "$lib/components/notes/nav-bottom.svelte";

  /**
   * @typedef {Object} Props
   * @property {any} [data]
   */

  /** @type {Props} */ let { data } = $props();
  let { title, excerpt, cover, categories } = $derived(data.meta);
  let content = $derived(data.content);

  let Content = $derived(content?.render ? content.render().component : null);
  let contentProps = $derived(content?.render ? content.render().props : {});
</script>

<svelte:head>
  <title>{title}</title>
  <meta data-key="description" name="description" content={excerpt} />
  <meta property="og:type" content="article" />
  <meta property="og:title" content={title} />
  <meta name="twitter:title" content={title} />
  <meta property="og:description" content={excerpt} />
  <meta name="twitter:description" content={excerpt} />
</svelte:head>

<article>
  {#if categories}
    <ul>
      {#each categories as category}
        <li>
          <a href="/notes/category/{category}/">
            {category}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
  <h1>{title}</h1>
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
</style>
