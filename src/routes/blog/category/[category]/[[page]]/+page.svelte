<script>
  import PostsList from "$lib/components/blog/posts.svelte";
  import Pagination from "$lib/components/blog/pagination.svelte";

  export let data;
</script>

<svelte:head>
  <title>Blog - {data.category}</title>
</svelte:head>
<div>
  <small>Category</small>
  <h1 rainbow>
    {data.category}
  </h1>
</div>
<PostsList posts={data.posts} />

<Pagination
  page={data.page}
  path={`/blog/category/${data.category}`}
  lastPage={data.lastPage}
/>

<style>
  div {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
</style>
