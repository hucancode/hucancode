<script>
  import PostsList from "$lib/components/blog/posts.svelte";
  import Pagination from "$lib/components/blog/pagination.svelte";

  export let data;
</script>

<svelte:head>
  <title>Blog</title>
</svelte:head>
<div class="flex flex-col items-center">
  <p class="text-gray-400 dark:text-gray-600">Category</p>
  <h1
    class="text-fill-none animate-bg-pingpong bg-rainbow2 bg-double-width whitespace-nowrap bg-clip-text pb-1 text-4xl font-bold"
  >
    {data.category}
  </h1>
</div>
<PostsList posts={data.posts} />

<Pagination
  page={data.page}
  path={`/blog/category/${data.category}`}
  lastPage={data.lastPage}
/>
