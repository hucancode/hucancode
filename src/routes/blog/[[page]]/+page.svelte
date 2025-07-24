<script>
  import PostsList from "$lib/components/blog/posts.svelte";
  import Pagination from "$lib/components/blog/pagination.svelte";
  import Tags from "$lib/components/blog/tags.svelte";

  /**
   * @typedef {Object} Props
   * @property {any} data
   */

  /** @type {Props} */
  let { data } = $props();
</script>

<svelte:head>
  <title>Blog</title>
</svelte:head>

<PostsList posts={data.posts} />

<Pagination page={data.page} path="/blog" lastPage={data.lastPage} />

{#if data.categories && data.categories.length > 0}
  <Tags categories={data.categories} />
{/if}
