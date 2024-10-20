<script>
  import PostsList from "$lib/components/blog/posts.svelte";
  import Pagination from "$lib/components/blog/pagination.svelte";

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
