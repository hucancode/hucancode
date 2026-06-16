<script>
  import PostsList from "$lib/components/cp/posts.svelte";
  import Pagination from "$lib/components/cp/pagination.svelte";

  /**
   * @typedef {Object} Props
   * @property {any} data
   */

  /** @type {Props} */
  let { data } = $props();
</script>

<svelte:head>
  <title>CP - {data.category}</title>
</svelte:head>
<div>
  <small>Category</small>
  <h1 rainbow>
    {data.category}
  </h1>
</div>
<PostsList posts={data.posts} base="/cp" />

<Pagination
  page={data.page}
  path={`/cp/category/${data.category}`}
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
