<script>
  import PostsList from "$lib/components/notes/posts.svelte";
  import Pagination from "$lib/components/notes/pagination.svelte";

  /**
   * @typedef {Object} Props
   * @property {any} data
   */

  /** @type {Props} */
  let { data } = $props();
</script>

<svelte:head>
  <title>Notes - {data.category}</title>
</svelte:head>
<div>
  <small>Category</small>
  <h1>
    {data.category}
  </h1>
</div>
<PostsList posts={data.posts} base="/notes" />

<Pagination
  page={data.page}
  path={`/notes/category/${data.category}`}
  lastPage={data.lastPage}
/>

<style>
  div {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  h1 {
    cursor: default;
  }
</style>
