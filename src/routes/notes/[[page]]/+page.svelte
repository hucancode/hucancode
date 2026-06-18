<script>
  import PostsList from "$lib/components/notes/posts.svelte";
  import Pagination from "$lib/components/notes/pagination.svelte";
  import Tags from "$lib/components/notes/tags.svelte";

  /**
   * @typedef {Object} Props
   * @property {any} data
   */

  /** @type {Props} */
  let { data } = $props();
</script>

<svelte:head>
  <title>Competitive Programming</title>
</svelte:head>

<PostsList posts={data.posts} base="/notes" />

<Pagination page={data.page} path="/notes" lastPage={data.lastPage} />

{#if data.categories && data.categories.length > 0}
  <Tags categories={data.categories} base="/notes" />
{/if}
