<script>
  import { parseISO, formatRelative } from "date-fns";

  export let title;
  export let excerpt;
  export let date;
  export let cover;
  export let categories;

  let dateString = formatRelative(parseISO(date), new Date());
  //import "prismjs/themes/prism-twilight.css";
  import Nav from "$lib/components/blog/nav-bottom.svelte";
  import "$styles/prism.css";
  import "$styles/prism-light.css";
  import "katex/dist/katex.css";
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
  <small>Posted {dateString}</small>
  {#if cover}
    <img src={cover} alt="" />
  {/if}
  <div>
    <slot />
  </div>
</article>
<Nav />

<style>
  article {
    margin-top: 5rem;
    margin-bottom: 5rem;
  }
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  li a:before {
    content: '#';
  }
  small {
    margin-bottom: 1rem;
  }
  img {
    aspect-ratio: 16/9;
    width: 100%;
    border-radius: 0.5rem;
  }
</style>
