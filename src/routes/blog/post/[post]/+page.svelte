<script>
  import { parseISO, formatRelative } from "date-fns";
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
    dateString = formatRelative(parseISO(date), new Date());
  }
  update();
  afterUpdate(update);
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

<article class="container my-20 max-w-screen-lg">
  {#if categories}
    <ul class="flex flex-wrap gap-2">
      {#each categories as category}
        <li
          class="text-fill-none bg-rainbow3 bg-clip-text pb-1 text-sm font-bold before:content-['#']"
        >
          <a data-sveltekit:prefetch href="/blog/category/{category}/">
            {category}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
  <h1 class="text-4xl font-extrabold">{title}</h1>
  <time class="mb-4 text-xs text-gray-400">Posted {dateString}</time>
  {#if cover}
    <img
      class="aspect-video w-full rounded-lg object-cover sm:aspect-[22/9]"
      src={cover}
      alt=""
    />
  {/if}
  <div
    class="prose prose-slate mt-4 max-w-full dark:prose-invert prose-a:text-blue-600 prose-a:no-underline prose-a:dark:text-sky-300"
  >
    <svelte:component this={data.content} />
  </div>
</article>
<Nav />
