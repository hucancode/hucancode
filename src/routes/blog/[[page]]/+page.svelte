<script>
  import PostsList from "$lib/components/blog/posts.svelte";
  import Pagination from "$lib/components/blog/pagination.svelte";

  export let data;
</script>

<svelte:head>
  <title>Blog</title>
</svelte:head>
<PostsList posts={data.posts} />

<Pagination page={data.page} path="/blog" lastPage={data.lastPage} />
