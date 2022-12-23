<script>
  import { parseISO, formatRelative } from "date-fns";
  export let posts = [];
  function convertDate(date) {
    return formatRelative(parseISO(date), new Date());
  }
</script>

<ul>
  {#each posts as post}
    <li class="mb-2 p-6">
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
      </article>
      <p class="text-sm text-gray-600 dark:text-gray-400">{post.excerpt}</p>
    </li>
  {/each}
</ul>
