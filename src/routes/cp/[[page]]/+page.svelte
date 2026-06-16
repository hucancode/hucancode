<script>
  import PostsList from "$lib/components/cp/posts.svelte";
  import Pagination from "$lib/components/cp/pagination.svelte";
  import Tags from "$lib/components/cp/tags.svelte";

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

<PostsList posts={data.posts} base="/cp" />

<Pagination page={data.page} path="/cp" lastPage={data.lastPage} />

{#if data.categories && data.categories.length > 0}
  <Tags categories={data.categories} base="/cp" />
{/if}
