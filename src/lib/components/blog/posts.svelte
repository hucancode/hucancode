<script>
  import { parseISO, formatRelative } from "date-fns";
  export let posts = [];
  function convertDate(date) {
    return formatRelative(parseISO(date), new Date());
  }
</script>

<ul class="max-w-screen-md grow">
  {#each posts as post}
    <li class="mb-2 flex flex-col gap-2 p-4 sm:flex-row">
      <img
        class="aspect-video w-full object-cover sm:w-1/4"
        alt="thumbnail"
        src={post.cover}
      />
      <article>
        <a data-sveltekit:prefetch href="/blog/post/{post.slug}">
          <h2
            class="text-xl font-semibold hover:text-blue-800 hover:dark:text-sky-400"
          >
            {post.title}
          </h2>
          <small class="text-gray-400 dark:text-gray-600"
            >Posted {convertDate(post.date)}</small
          >
        </a>
        <p class="text-sm text-gray-600 dark:text-gray-400">{post.excerpt}</p>
      </article>
    </li>
  {/each}
</ul>
