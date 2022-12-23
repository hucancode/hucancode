<script>
  import PostsList from "$lib/components/blog/posts.svelte";
  import Pagination from "$lib/components/blog/pagination.svelte";

  export let data;
</script>

<svelte:head>
  <title>Blog</title>
</svelte:head>

<h1
  class="text-fill-none animate-bg-pingpong whitespace-nowrap bg-rainbow2 bg-double-width bg-clip-text pb-1 text-4xl font-bold"
>
  #{data.category}
</h1>

<PostsList posts={data.posts} />

<Pagination
  page={data.page}
  path={`/blog/category/${data.category}`}
  lastPage={data.lastPage}
/>
