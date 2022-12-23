<script>
  import PostsList from "$lib/components/blog/posts.svelte";
  import Pagination from "$lib/components/blog/pagination.svelte";

  export let data;
</script>

<svelte:head>
  <title>Blog</title>
</svelte:head>
<header class="flex flex max-w-screen-sm flex-col items-center gap-2 p-16">
  <a data-sveltekit:prefetch href="/"
    ><div
      class="flex aspect-square w-24 items-center justify-center rounded-full bg-black"
    >
      <img alt="logo" src="/assets/logo-source.svg" />
    </div></a
  >
  <p class="text-center text-sm text-gray-400">
    Welcome to my blog, I write about programming, game and other random things,
    mostly random things
  </p>
</header>
<PostsList posts={data.posts} />

<Pagination page={data.page} path="/blog" lastPage={data.lastPage} />
